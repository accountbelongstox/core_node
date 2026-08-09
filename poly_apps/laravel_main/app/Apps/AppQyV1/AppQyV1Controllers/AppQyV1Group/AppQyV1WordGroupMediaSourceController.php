<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Group;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1GroupLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1GroupMediaSourceModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1GroupWordProgressModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1BookModel as Book;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SubtitleModel as Subtitle;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SourceSentenceModel as SourceSentence;
use App\Utils\StrTool;
use App\Traits\ApiResponse;

/**
 * Word group media source management controller.
 * Links synced media sources (books/subtitles) to word groups and merges
 * the source's extracted words into the group (fill-missing, never clobber).
 *
 * NO try-catch allowed - trust Laravel validation
 * NO ?? or || allowed - use explicit if statements
 */
class AppQyV1WordGroupMediaSourceController
{
    use ApiResponse;

    /**
     * Resolve a group owned by the given user by gid.
     */
    private function findOwnedGroup(int $userId, string $gid)
    {
        return AppQyV1WordGroupModel::where('gid', $gid)
            ->where('uid', $userId)
            ->first();
    }

    /**
     * Resolve a media source row (Book or Subtitle) by source_key.
     */
    private function findMediaSource(string $sourceType, string $sourceKey)
    {
        if ($sourceType === 'book') {
            return Book::findBySourceKey($sourceKey);
        }
        return Subtitle::findBySourceKey($sourceKey);
    }

    /**
     * Collect sentence texts for a source via source_sentences -> sentences.
     * Uses grain='sentence', falling back to grain='cue' when absent.
     */
    private function collectSourceTexts(string $sourceType, string $sourceKey): array
    {
        return SourceSentence::collectSourceTexts($sourceType, $sourceKey);
    }

    /**
     * Add the normalized (lowercase/trimmed) texts of the group's library
     * words into the given identity-key set. Membership lives in the
     * group's ONE group_word_progress JSON row; map keys are dictionary ids
     * (tts_cache_{language_code}) batch-resolved via resolveDictionaryRows
     * (chunked whereIn, no per-row queries).
     */
    private function addGroupPivotWordKeys(int $groupId, array &$keySet): void
    {
        $progressRow = AppQyV1GroupWordProgressModel::where('group_id', $groupId)->first();
        if (!$progressRow) {
            return;
        }
        foreach ($progressRow->resolveDictionaryRows() as $dictWord) {
            $content = $dictWord->content;
            if (is_string($content) && $content !== '') {
                $keySet[strtolower(trim($content))] = true;
            }
        }
    }

    /**
     * POST /group/add_media_source {gid, source_type, source_key}
     * Idempotent: linking an already-linked source returns success with words_added=0.
     */
    public function addMediaSource(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (!$user) {
            return $this->unauthorized();
        }

        $validator = Validator::make($request->all(), [
            'gid' => 'required|string|max:64',
            'source_type' => 'required|string|in:book,subtitle',
            'source_key' => 'required|string|max:64',
        ]);
        if ($validator->fails()) {
            return $this->validationError($validator->errors());
        }

        $gid = $request->input('gid');
        $sourceType = $request->input('source_type');
        $sourceKey = $request->input('source_key');

        $group = $this->findOwnedGroup($user->id, $gid);
        if (!$group) {
            return $this->groupNotFound();
        }

        $source = $this->findMediaSource($sourceType, $sourceKey);
        if (!$source) {
            return $this->notFound('Media source not found');
        }

        $currentWords = StrTool::toWordArray($group->gwords);
        // Merged group total: gwords JSON words + the progress map's
        // library word-ID memberships - disjoint sources, both count.
        $groupWordsCount = $group->pivotWordsCount();

        // Fast path: already linked - skip expensive extraction entirely.
        // Race-safe authority is the locked re-check inside the transaction below.
        $existingLink = AppQyV1GroupMediaSourceModel::where('group_id', $group->id)
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->first();
        if ($existingLink) {
            return $this->success([
                'gid' => $group->gid,
                'source_type' => $sourceType,
                'source_key' => $sourceKey,
                'words_added' => 0,
                'total_words' => count($currentWords) + $groupWordsCount,
                'note' => 'Media source already linked to this group',
            ], 'Media source already linked');
        }

        // Expensive precomputation stays OUTSIDE the transaction.
        $texts = $this->collectSourceTexts($sourceType, $sourceKey);
        $textBlob = implode("\n", $texts);

        $newWords = [];
        $newFrequency = [];
        if ($textBlob !== '') {
            $extractResult = StrTool::extractWords($textBlob, true);
            $newWords = $extractResult['words'];
            $newFrequency = $extractResult['frequency'];
        }

        return AppQyV1WordGroupModel::runInTransaction(function () use ($group, $source, $sourceType, $sourceKey, $newWords, $newFrequency, $groupWordsCount) {
            // Serialize concurrent add_media_source calls for the same group:
            // the row lock makes the link re-check below race-safe without
            // try-catch around the unique (group_id, source_type, source_key) index.
            $lockedGroup = AppQyV1WordGroupModel::where('id', $group->id)
                ->lockForUpdate()
                ->first();
            if (!$lockedGroup) {
                return $this->groupNotFound();
            }

            $freshWords = StrTool::toWordArray($lockedGroup->gwords);

            $existingLink = AppQyV1GroupMediaSourceModel::where('group_id', $lockedGroup->id)
                ->where('source_type', $sourceType)
                ->where('source_key', $sourceKey)
                ->first();
            if ($existingLink) {
                return $this->success([
                    'gid' => $lockedGroup->gid,
                    'source_type' => $sourceType,
                    'source_key' => $sourceKey,
                    'words_added' => 0,
                    'total_words' => count($freshWords) + $groupWordsCount,
                    'note' => 'Media source already linked to this group',
                ], 'Media source already linked');
            }

            // Fill-missing merge against the freshly locked group state.
            // Text-identity dedupe (lowercase/trimmed): ArrTool::mergeUniqueIgnoreString
            // is case-sensitive, and pivot library words live outside gwords -
            // both already count as "in the group", so neither may be re-added
            // (total_words = count(gwords) + pivot count would double-count).
            $existingKeySet = [];
            foreach ($freshWords as $freshWord) {
                if (is_string($freshWord) && $freshWord !== '') {
                    $existingKeySet[strtolower(trim($freshWord))] = true;
                }
            }
            $this->addGroupPivotWordKeys($lockedGroup->id, $existingKeySet);

            $mergedWords = $freshWords;
            $wordsAdded = 0;
            foreach ($newWords as $newWord) {
                if (!is_string($newWord)) {
                    continue;
                }
                if ($newWord === '') {
                    continue;
                }
                $identityKey = strtolower(trim($newWord));
                if (isset($existingKeySet[$identityKey])) {
                    continue;
                }
                $existingKeySet[$identityKey] = true;
                $mergedWords[] = $newWord;
                $wordsAdded++;
            }
            $mergedWords = array_values($mergedWords);

            $currentFrequency = $lockedGroup->words_frequency;
            if (!is_array($currentFrequency)) {
                $currentFrequency = [];
            }
            foreach ($newFrequency as $word => $occurrences) {
                if (!array_key_exists($word, $currentFrequency)) {
                    $currentFrequency[$word] = $occurrences;
                }
            }

            $lockedGroup->gwords = $mergedWords;
            $lockedGroup->words_frequency = $currentFrequency;
            $lockedGroup->save();

            AppQyV1GroupMediaSourceModel::create([
                'group_id' => $lockedGroup->id,
                'source_type' => $sourceType,
                'source_key' => $sourceKey,
                'title' => $source->title,
                'language' => $source->language,
                'words_added' => $wordsAdded,
                'added_at' => now(),
            ]);

            return $this->success([
                'gid' => $lockedGroup->gid,
                'source_type' => $sourceType,
                'source_key' => $sourceKey,
                'words_added' => $wordsAdded,
                'total_words' => count($mergedWords) + $groupWordsCount,
            ], 'Media source added to group successfully');
        });
    }

