<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Group;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1GroupWordProgressModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1LanguageConfigService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1WordMediaService;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1WordGroupPublicController as DGroupAPublic;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Traits\ApiResponse;

class AppQyV1WordGroupWordController
{
    use ApiResponse;

    /**
     * Normalized 2-letter language code of a group ('en' default): selects
     * the dictionary table the group's word_id values belong to.
     */
    private static function resolveGroupLanguageCode(AppQyV1WordGroupModel $group): string
    {
        $languageCode = $group->language;
        if ($languageCode) {
            $languageCode = AppQyV1LanguageConfigService::normalizeToCode($languageCode);
        }
        if (!is_string($languageCode) || $languageCode === '') {
            $languageCode = 'en';
        }
        return $languageCode;
    }

    public function addWordToGroup(Request $request): JsonResponse
    {
        $supported_params = ['gid', 'word_id', 'word_ids'];

        $validator = Validator::make($request->all(), [
            'gid' => 'required|string',
            'word_id' => 'required_without:word_ids|integer',
            'word_ids' => 'required_without:word_id|array',
            'word_ids.*' => 'integer',
        ]);

        if ($validator->fails()) {
            return $this->error($validator->errors()->first(), 400, [
                'supported_params' => $supported_params,
            ]);
        }

        $user = Auth::user();
        if (!$user) {
            return $this->unauthorized('Authentication required');
        }

        $gid = $request->input('gid');
        $wordId = $request->input('word_id');
        $wordIds = $request->input('word_ids', []);

        if ($wordId) {
            $wordIds = [$wordId];
        }

        $group = AppQyV1WordGroupModel::where('gid', $gid)
            ->where('uid', $user->id)
            ->first();

        if (!$group) {
            return $this->error('Group not found', 404, [
                'supported_params' => $supported_params,
            ]);
        }

        return DB::connection(AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1))->transaction(function () use ($group, $wordIds, $user) {
            // Serialize concurrent membership writes for the same group: the
            // group row lock plus the single-row JSON write keep the merge
            // race-safe (the progress row is keyed by the same group).
            AppQyV1WordGroupModel::where('id', $group->id)
                ->lockForUpdate()
                ->first();

            $languageCode = self::resolveGroupLanguageCode($group);
            $progressRow = AppQyV1GroupWordProgressModel::forUserGroup($user->id, $group->id, $languageCode);

            // Membership check = array_key_exists on the JSON map.
            $wordsMap = $progressRow->getWordsMap();
            $wordsToAdd = [];
            $skippedCount = 0;
            foreach ($wordIds as $wId) {
                if (array_key_exists((string) (int) $wId, $wordsMap)) {
                    $skippedCount++;
                    continue;
                }
                $wordsToAdd[] = (int) $wId;
            }

            if (empty($wordsToAdd)) {
                return $this->success([
                    'gid' => $group->gid,
                    'words_added' => 0,
                    'words_skipped' => $skippedCount,
                    'total_requested' => count($wordIds),
                ], 'No new words to add');
            }

            // word_id values are dictionary ids (tts_cache_{lang}); the
            // group's language (single language per group) selects the table.
            $weights = [];
            $validIds = [];
            $rows = AppQyV1LangDictionaryModel::forLanguage($languageCode)
                ->whereIn('id', $wordsToAdd)
                ->get(['id', 'content']);
            foreach ($rows as $row) {
                $validIds[] = (int) $row->id;
                $weights[(int) $row->id] = strlen((string) $row->content);
            }
            $skippedCount += count($wordsToAdd) - count($validIds);

            // Single JSON merge: one row update, no per-word inserts.
            // New words added to the Default Vocabulary Group get a random
            // position (po) so they interleave among the already-positioned
            // words without re-shuffling the existing order (design §5.4).
            $assignRandomPosition = ($group->gname === DGroupAPublic::$default_group_name);
            $addedCount = $progressRow->putWords($validIds, (string) now(), $weights, $assignRandomPosition);
            if ($addedCount > 0) {
                $progressRow->save();
            }

            return $this->success([
                'gid' => $group->gid,
                'words_added' => $addedCount,
                'words_skipped' => $skippedCount,
                'total_requested' => count($wordIds),
            ], 'Words added to group successfully');
        });
    }

    public function removeWordFromGroup(Request $request): JsonResponse
    {
        $supported_params = ['gid', 'word_id', 'word_ids'];

        $validator = Validator::make($request->all(), [
            'gid' => 'required|string',
            'word_id' => 'required_without:word_ids|integer',
            'word_ids' => 'required_without:word_id|array',
            'word_ids.*' => 'integer',
        ]);

        if ($validator->fails()) {
            return $this->error($validator->errors()->first(), 400, [
                'supported_params' => $supported_params,
            ]);
        }

        $user = Auth::user();
        if (!$user) {
            return $this->unauthorized('Authentication required');
        }

        $gid = $request->input('gid');
        $wordId = $request->input('word_id');
        $wordIds = $request->input('word_ids', []);

        if ($wordId) {
            $wordIds = [$wordId];
        }

        $group = AppQyV1WordGroupModel::where('gid', $gid)
            ->where('uid', $user->id)
            ->first();

        if (!$group) {
            return $this->error('Group not found', 404, [
                'supported_params' => $supported_params,
            ]);
        }

        return DB::connection(AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1))->transaction(function () use ($group, $wordIds) {
            $progressRow = AppQyV1GroupWordProgressModel::lockForGroup($group->id);

            $removedCount = 0;
            if ($progressRow) {
                $removedCount = $progressRow->removeWords($wordIds);
                if ($removedCount > 0) {
                    $progressRow->save();
                }
            }

            return $this->success([
                'gid' => $group->gid,
                'words_removed' => $removedCount,
                'total_requested' => count($wordIds),
            ], 'Words removed from group successfully');
        });
    }

    public function getGroupWords(Request $request): JsonResponse
    {
        $supported_params = ['gid', 'page', 'per_page', 'with_progress', 'unread_only', 'limit'];

        $validator = Validator::make($request->all(), [
            'gid' => 'required|string',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
            'with_progress' => 'nullable|boolean',
            'unread_only' => 'nullable|boolean',
            'limit' => 'nullable|integer|min:0',
        ]);

        if ($validator->fails()) {
            return $this->error($validator->errors()->first(), 400, [
                'supported_params' => $supported_params,
            ]);
        }

        $user = Auth::user();
        if (!$user) {
            return $this->unauthorized('Authentication required');
        }

        $gid = $request->input('gid');
        $page = $request->input('page', 1);
        $perPage = $request->input('per_page', 50);
        $withProgress = $request->input('with_progress', false);
        $unreadOnly = (bool) $request->input('unread_only', false);
        $limit = (int) $request->input('limit', 0);

        $group = AppQyV1WordGroupModel::where('gid', $gid)
            ->where('uid', $user->id)
            ->first();

        if (!$group) {
            return $this->error('Group not found', 404, [
                'supported_params' => $supported_params,
            ]);
        }

        // ONE row read: the whole membership + progress map.
        $progressRow = AppQyV1GroupWordProgressModel::where('group_id', $group->id)->first();

        // For the Default Vocabulary Group, ensure the one-time shuffle has
        // been applied before reading the order (design §5.3 R2). Wrapped
        // so a shuffle failure never breaks the word listing.
        if ($progressRow && $group->gname === DGroupAPublic::$default_group_name) {
            try {
                $progressRow->ensureShuffledOnce();
            } catch (\Throwable $e) {
                // Shuffle is best-effort; the listing must still return.
            }
        }

        $wordsMap = [];
        $totalCount = 0;
        $orderedIds = [];
        $languageCode = self::resolveGroupLanguageCode($group);
        if ($progressRow) {
            $wordsMap = $progressRow->getWordsMap();
            $totalCount = count($wordsMap);
            // Stable pagination order: po (positioned first) then aa then
            // word_id (see AppQyV1GroupWordProgressModel::orderedWordIds).
            $orderedIds = $progressRow->orderedWordIds();
            $languageCode = $progressRow->languageCodeValue();
        }

        // Unread filter (design §5.5 R4): keep only ids whose entry has
        // rc == 0 (fr === null / never read). Applied BEFORE the limit cap
        // and BEFORE pagination slicing so the daily-goal set is the unread
        // set in shuffled order.
        if ($unreadOnly) {
            $filtered = [];
            foreach ($orderedIds as $orderedId) {
                $rc = 0;
                $key = (string) $orderedId;
                if (array_key_exists($key, $wordsMap) && is_array($wordsMap[$key]) && isset($wordsMap[$key]['rc'])) {
                    $rc = (int) $wordsMap[$key]['rc'];
                }
                if ($rc === 0) {
                    $filtered[] = $orderedId;
                }
            }
            $orderedIds = $filtered;
            $totalCount = count($orderedIds);

            // Read-cycle reset: the daily plan keeps going after the planned
            // amount — the client pages through ALL unread words; when every
            // word has been read once, the backend resets the whole group to
            // unread in a FRESH shuffled order (review schedule untouched)
            // and this very request already returns the new cycle's first
            // page. Wrapped so a reset failure just yields an empty page.
            if ($totalCount === 0 && !empty($wordsMap)) {
                try {
                    if ($progressRow->resetReadCycleWhenAllRead()) {
                        $wordsMap = $progressRow->getWordsMap();
                        $orderedIds = $progressRow->orderedWordIds();
                        $totalCount = count($orderedIds);
                    }
                } catch (\Throwable $e) {
                    // Reset is best-effort; an empty page simply ends the cycle.
                }
            }
        }

        // Daily-goal cap (design §5.5 R4): $limit > 0 caps the returned
        // ordered set BEFORE pagination slicing.
        if ($limit > 0 && count($orderedIds) > $limit) {
            $orderedIds = array_slice($orderedIds, 0, $limit);
            $totalCount = count($orderedIds);
        }

        $offset = ($page - 1) * $perPage;
        $pageIds = array_slice($orderedIds, $offset, $perPage);

        // word_id is a dictionary id: resolve the page's words with one
        // whereIn (resolveWordRefs, the shared resolver).
        $resolved = [];
        if ($progressRow && !empty($pageIds)) {
            $resolved = $progressRow->resolveDictionaryRows($pageIds);
        }

        // Reuse the word-media pipeline's file-first audio resolver so audio_url
        // matches the GET /word/{lang}/{word}/media endpoint exactly (only emitted
        // when the audio file is on disk; '' otherwise — never a broken path).
        $mediaService = new AppQyV1WordMediaService();

        $words = [];
        $position = 0;
        foreach ($pageIds as $pageWordId) {
            $entry = AppQyV1GroupWordProgressModel::EMPTY_ENTRY;
            $stored = $wordsMap[(string) $pageWordId];
            if (is_array($stored)) {
                $entry = array_merge($entry, $stored);
            }

            // Card/quiz fields come from the resolved dictionary row (already
            // loaded above); empty string when the row or a field is absent.
            $wordText = null;
            $translation = '';
            $phonetic = '';
            $audioUrl = '';
            $audioFiles = [];
            $definition = '';
            if (isset($resolved[$pageWordId])) {
                $row = $resolved[$pageWordId];
                $wordText = $row->content;

                // Primary display translation (real target only; '' when none).
                $translation = self::primaryTranslation($row);

                // Single display phonetic: prefer US, then UK, then generic.
                if (is_string($row->us_phonetic) && $row->us_phonetic !== '') {
                    $phonetic = $row->us_phonetic;
                } elseif (is_string($row->uk_phonetic) && $row->uk_phonetic !== '') {
                    $phonetic = $row->uk_phonetic;
                } elseif (is_string($row->phonetic) && $row->phonetic !== '') {
                    $phonetic = $row->phonetic;
                }

                // File-first audio URL (word-media pipeline); '' when nothing on disk.
                $resolvedAudio = $mediaService->resolveAudioUrl($row);
                if (is_string($resolvedAudio) && $resolvedAudio !== '') {
                    $audioUrl = $resolvedAudio;
                }

                // Every on-disk audio variant (per-voice player + count). Same
                // canonical shape the GET /word/{lang}/{word}/media endpoint emits.
                $audioFiles = $mediaService->audioVariantsForApi($row, $languageCode);

                // Explanation/definition from word_details json, composed from the
                // translation pairs when word_details.explanation is empty.
                $definition = self::wordDefinition($row);
            }

            $addedAt = null;
            if ($entry['aa'] !== null) {
                $addedAt = Carbon::createFromTimestamp((int) $entry['aa']);
            }

            $data = [
                'word_id' => $pageWordId,
                'word' => $wordText,
                'translation' => $translation,
                'has_translation' => $translation !== '',
                'phonetic' => $phonetic,
                'audio_url' => $audioUrl,
                'audio_files' => $audioFiles,
                'audio_count' => count($audioFiles),
                'definition' => $definition,
                // Stable position within the group's word list (derived from
                // the canonical aa-then-word_id order).
                'word_index' => $offset + $position,
                'language_code' => $languageCode,
                'added_at' => $addedAt,
            ];
            $position++;

            if ($withProgress) {
                $lastReadAt = null;
                if ($entry['lr'] !== null) {
                    $lastReadAt = Carbon::createFromTimestamp((int) $entry['lr']);
                }
                $nextReviewAt = null;
                if ($entry['nr'] !== null) {
                    $nextReviewAt = Carbon::createFromTimestamp((int) $entry['nr']);
                }
                $data['proficiency'] = (float) $entry['pf'];
                $data['read_count'] = (int) $entry['rc'];
                $data['review_count'] = (int) $entry['vc'];
                $data['last_read_at'] = $lastReadAt;
                $data['next_review_at'] = $nextReviewAt;
            }

            $words[] = $data;
        }

        return $this->success([
            'gid' => $group->gid,
            'gname' => $group->gname,
            'total_words' => $totalCount,
            'page' => $page,
            'per_page' => $perPage,
            'words' => $words,
        ], 'Group words retrieved successfully');
    }

    /**
     * Legacy metadata keys inside the translations json that are NOT target
     * translations: the top-level 'word' holds the SOURCE headword, the rest are
     * dictionary metadata. Excluded from every translation scan so the headword
     * never leaks out as a translation. Mirrors
     * AppQyV1WordMediaService::TRANSLATION_META_KEYS.
     */
    private const TRANSLATION_META_KEYS = [
        'word',
        'word_translation',
        'plural_form',
        'synonyms',
        'synonyms_type',
        'advanced_translate',
        'advanced_translate_type',
        'phonetic_symbol',
        'voice_files',
    ];

    /**
     * Primary display translation for a dictionary row: the REAL target meaning,
     * never the source headword, and '' when the row has no real translation.
     *
     *  1) Nested word_translation pairs (pair[1] = target meaning): first
     *     non-empty pair[1] that differs from the source headword ($row->content).
     *  2) Flat scalar target values, EXCLUDING the legacy metadata keys and any
     *     value equal (case-insensitive) to the headword; language-code-like keys
     *     preferred.
     *  3) '' when nothing qualifies.
     *
     * Mirrors AppQyV1WordMediaService::extractTranslations' selection rules.
     */
    private static function primaryTranslation(AppQyV1LangDictionaryModel $row): string
    {
        $translations = $row->translations;
        if (!is_array($translations)) {
            return '';
        }

        $content = (string) $row->content;

        if (isset($translations['word_translation']) && is_array($translations['word_translation'])) {
            foreach ($translations['word_translation'] as $pair) {
                if (is_array($pair) && isset($pair[1]) && is_string($pair[1]) && $pair[1] !== ''
                    && strcasecmp($pair[1], $content) !== 0) {
                    return $pair[1];
                }
            }
        }

        $preferred = '';
        $fallback = '';
        foreach ($translations as $key => $value) {
            if (!is_string($value) || $value === '') {
                continue;
            }
            if (in_array($key, self::TRANSLATION_META_KEYS, true)) {
                continue;
            }
            if (strcasecmp($value, $content) === 0) {
                continue;
            }
            if (self::looksLikeLanguageCode((string) $key)) {
                if ($preferred === '') {
                    $preferred = $value;
                }
            } elseif ($fallback === '') {
                $fallback = $value;
            }
        }

        if ($preferred !== '') {
            return $preferred;
        }
        return $fallback;
    }

    /**
     * Explanation/definition string for the row. Prefers word_details.explanation;
     * when empty, COMPOSES one from the translations json (word_translation pairs,
     * else advanced_translate). '' when truly nothing.
     * Mirrors AppQyV1WordMediaService::extractExplanation.
     */
    private static function wordDefinition(AppQyV1LangDictionaryModel $row): string
    {
        $details = $row->word_details;
        if (is_array($details) && isset($details['explanation']) && is_string($details['explanation']) && $details['explanation'] !== '') {
            return $details['explanation'];
        }
        return self::composeDefinition($row);
    }

    /**
     * Compose a definition from the translations json when word_details has none:
     * join the word_translation pairs as "pair[0] pair[1]" with ' / ', else fall
     * back to advanced_translate. '' when nothing usable.
     * Mirrors AppQyV1WordMediaService::composeDefinition.
     */
    private static function composeDefinition(AppQyV1LangDictionaryModel $row): string
    {
        $translations = $row->translations;
        if (!is_array($translations)) {
            return '';
        }

        if (isset($translations['word_translation']) && is_array($translations['word_translation'])) {
            $parts = [];
            foreach ($translations['word_translation'] as $pair) {
                if (!is_array($pair)) {
                    continue;
                }
                $meaning = isset($pair[1]) && is_string($pair[1]) ? trim($pair[1]) : '';
                if ($meaning === '') {
                    continue;
                }
                $tag = isset($pair[0]) && is_string($pair[0]) ? trim($pair[0]) : '';
                $parts[] = $tag !== '' ? ($tag . ' ' . $meaning) : $meaning;
            }
            if (!empty($parts)) {
                return implode(' / ', array_values(array_unique($parts)));
            }
        }

        $advanced = $translations['advanced_translate'] ?? null;
        if (is_string($advanced) && trim($advanced) !== '') {
            return trim($advanced);
        }
        if (is_array($advanced)) {
            $parts = [];
            foreach ($advanced as $item) {
                if (is_string($item) && trim($item) !== '') {
                    $parts[] = trim($item);
                } elseif (is_array($item)) {
                    $text = isset($item[1]) && is_string($item[1]) ? trim($item[1])
                        : (isset($item[0]) && is_string($item[0]) ? trim($item[0]) : '');
                    if ($text !== '') {
                        $parts[] = $text;
                    }
                }
            }
            if (!empty($parts)) {
                return implode(' / ', array_values(array_unique($parts)));
            }
        }

        return '';
    }

    /**
     * Whether a translations-json key looks like a language code (e.g. 'zh',
     * 'en-us') rather than a descriptive metadata key. Used to prefer real
     * target-code entries over other scalars when picking the single primary
     * translation.
     */
    private static function looksLikeLanguageCode(string $key): bool
    {
        return preg_match('/^[A-Za-z]{2,3}([_-][A-Za-z0-9]{2,4})?$/', $key) === 1;
    }
}
