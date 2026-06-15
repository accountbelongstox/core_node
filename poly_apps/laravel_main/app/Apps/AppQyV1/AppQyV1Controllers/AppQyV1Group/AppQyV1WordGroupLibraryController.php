<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Group;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1GroupLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1GroupWordProgressModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1LanguageConfigService;
use App\Apps\AppQyV1\AppQyV1Requests\Group\AppQyV1AddLibraryToGroupRequest;
use App\Apps\AppQyV1\AppQyV1Requests\Group\AppQyV1RemoveLibraryFromGroupRequest;
use App\Apps\AppQyV1\AppQyV1Requests\Group\AppQyV1GetGroupLibrariesRequest;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Traits\ApiResponse;

/**
 * Word group library management controller
 * Refactor: use FormRequest validation, use error codes, eliminate supported_params duplication
 *
 * NO try-catch allowed - trust Laravel validation
 * NO ?? or || allowed - use explicit if statements
 */
class AppQyV1WordGroupLibraryController
{
    use ApiResponse;

    /**
     * Stable word identity inside a group: lowercase/trimmed text plus the
     * normalized 2-letter language code. Although the progress map's keys
     * are dictionary ids (one id per exact text per language), case and
     * spacing variants of the same word are distinct dictionary rows -
     * identity stays text-based when deduping across sources.
     */
    private function buildWordIdentityKey(string $wordText, string $languageCode): string
    {
        return strtolower(trim($wordText)) . '|' . $languageCode;
    }

    /**
     * Collect the identity keys of every word already in the group, using
     * in-transaction state: the progress map's word ids resolved against
     * the per-language dictionary (one batched whereIn) plus the gwords
     * JSON text list. Returns ['word_ids' => set, 'keys' => set]. The
     * group/library language gate guarantees a single language per group,
     * so all keys are built with the same normalized code.
     */
    private function collectExistingGroupWordIdentity(
        AppQyV1WordGroupModel $lockedGroup,
        AppQyV1GroupWordProgressModel $progressRow,
        string $languageCode
    ): array {
        $existingWordIdSet = [];
        $existingKeySet = [];

        $resolved = $progressRow->resolveDictionaryRows();
        foreach (array_keys($progressRow->getWordsMap()) as $key) {
            $mapWordId = (int) $key;
            $existingWordIdSet[$mapWordId] = true;
            if (!isset($resolved[$mapWordId])) {
                continue;
            }
            $content = $resolved[$mapWordId]->content;
            if (is_string($content) && $content !== '') {
                $existingKeySet[$this->buildWordIdentityKey($content, $languageCode)] = true;
            }
        }

        $gwords = $lockedGroup->gwords;
        if (is_array($gwords)) {
            foreach ($gwords as $gword) {
                if (is_string($gword) && $gword !== '') {
                    $existingKeySet[$this->buildWordIdentityKey($gword, $languageCode)] = true;
                }
            }
        }

        return [
            'word_ids' => $existingWordIdSet,
            'keys' => $existingKeySet,
        ];
    }

