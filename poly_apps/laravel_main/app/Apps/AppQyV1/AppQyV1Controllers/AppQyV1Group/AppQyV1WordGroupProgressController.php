<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Group;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserWordProgressModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyItemModel;
use App\Traits\ApiResponse;

class AppQyV1WordGroupProgressController
{
    use ApiResponse;

    public function updateProgress(Request $request): JsonResponse
    {
        $supported_params = ['gid', 'word_id', 'action', 'proficiency', 'is_correct'];

        $validator = Validator::make($request->all(), [
            'gid' => 'required|string',
            'word_id' => 'required|integer',
            'action' => 'required|in:read,review',
            'proficiency' => 'nullable|numeric|min:0|max:100',
            'is_correct' => 'nullable|boolean',
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
        $action = $request->input('action');
        $proficiency = $request->input('proficiency');
        $isCorrect = $request->input('is_correct');

        $group = AppQyV1WordGroupModel::where('gid', $gid)
            ->where('uid', $user->id)
            ->first();

        if (!$group) {
            return $this->error('Group not found', 404, [
                'supported_params' => $supported_params,
            ]);
        }

        $progress = AppQyV1UserWordProgressModel::forUser($user->id)
            ->forGroup($group->id)
            ->where('word_id', $wordId)
            ->first();

        if (!$progress) {
            $word = AppQyV1VocabularyItemModel::with('collection')->find($wordId);

            if (!$word) {
                return $this->error('Word not found', 404, [
                    'supported_params' => $supported_params,
                ]);
            }

            $progress = AppQyV1UserWordProgressModel::create([
                'user_id' => $user->id,
                'word_id' => $wordId,
                'group_id' => $group->id,
                'language_code' => $word->collection->lang_code ?? null,
                'weight' => strlen($word->word_content),
                'proficiency' => 0,
                'read_count' => 0,
                'review_count' => 0,
            ]);
        }

        if ($action === 'read') {
            if ($progress->first_read_at === null) {
                $progress->first_read_at = now();
            }
            $progress->last_read_at = now();
            $progress->read_count += 1;
        } else {
            $progress->last_review_at = now();
            $progress->review_count += 1;

            if ($isCorrect !== null) {
                $progress->updateProficiency($isCorrect);
            }
        }

        if ($proficiency !== null) {
            $progress->proficiency = $proficiency;
        }

        $progress->calculateNextReviewTime();
        $progress->save();

        return $this->success([
            'gid' => $group->gid,
            'word_id' => $wordId,
            'action' => $action,
            'progress' => [
                'read_count' => $progress->read_count,
                'review_count' => $progress->review_count,
                'proficiency' => $progress->proficiency,
                'next_review_at' => $progress->next_review_at,
                'last_read_at' => $progress->last_read_at,
                'last_review_at' => $progress->last_review_at,
            ],
        ], 'Progress updated successfully');
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

        $query = AppQyV1UserWordProgressModel::forUser($user->id)
            ->forGroup($group->id)
            ->dueForReview()
            ->with(['word:id,word,word_index'])
            ->select([
                'id',
                'word_id',
                'proficiency',
                'read_count',
                'review_count',
                'last_review_at',
                'next_review_at',
                'weight',
            ]);

        if ($proficiencyMax !== null) {
            $query->byProficiency(null, $proficiencyMax);
        }

        $progressRecords = $query->orderBy('proficiency', 'asc')
            ->orderBy('weight', 'desc')
            ->limit($limit)
            ->get();

        $words = $progressRecords->map(function ($progress) {
            return [
                'progress_id' => $progress->id,
                'word_id' => $progress->word_id,
                'word' => $progress->word->word ?? null,
                'word_index' => $progress->word->word_index ?? null,
                'proficiency' => $progress->proficiency,
                'read_count' => $progress->read_count,
                'review_count' => $progress->review_count,
                'last_review_at' => $progress->last_review_at,
                'next_review_at' => $progress->next_review_at,
                'weight' => $progress->weight,
            ];
        });

        return $this->success([
            'gid' => $group->gid,
            'gname' => $group->gname,
            'review_words_count' => $words->count(),
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

        $baseQuery = AppQyV1UserWordProgressModel::forUser($user->id)
            ->forGroup($group->id);

        $stats = (object)[
            'total_words' => $baseQuery->count(),
            'avg_proficiency' => $baseQuery->avg('proficiency'),
            'total_reads' => $baseQuery->sum('read_count'),
            'total_reviews' => $baseQuery->sum('review_count'),
            'mastered_words' => (clone $baseQuery)->mastered()->count(),
            'learning_words' => (clone $baseQuery)->learning()->count(),
            'struggling_words' => (clone $baseQuery)->struggling()->count(),
            'due_for_review' => (clone $baseQuery)->dueForReview()->count(),
        ];

        return $this->success([
            'gid' => $group->gid,
            'gname' => $group->gname,
            'stats' => [
                'total_words' => $stats->total_words ?? 0,
                'avg_proficiency' => round($stats->avg_proficiency ?? 0, 2),
                'total_reads' => $stats->total_reads ?? 0,
                'total_reviews' => $stats->total_reviews ?? 0,
                'mastered_words' => $stats->mastered_words ?? 0,
                'learning_words' => $stats->learning_words ?? 0,
                'struggling_words' => $stats->struggling_words ?? 0,
                'due_for_review' => $stats->due_for_review ?? 0,
            ],
        ], 'Progress stats retrieved successfully');
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

        if (is_array($gwords) && !empty($gwords)) {
            foreach ($gwords as $w) {
                $normalized = strtolower(trim((string) $w));
                if ($normalized !== '') {
                    $groupWordSet[] = $normalized;
                }
            }
        } else {
            $pivotRows = $group->groupWords()->with('word')->get();
            foreach ($pivotRows as $row) {
                $content = $row->word->word_content ?? null;
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

        $knownWordSet = [];
        $rows = AppQyV1UserWordProgressModel::forUser($user->id)
            ->where('proficiency', '>=', $knownThreshold)
            ->with('word:id,word_content')
            ->get(['id', 'word_id', 'proficiency']);

        foreach ($rows as $row) {
            if ($row->word && $row->word->word_content !== null) {
                $knownWordSet[] = strtolower(trim($row->word->word_content));
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
