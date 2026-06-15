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
            $addedCount = $progressRow->putWords($validIds, (string) now(), $weights);
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
        $supported_params = ['gid', 'page', 'per_page', 'with_progress'];

        $validator = Validator::make($request->all(), [
            'gid' => 'required|string',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
            'with_progress' => 'nullable|boolean',
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

        $wordsMap = [];
        $totalCount = 0;
        $orderedIds = [];
        $languageCode = self::resolveGroupLanguageCode($group);
        if ($progressRow) {
            $wordsMap = $progressRow->getWordsMap();
            $totalCount = count($wordsMap);
            // Stable pagination order: added_at (aa) then word_id.
            $orderedIds = $progressRow->orderedWordIds();
            $languageCode = $progressRow->languageCodeValue();
        }

        $offset = ($page - 1) * $perPage;
        $pageIds = array_slice($orderedIds, $offset, $perPage);

        // word_id is a dictionary id: resolve the page's words with one
        // whereIn (resolveWordRefs, the shared resolver).
        $resolved = [];
        if ($progressRow && !empty($pageIds)) {
            $resolved = $progressRow->resolveDictionaryRows($pageIds);
        }

        $words = [];
        $position = 0;
        foreach ($pageIds as $pageWordId) {
            $entry = AppQyV1GroupWordProgressModel::EMPTY_ENTRY;
            $stored = $wordsMap[(string) $pageWordId];
            if (is_array($stored)) {
                $entry = array_merge($entry, $stored);
            }

            $wordText = null;
            if (isset($resolved[$pageWordId])) {
                $wordText = $resolved[$pageWordId]->content;
            }

            $addedAt = null;
            if ($entry['aa'] !== null) {
                $addedAt = Carbon::createFromTimestamp((int) $entry['aa']);
            }

            $data = [
                'word_id' => $pageWordId,
                'word' => $wordText,
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
}