    public function addLibraryToGroup(AppQyV1AddLibraryToGroupRequest $request): JsonResponse
    {
        $user = Auth::user();
        if (!$user) {
            return $this->unauthorized();
        }

        $gid = $request->input('gid');
        $libraryId = $request->input('library_id');

        $group = AppQyV1WordGroupModel::where('gid', $gid)
            ->where('uid', $user->id)
            ->first();

        if (!$group) {
            return $this->groupNotFound();
        }

        $library = AppQyV1VocabularyLibraryModel::find($libraryId);
        if (!$library) {
            return $this->libraryNotFound();
        }

        // Group language is stored as a 2-letter code ('en') while library
        // language is stored as a full name ('english') - normalize both
        // sides to code form before comparing so 'en' accepts 'english'
        // and vice versa. Unknown values compare as plain strings.
        if ($group->language && $library->language
            && !AppQyV1LanguageConfigService::languagesMatch($group->language, $library->language)) {
            return $this->languageMismatch($library->language, $group->language, [
                'error_code' => 'LANGUAGE_MISMATCH',
            ]);
        }

        // Fast path: already linked - skip the expensive precompute entirely.
        // Race-safe authority is the locked re-check inside the transaction below.
        $existingLink = AppQyV1GroupLibraryModel::where('group_id', $group->id)
            ->where('library_id', $libraryId)
            ->first();

        if ($existingLink) {
            // Distinguishable already-linked state: keep error_code
            // LIBRARY_ALREADY_ADDED but carry additive data so the FE can
            // tell "already added" (words_added=0) apart from "added N".
            return $this->libraryAlreadyAdded([
                'already_linked' => true,
                'words_added' => 0,
                'gid' => $group->gid,
                'library_id' => $libraryId,
                'library_name' => $library->name,
            ]);
        }

        // Write boundary: language_code columns store 2-letter codes,
        // while the library may store a full name ('english').
        $languageCode = $library->language;
        if ($languageCode) {
            $languageCode = AppQyV1LanguageConfigService::normalizeToCode($languageCode);
        }
        if (!is_string($languageCode)) {
            $languageCode = '';
        }

        // Expensive precomputation stays OUTSIDE the transaction: library
        // membership (word_ids -> dictionary rows) is static reference data,
        // only the group state is racy. dictionaryWords() returns the rows in
        // word_ids order with ONE whereIn on tts_cache_{lang}.
        $libraryWords = $library->dictionaryWords(0, count($library->getWordIdsArray()));

        return DB::connection(AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1))->transaction(function () use ($group, $libraryId, $library, $user, $libraryWords, $languageCode) {
            // Serialize concurrent add_library calls for the same group: the
            // row lock makes the link re-check and the text-identity dedupe
            // below race-safe (dedupe decisions use in-transaction state).
            // The progress row is keyed by the same group, so the group lock
            // plus the single-row JSON update keeps the merge atomic.
            $lockedGroup = AppQyV1WordGroupModel::where('id', $group->id)
                ->lockForUpdate()
                ->first();
            if (!$lockedGroup) {
                return $this->groupNotFound();
            }

            $existingLink = AppQyV1GroupLibraryModel::where('group_id', $lockedGroup->id)
                ->where('library_id', $libraryId)
                ->first();
            if ($existingLink) {
                return $this->libraryAlreadyAdded([
                    'already_linked' => true,
                    'words_added' => 0,
                    'gid' => $lockedGroup->gid,
                    'library_id' => $libraryId,
                    'library_name' => $library->name,
                ]);
            }

            $groupLibrary = AppQyV1GroupLibraryModel::create([
                'group_id' => $lockedGroup->id,
                'library_id' => $libraryId,
                'added_at' => now(),
            ]);

            $rowLanguage = $languageCode;
            if ($rowLanguage === '') {
                $rowLanguage = 'en';
            }
            $progressRow = AppQyV1GroupWordProgressModel::forUserGroup($user->id, $lockedGroup->id, $rowLanguage);
            $lockedRow = AppQyV1GroupWordProgressModel::lockForGroup($lockedGroup->id);
            if ($lockedRow) {
                $progressRow = $lockedRow;
            }

            $existingIdentity = $this->collectExistingGroupWordIdentity($lockedGroup, $progressRow, $languageCode);
            $existingWordIdSet = $existingIdentity['word_ids'];
            $existingKeySet = $existingIdentity['keys'];

            $newWordIds = [];
            $weights = [];

            foreach ($libraryWords as $word) {
                // $word is a dictionary row: id is the unified dictionary id
                // used as the progress map key.
                if (isset($existingWordIdSet[$word->id])) {
                    continue;
                }
                if (!is_string($word->content)) {
                    continue;
                }
                if ($word->content === '') {
                    continue;
                }

                // Text-identity dedupe: skip words whose normalized text is
                // already in the group (map or gwords), and dedupe repeats
                // inside the incoming library itself (case/spacing variants
                // are distinct dictionary rows).
                $identityKey = $this->buildWordIdentityKey($word->content, $languageCode);
                if (isset($existingKeySet[$identityKey])) {
                    continue;
                }
                $existingKeySet[$identityKey] = true;

                $newWordIds[] = (int) $word->id;
                $weights[(int) $word->id] = strlen($word->content);
            }

            // Single JSON merge: one row update instead of chunked
            // row-per-word inserts (no 65535 bind-parameter ceiling).
            $addedCount = 0;
            if (!empty($newWordIds)) {
                $addedCount = $progressRow->putWords($newWordIds, (string) now(), $weights);
                $progressRow->save();
            }

            return $this->success([
                'gid' => $lockedGroup->gid,
                'library_id' => $libraryId,
                'library_name' => $library->name,
                'already_linked' => false,
                'words_added' => $addedCount,
                'total_words_in_library' => $libraryWords->count(),
            ], 'Library added to group successfully');
        });
    }

    public function removeLibraryFromGroup(AppQyV1RemoveLibraryFromGroupRequest $request): JsonResponse
    {
        $user = Auth::user();
        if (!$user) {
            return $this->unauthorized();
        }

        $gid = $request->input('gid');
        $libraryId = $request->input('library_id');

        $group = AppQyV1WordGroupModel::where('gid', $gid)
            ->where('uid', $user->id)
            ->first();

        if (!$group) {
            return $this->groupNotFound();
        }

        $groupLibrary = AppQyV1GroupLibraryModel::where('group_id', $group->id)
            ->where('library_id', $libraryId)
            ->first();

        if (!$groupLibrary) {
            return $this->libraryNotLinked();
        }

        $groupLibrary->delete();

        return $this->success([
            'gid' => $group->gid,
            'library_id' => $libraryId,
        ], 'Library removed from group successfully');
    }

    public function getGroupLibraries(AppQyV1GetGroupLibrariesRequest $request): JsonResponse
    {
        $user = Auth::user();
        if (!$user) {
            return $this->unauthorized();
        }

        $gid = $request->input('gid');

        $group = AppQyV1WordGroupModel::where('gid', $gid)
            ->where('uid', $user->id)
            ->first();

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
            });

        return $this->success([
            'gid' => $group->gid,
            'gname' => $group->gname,
            'libraries_count' => $libraries->count(),
            'libraries' => $libraries,
        ], 'Group libraries retrieved successfully');
    }
}