    /**
     * POST /group/remove_media_source {gid, source_type, source_key}
     * Deletes the link row only - words already merged into the group stay.
     */
    public function removeMediaSource(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (!$user) {
            return $this->unauthorized();
        }

        $validator = Validator::make($request->all(), [
            'gid' => 'required|string|max:64',
            'source_type' => 'required|string|in:book,subtitle',
            'source_key' => 'required|string|max:64',
        ]);
        if ($validator->fails()) {
            return $this->validationError($validator->errors());
        }

        $gid = $request->input('gid');
        $sourceType = $request->input('source_type');
        $sourceKey = $request->input('source_key');

        $group = $this->findOwnedGroup($user->id, $gid);
        if (!$group) {
            return $this->groupNotFound();
        }

        $link = AppQyV1GroupMediaSourceModel::where('group_id', $group->id)
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->first();
        if (!$link) {
            return $this->notFound('Media source is not linked to this group');
        }

        $link->delete();

        return $this->success([
            'gid' => $group->gid,
            'source_type' => $sourceType,
            'source_key' => $sourceKey,
        ], 'Media source removed from group successfully');
    }

    /**
     * POST /group/get_sources {gid}
     * Returns both linked vocabulary libraries (same item shape as
     * /group/get_libraries) and linked media sources.
     */
    public function getGroupSources(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (!$user) {
            return $this->unauthorized();
        }

        $validator = Validator::make($request->all(), [
            'gid' => 'required|string|max:64',
        ]);
        if ($validator->fails()) {
            return $this->validationError($validator->errors());
        }

        $gid = $request->input('gid');

        $group = $this->findOwnedGroup($user->id, $gid);
        if (!$group) {
            return $this->groupNotFound();
        }

        $libraries = AppQyV1GroupLibraryModel::where('group_id', $group->id)
            ->with('library:id,name,language,total_words')
            ->get()
            ->map(function ($gl) {
                return [
                    'id' => $gl->library->id,
                    'name' => $gl->library->name,
                    'language' => $gl->library->language,
                    'total_words' => $gl->library->total_words,
                    'added_at' => $gl->added_at,
                ];
            })
            ->values();

        $mediaSources = AppQyV1GroupMediaSourceModel::where('group_id', $group->id)
            ->orderBy('added_at')
            ->get()
            ->map(function (AppQyV1GroupMediaSourceModel $link) {
                return [
                    'source_type' => $link->source_type,
                    'source_key' => $link->source_key,
                    'title' => $link->title,
                    'language' => $link->language,
                    'words_added' => $link->words_added,
                    'added_at' => $link->added_at,
                ];
            })
            ->values();

        return $this->success([
            'gid' => $group->gid,
            'gname' => $group->gname,
            'libraries_count' => $libraries->count(),
            'libraries' => $libraries,
            'media_sources_count' => $mediaSources->count(),
            'media_sources' => $mediaSources,
        ], 'Group sources retrieved successfully');
    }
}
