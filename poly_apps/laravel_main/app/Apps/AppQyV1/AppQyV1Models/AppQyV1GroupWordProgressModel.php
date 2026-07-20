<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Enums\AppQyV1ProficiencyLevelEnum;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Per-(user, group) word progress - ONE row per group holding the whole
 * word membership + progress state as a JSON map. Replaces BOTH legacy
 * row-per-word tables (app_qy_v1_group_words and
 * app_qy_v1_user_word_progress), which were ~1:1 redundant and hit
 * PostgreSQL's 65535 bind-parameter limit on large groups.
 *
 * words JSON shape: { "<word_id>": entry } where word_id is the
 * per-language dictionary id (app_qy_v1_tts_cache_{language_code}.id,
 * one language per group) stored as a string key.
 *
 * ENTRY LEGEND (short key -> full field name; ALL timestamps are unix
 * seconds (UTC) stored as ints, null when unset):
 *   fr -> first_read_at   (int|null unix seconds)
 *   lr -> last_read_at    (int|null unix seconds)
 *   lv -> last_review_at  (int|null unix seconds)
 *   nr -> next_review_at  (int|null unix seconds)
 *   rc -> read_count      (int)
 *   vc -> review_count    (int)
 *   wt -> weight          (int, initially word length)
 *   pf -> proficiency     (float 0-100)
 *   aa -> added_at        (int|null unix seconds)
 *   po -> position        (float|null in [0,1) - shuffle order, null = not
 *                          yet positioned; Default Vocabulary Group only)
 *   pt -> play_time       (float seconds - total read/play duration)
 *   rpt -> reread_time    (float seconds - reread duration; a read with
 *                          rc>=1 before it counts as a reread)
 *
 * Membership check = array_key_exists on the map. ALL mutation helpers
 * (putWords / updateWordProgress / applyReviewResult / removeWords) work
 * IN MEMORY on the whole map and keep total_words in sync; the caller
 * persists with ONE save() per request - never save per word in a loop.
 *
 * Ported observer side effects (the legacy AppQyV1UserWordProgressObserver
 * stamped first_read_at and recalculated next_review_at on progress
 * writes): normalizeEntry() applies both rules on every entry mutation.
 */
class AppQyV1GroupWordProgressModel extends Model
{
    protected $appKey = AppKeys::APPQYV1;

    /**
     * Single source of truth for the short-key legend
     * (short key -> full field name). Exposed verbatim by the
     * /group/get_progress_blob endpoint so the FE can expand entries.
     */
    public const ENTRY_LEGEND = [
        'fr' => 'first_read_at',
        'lr' => 'last_read_at',
        'lv' => 'last_review_at',
        'nr' => 'next_review_at',
        'rc' => 'read_count',
        'vc' => 'review_count',
        'wt' => 'weight',
        'pf' => 'proficiency',
        'aa' => 'added_at',
        'po' => 'position',
        'pt' => 'play_time',
        'rpt' => 'reread_time',
    ];

    /** Template for a brand-new word entry. */
    public const EMPTY_ENTRY = [
        'fr' => null,
        'lr' => null,
        'lv' => null,
        'nr' => null,
        'rc' => 0,
        'vc' => 0,
        'wt' => 0,
        'pf' => 0,
        'aa' => null,
        'po' => null,
        'pt' => 0,
        'rpt' => 0,
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppQyV1TableMaps::getTableName('GROUP_WORD_PROGRESS');
    }

