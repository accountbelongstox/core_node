<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Group;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1GroupWordProgressModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1LanguageConfigService;
use App\Traits\ApiResponse;

class AppQyV1WordGroupProgressController
{
    use ApiResponse;

    /**
     * Normalized 2-letter language code of a group ('en' default).
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

    /** Unix seconds (entry short-key value) -> Carbon|null for responses. */
    private static function tsToCarbon($ts): ?Carbon
    {
        if ($ts === null) {
            return null;
        }
        return Carbon::createFromTimestamp((int) $ts);
    }

    /** Legacy progress response block built from a short-key entry. */
    private static function entryToProgressArray(array $entry): array
    {
        return [
            'read_count' => (int) $entry['rc'],
            'review_count' => (int) $entry['vc'],
            'proficiency' => (float) $entry['pf'],
            'next_review_at' => self::tsToCarbon($entry['nr']),
            'last_read_at' => self::tsToCarbon($entry['lr']),
            'last_review_at' => self::tsToCarbon($entry['lv']),
            // Design §5.5 R4 word mapping table fields: cumulative play
            // time (pt) and reread time (rpt) in seconds.
            'play_time' => (float) $entry['pt'],
            'reread_time' => (float) $entry['rpt'],
        ];
    }

    /**
     * POST /group/update_progress
     *
     * Legacy single shape: {gid, word_id, action: read|review,
     * proficiency?, is_correct?} - response unchanged.
     * Batch shape: {gid, updates: [{word_id, action, correct?, play_time?}]}.
     * Missing action preserves the legacy review-outcome contract. Either
     * shape performs one JSON write.
     */
    public function updateProgress(Request $request): JsonResponse
    {
        $supported_params = ['gid', 'word_id', 'action', 'proficiency', 'is_correct', 'play_time', 'updates'];

        $validator = Validator::make($request->all(), [
            'gid' => 'required|string',
            'word_id' => 'required_without:updates|integer',
            'action' => 'required_without:updates|in:read,review',
            'proficiency' => 'nullable|numeric|min:0|max:100',
            'is_correct' => 'nullable|boolean',
            'play_time' => 'nullable|numeric|min:0',
            'updates' => 'sometimes|array|min:1',
            'updates.*.word_id' => 'required_with:updates|integer',
            'updates.*.action' => 'nullable|in:read,review',
            'updates.*.correct' => 'required_unless:updates.*.action,read|boolean',
            'updates.*.play_time' => 'nullable|numeric|min:0',
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

        $group = AppQyV1WordGroupModel::where('gid', $gid)
            ->where('uid', $user->id)
            ->first();

        if (!$group) {
            return $this->error('Group not found', 404, [
                'supported_params' => $supported_params,
            ]);
        }

        if ($request->has('updates')) {
            return $this->applyBatchUpdates($request, $group, $user->id, $supported_params);
        }

        return $this->applySingleUpdate($request, $group, $user->id, $supported_params);
    }

    private function applySingleUpdate(Request $request, AppQyV1WordGroupModel $group, int $userId, array $supported_params): JsonResponse
    {
        $wordId = (int) $request->input('word_id');
        $action = $request->input('action');
        $proficiency = $request->input('proficiency');
        $isCorrect = $request->input('is_correct');
        $playTime = $request->input('play_time');
        if ($playTime !== null) {
            $playTime = (float) $playTime;
        }

        return AppQyV1WordGroupModel::runInTransaction(function () use ($group, $userId, $wordId, $action, $proficiency, $isCorrect, $playTime, $supported_params) {
            $languageCode = self::resolveGroupLanguageCode($group);
            $progressRow = AppQyV1GroupWordProgressModel::forUserGroup($userId, $group->id, $languageCode);
            $locked = AppQyV1GroupWordProgressModel::lockForGroup($group->id);
            if ($locked) {
                $progressRow = $locked;
            }

            // Auto-enroll an unknown word only when it resolves in the
            // group's dictionary (legacy created the progress row the same
            // way, weight = word length).
            if (!$progressRow->hasWord($wordId)) {
                $word = AppQyV1LangDictionaryModel::forLanguage($progressRow->languageCodeValue())->find($wordId);
                if (!$word) {
                    return $this->error('Word not found', 404, [
                        'supported_params' => $supported_params,
                    ]);
                }
                $progressRow->putWords([$wordId], (string) now(), [$wordId => strlen((string) $word->content)]);
            }

            // Read path: recordRead handles the lr/rc bump, optional pt/rpt
            // accumulation, and the fr/nr normalize side effects (design
            // §5.5 R4). Review path keeps the lv/vc/pf patch via
            // updateWordProgress.
            if ($action === 'read') {
                $entry = $progressRow->recordRead($wordId, $playTime);
                // Optional proficiency override (sentinel value, not typical
                // for read actions); apply after recordRead so it wins.
                if ($proficiency !== null) {
                    $entry = $progressRow->updateWordProgress($wordId, ['pf' => (float) $proficiency]);
                }
            } else {
                $map = $progressRow->getWordsMap();
                $entry = array_merge(AppQyV1GroupWordProgressModel::EMPTY_ENTRY, $map[(string) $wordId]);

                $patch = [
                    'lv' => time(),
                    'vc' => ((int) $entry['vc']) + 1,
                ];

                if ($isCorrect !== null) {
                    $newProficiency = (float) $entry['pf'];
                    if ($isCorrect) {
                        $newProficiency = min(100, $newProficiency + 5);
                    } else {
                        $newProficiency = max(0, $newProficiency - 10);
                    }
                    $patch['pf'] = $newProficiency;
                }

                if ($proficiency !== null) {
                    $patch['pf'] = (float) $proficiency;
                }

                // updateWordProgress normalizes the entry (first_read_at stamp +
                // next_review_at recompute - the ported observer rules).
                $entry = $progressRow->updateWordProgress($wordId, $patch);
            }

            $progressRow->save();

            return $this->success([
                'gid' => $group->gid,
                'word_id' => $wordId,
                'action' => $action,
                'progress' => self::entryToProgressArray($entry),
            ], 'Progress updated successfully');
        });
    }

    private function applyBatchUpdates(Request $request, AppQyV1WordGroupModel $group, int $userId, array $supported_params): JsonResponse
    {
        $updates = $request->input('updates');

        return AppQyV1WordGroupModel::runInTransaction(function () use ($group, $userId, $updates) {
            $languageCode = self::resolveGroupLanguageCode($group);
            $progressRow = AppQyV1GroupWordProgressModel::forUserGroup($userId, $group->id, $languageCode);
            $locked = AppQyV1GroupWordProgressModel::lockForGroup($group->id);
            if ($locked) {
                $progressRow = $locked;
            }

            // Auto-enroll unknown words in ONE dictionary whereIn.
            $unknownIds = [];
            foreach ($updates as $update) {
                $batchWordId = (int) $update['word_id'];
                if (!$progressRow->hasWord($batchWordId)) {
                    $unknownIds[$batchWordId] = true;
                }
            }
            if (!empty($unknownIds)) {
                $weights = [];
                $foundIds = [];
                $rows = AppQyV1LangDictionaryModel::forLanguage($progressRow->languageCodeValue())
                    ->whereIn('id', array_keys($unknownIds))
                    ->get(['id', 'content']);
                foreach ($rows as $row) {
                    $foundIds[] = (int) $row->id;
                    $weights[(int) $row->id] = strlen((string) $row->content);
                }
                if (!empty($foundIds)) {
                    $progressRow->putWords($foundIds, (string) now(), $weights);
                }
            }

            $updated = 0;
            $skipped = 0;
            $reads = 0;
            $reviews = 0;
            $progressByWordId = [];
            foreach ($updates as $update) {
                $batchWordId = (int) $update['word_id'];
                if (!$progressRow->hasWord($batchWordId)) {
                    $skipped++;
                    continue;
                }
                $batchAction = $update['action'] ?? 'review';
                if ($batchAction === 'read') {
                    $playTime = isset($update['play_time']) ? (float) $update['play_time'] : null;
                    $entry = $progressRow->recordRead($batchWordId, $playTime);
                    $reads++;
                } else {
                    $entry = $progressRow->applyReviewResult($batchWordId, (bool) $update['correct']);
                    $reviews++;
                }
                $progressByWordId[$batchWordId] = self::entryToProgressArray($entry);
                $updated++;
            }

            // ONE JSON write for the whole batch.
            $progressRow->save();

            return $this->success([
                'gid' => $group->gid,
                'batch' => true,
                'updated' => $updated,
                'skipped' => $skipped,
                'reads' => $reads,
                'reviews' => $reviews,
                'progress' => $progressByWordId,
            ], 'Progress batch updated successfully');
        });
    }

    public function getReviewWords(Request $request): JsonResponse
    {
        $supported_params = ['gid', 'limit', 'proficiency_max'];

        $validator = Validator::make($request->all(), [
            'gid' => 'required|string',
            'limit' => 'nullable|integer|min:1|max:100',
            'proficiency_max' => 'nullable|numeric|min:0|max:100',
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
        $limit = $request->input('limit', 20);
        $proficiencyMax = $request->input('proficiency_max');

        $group = AppQyV1WordGroupModel::where('gid', $gid)
            ->where('uid', $user->id)
            ->first();

        if (!$group) {
            return $this->error('Group not found', 404, [
                'supported_params' => $supported_params,
            ]);
        }

        $progressRow = AppQyV1GroupWordProgressModel::where('group_id', $group->id)->first();

        $candidates = [];
        if ($progressRow) {
            $nowTs = time();
            foreach ($progressRow->getWordsMap() as $key => $stored) {
                $entry = AppQyV1GroupWordProgressModel::EMPTY_ENTRY;
                if (is_array($stored)) {
                    $entry = array_merge($entry, $stored);
                }
                if (!AppQyV1GroupWordProgressModel::entryDueForReview($entry, $nowTs)) {
                    continue;
                }
                if ($proficiencyMax !== null && (float) $entry['pf'] > (float) $proficiencyMax) {
                    continue;
                }
                $candidates[] = [(int) $key, $entry];
            }

            // Same priority as the legacy query: proficiency ASC, weight DESC
            // (word_id ASC as the deterministic tie-break).
            usort($candidates, function (array $a, array $b) {
                $pfCompare = (float) $a[1]['pf'] <=> (float) $b[1]['pf'];
                if ($pfCompare !== 0) {
                    return $pfCompare;
                }
                $wtCompare = (int) $b[1]['wt'] <=> (int) $a[1]['wt'];
                if ($wtCompare !== 0) {
                    return $wtCompare;
                }
                return $a[0] <=> $b[0];
            });

            $candidates = array_slice($candidates, 0, (int) $limit);
        }

        $resolved = [];
        if ($progressRow && !empty($candidates)) {
            $candidateIds = [];
            foreach ($candidates as $candidate) {
                $candidateIds[] = $candidate[0];
            }
            $resolved = $progressRow->resolveDictionaryRows($candidateIds);
        }

        $words = [];
        foreach ($candidates as $candidate) {
            $candidateWordId = $candidate[0];
            $entry = $candidate[1];

            $wordText = null;
            if (isset($resolved[$candidateWordId])) {
                $wordText = $resolved[$candidateWordId]->content;
            }

            $words[] = [
                // No per-word row id remains - word_id is the stable
                // identifier (kept under the legacy progress_id key).
                'progress_id' => $candidateWordId,
                'word_id' => $candidateWordId,
                'word' => $wordText,
                'word_index' => null,
                'proficiency' => (float) $entry['pf'],
                'read_count' => (int) $entry['rc'],
                'review_count' => (int) $entry['vc'],
                'last_review_at' => self::tsToCarbon($entry['lv']),
                'next_review_at' => self::tsToCarbon($entry['nr']),
                'weight' => (int) $entry['wt'],
            ];
        }

        return $this->success([
            'gid' => $group->gid,
            'gname' => $group->gname,
            'review_words_count' => count($words),
            'words' => $words,
        ], 'Review words retrieved successfully');
    }

    public function getProgressStats(Request $request): JsonResponse
    {
        $supported_params = ['gid'];

        $validator = Validator::make($request->all(), [
            'gid' => 'required|string',
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

        $group = AppQyV1WordGroupModel::where('gid', $gid)
            ->where('uid', $user->id)
            ->first();

        if (!$group) {
            return $this->error('Group not found', 404, [
                'supported_params' => $supported_params,
            ]);
        }

        $progressRow = AppQyV1GroupWordProgressModel::where('group_id', $group->id)->first();

        // Aggregate the JSON map in PHP (one row read; shape unchanged).
        $entryCount = 0;
        $proficiencySum = 0.0;
        $totalReads = 0;
        $totalReviews = 0;
        $masteredWords = 0;
        $learningWords = 0;
        $strugglingWords = 0;
        $dueForReview = 0;
        $nowTs = time();

        if ($progressRow) {
            foreach ($progressRow->getWordsMap() as $stored) {
                $entry = AppQyV1GroupWordProgressModel::EMPTY_ENTRY;
                if (is_array($stored)) {
                    $entry = array_merge($entry, $stored);
                }
                $entryCount++;
                $pf = (float) $entry['pf'];
                $proficiencySum += $pf;
                $totalReads += (int) $entry['rc'];
                $totalReviews += (int) $entry['vc'];
                if ($pf >= 90) {
                    $masteredWords++;
                } elseif ($pf >= 60) {
                    $learningWords++;
                } else {
                    $strugglingWords++;
                }
                if (AppQyV1GroupWordProgressModel::entryDueForReview($entry, $nowTs)) {
                    $dueForReview++;
                }
            }
        }

        $avgProficiency = 0.0;
        if ($entryCount > 0) {
            $avgProficiency = $proficiencySum / $entryCount;
        }

        // Group total = gwords JSON words + the progress map (library
        // word-ID memberships). Disjoint sources, both count.
        $gwords = $group->getWordsArray();
        $gwordsCount = 0;
        if (is_array($gwords)) {
            $gwordsCount = count($gwords);
        }

        return $this->success([
            'gid' => $group->gid,
            'gname' => $group->gname,
            'stats' => [
                'total_words' => $gwordsCount + $entryCount,
                'avg_proficiency' => round($avgProficiency, 2),
                'total_reads' => $totalReads,
                'total_reviews' => $totalReviews,
                'mastered_words' => $masteredWords,
                'learning_words' => $learningWords,
                'struggling_words' => $strugglingWords,
                'due_for_review' => $dueForReview,
            ],
        ], 'Progress stats retrieved successfully');
    }

    /**
     * POST /group/get_progress_blob {gid}
     *
     * The whole per-group progress map in ONE row read - the FE computes
     * stats client-side from this (no 65k bind limits, no joins). words is
     * the raw short-key map; legend maps short keys to full field names
     * (single source of truth: AppQyV1GroupWordProgressModel::ENTRY_LEGEND).
     * All timestamps inside entries are unix seconds (UTC).
     */
    public function getProgressBlob(Request $request): JsonResponse
    {
        $supported_params = ['gid'];

        $validator = Validator::make($request->all(), [
            'gid' => 'required|string',
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

        $group = AppQyV1WordGroupModel::where('gid', $gid)
            ->where('uid', $user->id)
            ->first();

        if (!$group) {
            return $this->error('Group not found', 404, [
                'supported_params' => $supported_params,
            ]);
        }

        $progressRow = AppQyV1GroupWordProgressModel::where('group_id', $group->id)->first();

        $wordsMap = [];
        $totalWords = 0;
        $languageCode = self::resolveGroupLanguageCode($group);
        if ($progressRow) {
            $wordsMap = $progressRow->getWordsMap();
            $totalWords = (int) $progressRow->total_words;
            $languageCode = $progressRow->languageCodeValue();
        }

        return $this->success([
            'gid' => $group->gid,
            'gname' => $group->gname,
            'language_code' => $languageCode,
            'total_words' => $totalWords,
            'legend' => AppQyV1GroupWordProgressModel::ENTRY_LEGEND,
            'words' => (object) $wordsMap,
        ], 'Progress blob retrieved successfully');
    }

    public function getCourseAnalysis(Request $request, $gid): JsonResponse
    {
        $knownThreshold = 60;

        $user = Auth::user();
        if (!$user) {
            return $this->unauthorized('Authentication required');
        }

        $group = AppQyV1WordGroupModel::where('gid', $gid)->first();
        if (!$group) {
            return $this->error('Group not found', 404);
        }

        $groupWordSet = [];
        $gwords = $group->getWordsArray();

        // A group's words live in TWO representations (gwords JSON text +
        // the progress map's word-ID memberships from library attachment);
        // the analysis set must merge both.
        if (is_array($gwords) && !empty($gwords)) {
            foreach ($gwords as $w) {
                $normalized = strtolower(trim((string) $w));
                if ($normalized !== '') {
                    $groupWordSet[] = $normalized;
                }
            }
        }

        // Map word ids resolve from the dictionary (word_id is a dictionary
        // id): one whereIn batch via resolveDictionaryRows.
        $progressRow = AppQyV1GroupWordProgressModel::where('group_id', $group->id)->first();
        if ($progressRow) {
            foreach ($progressRow->resolveDictionaryRows() as $dictWord) {
                $content = $dictWord->content;
                if ($content !== null) {
                    $normalized = strtolower(trim((string) $content));
                    if ($normalized !== '') {
                        $groupWordSet[] = $normalized;
                    }
                }
            }
        }

        $groupWordSet = array_values(array_unique($groupWordSet));
        $totalWords = count($groupWordSet);

        // Known words across ALL the user's groups: every progress row of
        // the user, entries with proficiency >= threshold, batch-resolved.
        $knownWordSet = [];
        $userRows = AppQyV1GroupWordProgressModel::where('user_id', $user->id)->get();
        foreach ($userRows as $userRow) {
            $knownIds = [];
            foreach ($userRow->getWordsMap() as $key => $stored) {
                $pf = 0.0;
                if (is_array($stored) && isset($stored['pf'])) {
                    $pf = (float) $stored['pf'];
                }
                if ($pf >= $knownThreshold) {
                    $knownIds[] = (int) $key;
                }
            }
            if (empty($knownIds)) {
                continue;
            }
            foreach ($userRow->resolveDictionaryRows($knownIds) as $dictWord) {
                $content = $dictWord->content;
                if ($content !== null) {
                    $knownWordSet[] = strtolower(trim((string) $content));
                }
            }
        }

        $knownWordSet = array_values(array_unique($knownWordSet));

        $knownWords = count(array_intersect($groupWordSet, $knownWordSet));

        $similarity = 0;
        if ($totalWords > 0) {
            $similarity = (int) round($knownWords / $totalWords * 100);
        }

        $newWords = $totalWords - $knownWords;
        $estimatedDays = $newWords > 0 ? (int) ceil($newWords / 20) : 0;

        return $this->success([
            'groupId' => $group->gid,
            'totalWords' => $totalWords,
            'knownWords' => $knownWords,
            'newWords' => $newWords,
            'estimatedDays' => $estimatedDays,
            'similarity' => $similarity,
        ], 'Course analysis retrieved successfully');
    }
}
