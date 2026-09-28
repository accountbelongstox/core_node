<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Group word progress consolidation - step 2 (data conversion).
 *
 * For every group referenced by group_words / user_word_progress, builds
 * ONE group_word_progress row whose words JSON map covers the distinct
 * union of both tables' word ids for that group:
 *  - a user_word_progress row wins: its progress fields fill the entry
 *    (fr/lr/lv/nr/rc/vc/wt/pf as unix-seconds/int/float short keys);
 *  - aa (added_at) comes from the group_words row when present, falling
 *    back to the progress row's created_at;
 *  - group_words-only words get a fresh entry carrying only {aa}.
 * user_id = word_groups.uid (verified: every progress row matches);
 * a progress row whose user_id differs from the group owner aborts.
 *
 * Per-group verification: map key count must equal the distinct union of
 * both tables' word ids - any mismatch throws and rolls everything back
 * (the whole conversion runs in ONE transaction). Chunked reads, one
 * insert per group. Idempotent: groups that already have a
 * group_word_progress row are skipped, and the migration no-ops when the
 * legacy tables are gone (post ..._160002).
 */
return new class extends Migration
{
    private const READ_CHUNK = 5000;

    protected $connection;
    protected $appKey;
    protected $prefix;

    private array $stats = [
        'groups_converted' => 0,
        'groups_skipped_existing_row' => 0,
        'entries_from_progress' => 0,
        'entries_group_words_only' => 0,
    ];

    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->prefix = AppTablePrefixServiceProvider::getPrefix($this->appKey);
    }

    private function t(string $suffix): string
    {
        return $this->prefix . '_' . $suffix;
    }

    private function toUnix($value): ?int
    {
        if ($value === null) {
            return null;
        }
        $ts = strtotime((string) $value);
        if ($ts === false) {
            return null;
        }
        return $ts;
    }

    public function up(): void
    {
        $schema = Schema::connection($this->connection);

        if (!$schema->hasTable($this->t('group_word_progress'))) {
            throw new RuntimeException('group_word_progress table missing - run AppQyV1_2026_06_12_160000 first');
        }

        if (!$schema->hasTable($this->t('group_words')) || !$schema->hasTable($this->t('user_word_progress'))) {
            echo "[convert] legacy tables already dropped - nothing to convert\n";
            return;
        }

        $db = DB::connection($this->connection);

        $db->transaction(function () use ($db) {
            $groupIds = [];
            foreach ($db->table($this->t('group_words'))->distinct()->pluck('group_id') as $id) {
                $groupIds[(int) $id] = true;
            }
            foreach ($db->table($this->t('user_word_progress'))->whereNotNull('group_id')->distinct()->pluck('group_id') as $id) {
                $groupIds[(int) $id] = true;
            }
            $groupIds = array_keys($groupIds);
            sort($groupIds);

            if (empty($groupIds)) {
                echo "[convert] no group_words/user_word_progress rows - nothing to convert\n";
                return;
            }

            foreach ($groupIds as $groupId) {
                $this->convertGroup($db, $groupId);
            }

            $orphanProgress = $db->table($this->t('user_word_progress'))->whereNull('group_id')->count();
            if ($orphanProgress > 0) {
                throw new RuntimeException("Aborting: {$orphanProgress} user_word_progress rows have NULL group_id and cannot be keyed to a group row");
            }
        });

        echo "[convert] summary:\n";
        foreach ($this->stats as $key => $value) {
            echo "  {$key}: {$value}\n";
        }
    }

    private function convertGroup($db, int $groupId): void
    {
        $group = $db->table($this->t('word_groups'))->where('id', $groupId)->first(['id', 'uid', 'gname', 'language', 'deleted_at']);
        if (!$group) {
            throw new RuntimeException("Aborting: group_words/user_word_progress reference missing word_groups id {$groupId}");
        }

        $existing = $db->table($this->t('group_word_progress'))->where('group_id', $groupId)->first(['id', 'total_words']);
        if ($existing) {
            $this->stats['groups_skipped_existing_row']++;
            echo "[convert] group {$groupId}: row already exists ({$existing->total_words} words) - skipped\n";
            return;
        }

        $map = [];
        $languageCode = null;
        $unionIds = [];

        // group_words first: membership + added_at + language.
        $db->table($this->t('group_words'))
            ->where('group_id', $groupId)
            ->orderBy('id')
            ->chunk(self::READ_CHUNK, function ($rows) use (&$map, &$languageCode, &$unionIds) {
                foreach ($rows as $row) {
                    $key = (string) (int) $row->word_id;
                    $unionIds[$key] = true;
                    if ($languageCode === null && $row->language_code !== null && $row->language_code !== '') {
                        $languageCode = strtolower((string) $row->language_code);
                    }
                    if (isset($map[$key])) {
                        continue;
                    }
                    $map[$key] = [
                        'fr' => null,
                        'lr' => null,
                        'lv' => null,
                        'nr' => null,
                        'rc' => 0,
                        'vc' => 0,
                        'wt' => 0,
                        'pf' => 0,
                        'aa' => $this->toUnix($row->added_at),
                    ];
                    $this->stats['entries_group_words_only']++;
                }
            });

        // user_word_progress wins: overwrite progress fields, keep aa from
        // group_words when present.
        $groupUid = (int) $group->uid;
        $progressCount = 0;
        $db->table($this->t('user_word_progress'))
            ->where('group_id', $groupId)
            ->orderBy('id')
            ->chunk(self::READ_CHUNK, function ($rows) use (&$map, &$languageCode, &$unionIds, &$progressCount, $groupUid, $groupId) {
                foreach ($rows as $row) {
                    if ((int) $row->user_id !== $groupUid) {
                        throw new RuntimeException("Aborting: user_word_progress row {$row->id} (group {$groupId}) belongs to user {$row->user_id} but the group owner is {$groupUid}");
                    }
                    $key = (string) (int) $row->word_id;
                    $unionIds[$key] = true;
                    if ($languageCode === null && $row->language_code !== null && $row->language_code !== '') {
                        $languageCode = strtolower((string) $row->language_code);
                    }
                    $aa = null;
                    if (isset($map[$key])) {
                        $aa = $map[$key]['aa'];
                        $this->stats['entries_group_words_only']--;
                    }
                    if ($aa === null) {
                        $aa = $this->toUnix($row->created_at);
                    }
                    $map[$key] = [
                        'fr' => $this->toUnix($row->first_read_at),
                        'lr' => $this->toUnix($row->last_read_at),
                        'lv' => $this->toUnix($row->last_review_at),
                        'nr' => $this->toUnix($row->next_review_at),
                        'rc' => (int) $row->read_count,
                        'vc' => (int) $row->review_count,
                        'wt' => (int) $row->weight,
                        'pf' => (float) $row->proficiency,
                        'aa' => $aa,
                    ];
                    $progressCount++;
                    $this->stats['entries_from_progress']++;
                }
            });

        // Verify: map keys == distinct union of both tables' word ids.
        $distinctUnion = count($unionIds);
        if (count($map) !== $distinctUnion) {
            throw new RuntimeException("Verify failed: group {$groupId} map has " . count($map) . " keys but the distinct union is {$distinctUnion}");
        }
        $gwDistinct = (int) $db->table($this->t('group_words'))->where('group_id', $groupId)->distinct()->count('word_id');
        $upDistinct = (int) $db->table($this->t('user_word_progress'))->where('group_id', $groupId)->distinct()->count('word_id');
        if (count($map) < $gwDistinct || count($map) < $upDistinct) {
            throw new RuntimeException("Verify failed: group {$groupId} map " . count($map) . " keys < per-table distinct counts (gw {$gwDistinct}, up {$upDistinct})");
        }

        if ($languageCode === null) {
            $languageCode = strtolower((string) $group->language);
        }
        if ($languageCode === '') {
            $languageCode = 'en';
        }

        $now = now();
        $db->table($this->t('group_word_progress'))->insert([
            'user_id' => $groupUid,
            'group_id' => $groupId,
            'language_code' => $languageCode,
            'words' => json_encode($map),
            'total_words' => count($map),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $this->stats['groups_converted']++;
        echo "[convert] group {$groupId} '{$group->gname}' (uid {$groupUid}, lang {$languageCode}): "
            . count($map) . " words (gw_distinct {$gwDistinct}, up_distinct {$upDistinct}, progress rows {$progressCount}) -> 1 row\n";
    }

    public function down(): void
    {
        // One-way by design: the legacy tables stay intact until
        // AppQyV1_2026_06_12_160002, so no destructive rollback here.
    }
};