    public function getConnectionName()
    {
        return AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    protected $fillable = [
        'user_id',
        'group_id',
        'language_code',
        'words',
        'total_words',
        'shuffled_at',
    ];

    protected $casts = [
        'words' => 'array',
        'user_id' => 'integer',
        'group_id' => 'integer',
        'total_words' => 'integer',
        'shuffled_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(AppQyV1WordGroupModel::class, 'group_id');
    }

    /**
     * The progress row of a group (groups are per-user, so group_id alone
     * is the key - it carries a unique index). Creates an empty row when
     * none exists yet.
     */
    public static function forUserGroup(int $userId, int $groupId, string $languageCode = 'en'): self
    {
        $existing = self::where('group_id', $groupId)->first();
        if ($existing) {
            return $existing;
        }
        return self::create([
            'user_id' => $userId,
            'group_id' => $groupId,
            'language_code' => $languageCode,
            'words' => [],
            'total_words' => 0,
        ]);
    }

    /**
     * Row-locked fetch for mutation paths (call inside a transaction,
     * after locking/along with the word_groups row).
     */
    public static function lockForGroup(int $groupId): ?self
    {
        return self::where('group_id', $groupId)->lockForUpdate()->first();
    }

    /** The words JSON map ([] when unset). Keys are word-id strings. */
    public function getWordsMap(): array
    {
        $map = $this->words;
        if (!is_array($map)) {
            return [];
        }
        return $map;
    }

    /** Membership check: word_id key exists in the map. */
    public function hasWord(int $wordId): bool
    {
        return array_key_exists((string) $wordId, $this->getWordsMap());
    }

    /**
     * Merge-missing bulk add: every word id not yet in the map gets a fresh
     * EMPTY_ENTRY with aa = $addedAt (datetime string, stored as unix
     * seconds) and optional wt from $weightsByWordId. Existing entries are
     * NEVER touched. In-memory only - caller saves once. Returns the number
     * of word ids actually added.
     *
     * When $assignRandomPosition is true, each newly-added entry also gets
     * po = mt_rand()/mt_getrandmax() (a random float in [0,1)) so the
     * Default Vocabulary Group interleaves new words among the already
     * positioned ones without re-shuffling the existing order. When false,
     * po stays null (current behavior - non-default groups keep aa-asc).
     *
     * @param array<int|string> $wordIds
     * @param array<int, int> $weightsByWordId word_id => initial weight
     */
    public function putWords(array $wordIds, string $addedAt, array $weightsByWordId = [], bool $assignRandomPosition = false): int
    {
        $map = $this->getWordsMap();
        $addedAtTs = strtotime($addedAt);
        if ($addedAtTs === false) {
            $addedAtTs = time();
        }

        $added = 0;
        foreach ($wordIds as $wordId) {
            $key = (string) (int) $wordId;
            if (array_key_exists($key, $map)) {
                continue;
            }
            $entry = self::EMPTY_ENTRY;
            $entry['aa'] = $addedAtTs;
            if (isset($weightsByWordId[(int) $wordId])) {
                $entry['wt'] = (int) $weightsByWordId[(int) $wordId];
            }
            if ($assignRandomPosition) {
                $entry['po'] = mt_rand() / mt_getrandmax();
            }
            $map[$key] = $entry;
            $added++;
        }

        if ($added > 0) {
            $this->words = $map;
            $this->total_words = count($map);
        }
        return $added;
    }

    /**
     * Merge a short-key patch into one word's entry (created from
     * EMPTY_ENTRY when missing) and normalize it (ported observer rules).
     * In-memory only - caller saves once. Returns the updated entry.
     */
    public function updateWordProgress(int $wordId, array $patch): array
    {
        $map = $this->getWordsMap();
        $key = (string) $wordId;

        $entry = self::EMPTY_ENTRY;
        if (array_key_exists($key, $map) && is_array($map[$key])) {
            $entry = array_merge($entry, $map[$key]);
        } else {
            $entry['aa'] = time();
        }

        foreach ($patch as $shortKey => $value) {
            if (!array_key_exists($shortKey, self::ENTRY_LEGEND)) {
                continue;
            }
            $entry[$shortKey] = $value;
        }

        $entry = self::normalizeEntry($entry, array_keys($patch));

        $map[$key] = $entry;
        $this->words = $map;
        $this->total_words = count($map);
        return $entry;
    }

    /**
     * Quiz/review outcome on one word: proficiency +5 (correct) / -10
     * (wrong) clamped to 0-100, review counters + next review recompute
     * (ported from the legacy AppQyV1UserWordProgressModel
     * updateProficiency + calculateNextReviewTime before its deletion).
     * In-memory only - caller saves once. Returns the updated entry.
     */
    public function applyReviewResult(int $wordId, bool $isCorrect): array
    {
        $map = $this->getWordsMap();
        $key = (string) $wordId;

        $entry = self::EMPTY_ENTRY;
        if (array_key_exists($key, $map) && is_array($map[$key])) {
            $entry = array_merge($entry, $map[$key]);
        } else {
            $entry['aa'] = time();
        }

        $proficiency = (float) $entry['pf'];
        if ($isCorrect) {
            $proficiency = min(100, $proficiency + 5);
        } else {
            $proficiency = max(0, $proficiency - 10);
        }

        return $this->updateWordProgress($wordId, [
            'pf' => $proficiency,
            'vc' => ((int) $entry['vc']) + 1,
            'lv' => time(),
        ]);
    }

    /**
     * Remove word ids from the map. In-memory only - caller saves once.
     * Returns the number of keys actually removed.
     *
     * @param array<int|string> $wordIds
     */
    public function removeWords(array $wordIds): int
    {
        $map = $this->getWordsMap();
        $removed = 0;
        foreach ($wordIds as $wordId) {
            $key = (string) (int) $wordId;
            if (!array_key_exists($key, $map)) {
                continue;
            }
            unset($map[$key]);
            $removed++;
        }
        if ($removed > 0) {
            $this->words = $map;
            $this->total_words = count($map);
        }
        return $removed;
    }

    /**
     * Expand a short-key entry to full field names (the legend is the
     * single source of truth). Unknown keys are dropped; missing keys are
     * filled from EMPTY_ENTRY defaults. Values pass through unchanged
     * (timestamps stay unix seconds).
     */
    public static function expandEntry(array $short): array
    {
        $full = [];
        foreach (self::ENTRY_LEGEND as $shortKey => $fullKey) {
            $value = self::EMPTY_ENTRY[$shortKey];
            if (array_key_exists($shortKey, $short)) {
                $value = $short[$shortKey];
            }
            $full[$fullKey] = $value;
        }
        return $full;
    }

    /**
     * Ported AppQyV1UserWordProgressObserver side effects, applied on every
     * entry mutation:
     *  - first_read_at stamps itself when read_count turns positive;
     *  - next_review_at recomputes whenever proficiency / review_count /
     *    read_count changed.
     */
    public static function normalizeEntry(array $entry, array $touchedKeys): array
    {
        if ((int) $entry['rc'] > 0 && $entry['fr'] === null) {
            $entry['fr'] = time();
        }
        if (in_array('pf', $touchedKeys, true)
            || in_array('vc', $touchedKeys, true)
            || in_array('rc', $touchedKeys, true)) {
            $entry['nr'] = self::computeNextReviewAt((float) $entry['pf']);
        }
        return $entry;
    }

    /**
     * Proficiency-level -> review interval (ported from the legacy
     * calculateNextReviewTime): mastered 30d, learning 7d, struggling 1d.
     * Returns the next review moment as unix seconds.
     */
    public static function computeNextReviewAt(float $proficiency): int
    {
        $level = AppQyV1ProficiencyLevelEnum::fromProficiency($proficiency);
        return time() + ($level->reviewIntervalDays() * 86400);
    }

    /** True when the entry is due for review (nr unset or in the past). */
    public static function entryDueForReview(array $entry, ?int $nowTs = null): bool
    {
        if ($nowTs === null) {
            $nowTs = time();
        }
        if (!isset($entry['nr']) || $entry['nr'] === null) {
            return true;
        }
        return (int) $entry['nr'] <= $nowTs;
    }

    /**
     * Word ids of the map in the canonical stable order. Sort key is
     * [po_is_null asc, po asc, aa asc, word_id asc]: positioned entries
     * (po non-null) lead ordered by their shuffle position, then the
     * legacy/un-positioned entries (po null) follow in added_at (aa) order.
     * When all entries have po null (every non-default group), this reduces
     * to the previous aa-asc / word_id-asc behavior - no regression. This
     * is the pagination order of /group/get_words and the fill order of the
     * recitation today-plan.
     *
     * @return array<int>
     */
    public function orderedWordIds(): array
    {
        $map = $this->getWordsMap();
        $rows = [];
        foreach ($map as $key => $entry) {
            $wordId = (int) $key;
            $aa = 0;
            $po = null;
            $poIsnull = 1;
            if (is_array($entry)) {
                if (isset($entry['aa'])) {
                    $aa = (int) $entry['aa'];
                }
                if (array_key_exists('po', $entry) && $entry['po'] !== null) {
                    $po = (float) $entry['po'];
                    $poIsnull = 0;
                }
            }
            $rows[] = [
                'word_id' => $wordId,
                'po_is_null' => $poIsnull,
                'po' => $po,
                'aa' => $aa,
            ];
        }
        usort($rows, function (array $a, array $b) {
            if ($a['po_is_null'] !== $b['po_is_null']) {
                return $a['po_is_null'] <=> $b['po_is_null'];
            }
            // Both positioned -> compare po; both unpositioned -> po is null
            // on both sides and this branch falls through to aa/word_id.
            if ($a['po_is_null'] === 0 && $a['po'] !== $b['po']) {
                return $a['po'] <=> $b['po'];
            }
            if ($a['aa'] !== $b['aa']) {
                return $a['aa'] <=> $b['aa'];
            }
            return $a['word_id'] <=> $b['word_id'];
        });
        $ids = [];
        foreach ($rows as $row) {
            $ids[] = $row['word_id'];
        }
        return $ids;
    }

    /**
     * One-time random shuffle of the Default Vocabulary Group's word order.
     * If $this->shuffled_at is null AND the words map is non-empty, every
     * entry's po is set to a fresh random float in [0,1), shuffled_at is
     * stamped now() and the row is saved once. Returns true when a shuffle
     * was performed, false otherwise (already shuffled or empty map - no
     * save). Idempotent: the shuffled_at gate guarantees a single shuffle
     * per group across repeated calls. Intended for the read-side ensure
     * hook (getAllGroup / getGroupWords) - callers that already hold a
     * transaction/lock should wrap this themselves; the save() here is a
     * single-row write so the unique group_id index keeps it race-safe.
     */
    public function ensureShuffledOnce(): bool
    {
        if ($this->shuffled_at !== null) {
            return false;
        }
        $map = $this->getWordsMap();
        if (empty($map)) {
            return false;
        }

        foreach ($map as $key => $entry) {
            if (!is_array($entry)) {
                $entry = [];
            }
            // Only stamp still-unpositioned entries; words added via
            // putWords($assignRandomPosition=true) already carry a po and
            // keep it (req: do not disturb existing positions).
            if (array_key_exists('po', $entry) && $entry['po'] !== null) {
                continue;
            }
            $entry['po'] = mt_rand() / mt_getrandmax();
            $map[$key] = $entry;
        }
        $this->words = $map;
        $this->shuffled_at = now();
        $this->save();
        return true;
    }

    /**
     * Read-cycle reset (design: daily reading loop). When EVERY word in the
     * group has been read at least once (the unread_only filter finds
     * nothing), the whole group goes back to unread so the learner starts a
     * fresh pass: rc = 0 and fr = null for every entry, and each entry gets
     * a FRESH random position (po) so the new cycle is shuffled again.
     *
     * Review state is deliberately NOT touched — nr (next_review_at), lv,
     * vc, pf and wt carry over, so the review order/schedule is unaffected
     * by the reset. lr / pt / rpt keep their history (stats stay honest).
     *
     * No-op (returns false) when the map is empty or any word is still
     * unread — the cycle only resets on a completed pass. Single save.
     */
    public function resetReadCycleWhenAllRead(): bool
    {
        $map = $this->getWordsMap();
        if (empty($map)) {
            return false;
        }
        foreach ($map as $entry) {
            if (!is_array($entry) || (int) ($entry['rc'] ?? 0) === 0) {
                return false; // still unread words — cycle not complete
            }
        }
        foreach ($map as $key => $entry) {
            if (!is_array($entry)) {
                $entry = [];
            }
            $entry['rc'] = 0;
            $entry['fr'] = null;
            $entry['po'] = mt_rand() / mt_getrandmax();
            $map[$key] = $entry;
        }
        $this->words = $map;
        $this->save();
        return true;
    }

    /**
     * Record one read of $wordId on the read-action path of
     * /group/update_progress. Reads the current entry (created from
     * EMPTY_ENTRY when missing, aa = now), sets lr = time(), rc = rc+1.
     * When $playTime is a positive number, pt += $playTime and, when this
     * read is a reread (rc was already >= 1 before the bump), rpt += $playTime
     * as well. normalizeEntry(['rc']) then stamps fr / recomputes nr (the
     * ported observer rules). In-memory only - caller saves once. Returns
     * the updated entry.
     */
    public function recordRead(int $wordId, ?float $playTime = null): array
    {
        $map = $this->getWordsMap();
        $key = (string) $wordId;

        $entry = self::EMPTY_ENTRY;
        if (array_key_exists($key, $map) && is_array($map[$key])) {
            $entry = array_merge($entry, $map[$key]);
        } else {
            $entry['aa'] = time();
        }

        // A read is a reread when the word was already read at least once
        // before this event (rc >= 1 prior to the bump).
        $rptAccumulate = ((int) $entry['rc']) >= 1;

        $entry['lr'] = time();
        $entry['rc'] = ((int) $entry['rc']) + 1;

        if ($playTime !== null && $playTime > 0) {
            $entry['pt'] = (float) $entry['pt'] + (float) $playTime;
            if ($rptAccumulate) {
                $entry['rpt'] = (float) $entry['rpt'] + (float) $playTime;
            }
        }

        $entry = self::normalizeEntry($entry, ['rc']);

        $map[$key] = $entry;
        $this->words = $map;
        $this->total_words = count($map);
        return $entry;
    }

    /** language_code as a plain non-empty string ('en' fallback). */
    public function languageCodeValue(): string
    {
        $lang = $this->language_code;
        if (!is_string($lang) || $lang === '') {
            return 'en';
        }
        return strtolower($lang);
    }

    /**
     * Batch-resolve this row's words against the per-language dictionary
     * (one whereIn per chunk via AppQyV1LangDictionaryModel::resolveWordRefs,
     * the shared resolver). Returns word_id => dictionary row; ids missing
     * from the dictionary are absent. Pass $wordIds to resolve a subset
     * (e.g. one page) instead of the whole map.
     *
     * @param array<int>|null $wordIds
     * @return array<int, AppQyV1LangDictionaryModel>
     */
    public function resolveDictionaryRows(?array $wordIds = null): array
    {
        if ($wordIds === null) {
            $wordIds = [];
            foreach (array_keys($this->getWordsMap()) as $key) {
                $wordIds[] = (int) $key;
            }
        }
        if (empty($wordIds)) {
            return [];
        }

        $lang = $this->languageCodeValue();
        $refs = [];
        foreach ($wordIds as $wordId) {
            $refs[] = ['word_id' => (int) $wordId, 'language_code' => $lang];
        }
        $resolved = AppQyV1LangDictionaryModel::resolveWordRefs($refs);

        $byId = [];
        foreach ($wordIds as $wordId) {
            $refKey = $lang . ':' . (int) $wordId;
            if (isset($resolved[$refKey])) {
                $byId[(int) $wordId] = $resolved[$refKey];
            }
        }
        return $byId;
    }
}
