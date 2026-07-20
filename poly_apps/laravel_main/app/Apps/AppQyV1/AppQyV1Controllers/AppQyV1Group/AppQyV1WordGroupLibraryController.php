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
use App\Apps\AppQyV1\AppQyV1Enums\AppQyV1ProficiencyLevelEnum;
use App\Apps\AppQyV1\AppQyV1Requests\Group\AppQyV1AddLibraryToGroupRequest;
use App\Apps\AppQyV1\AppQyV1Requests\Group\AppQyV1PreviewAddLibraryToGroupRequest;
use App\Apps\AppQyV1\AppQyV1Requests\Group\AppQyV1RemoveLibraryFromGroupRequest;
use App\Apps\AppQyV1\AppQyV1Requests\Group\AppQyV1GetGroupLibrariesRequest;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1WordGroupPublicController as DGroupAPublic;
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
     * Collect the membership of every word already in the group: word ids from
     * the progress map (cheap - the map keys ARE the per-language dictionary
     * ids) plus the text-identity keys of the legacy gwords JSON text list.
     * The group/library language gate guarantees a single language per group,
     * and there is one dictionary id per exact text per language, so word-id
     * membership already covers exact-text matches - the progress map is NOT
     * resolved back to text (that extra whereIn does not scale to large
     * groups and was the same-text-same-id it would rebuild). Returns
     * ['word_ids' => set, 'keys' => set].
     */
    private function collectExistingGroupWordIdentity(
        AppQyV1WordGroupModel $lockedGroup,
        AppQyV1GroupWordProgressModel $progressRow,
        string $languageCode
    ): array {
        $existingWordIdSet = [];
        $existingKeySet = [];

        foreach (array_keys($progressRow->getWordsMap()) as $key) {
            $existingWordIdSet[(int) $key] = true;
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

    /**
     * Non-mutating classification of a library's dictionary rows against a
     * group's current membership. Reuses collectExistingGroupWordIdentity
     * plus the exact word-id / text-identity dedupe the add path applies,
     * but performs NO DB writes. Both addLibraryToGroup and
     * previewAddLibraryToGroup call this ONE method so the confirm-dialog
     * preview and the real add can never disagree on which words are new.
     *
     * @param iterable $libraryWords dictionary rows (dictionaryWords() output)
     * @return array{
     *     new_word_ids: array<int>,
     *     weights: array<int, int>,
     *     duplicates: array<int, array{word_id: int, word: string}>,
     *     library_total: int,
     *     existing_count: int
     * }
     */
    private function classifyLibraryWords(
        AppQyV1WordGroupModel $group,
        AppQyV1GroupWordProgressModel $progressRow,
        iterable $libraryWords,
        string $languageCode
    ): array {
        $existingIdentity = $this->collectExistingGroupWordIdentity($group, $progressRow, $languageCode);
        $existingWordIdSet = $existingIdentity['word_ids'];
        $existingKeySet = $existingIdentity['keys'];

        $newWordIds = [];
        $weights = [];
        $duplicates = [];
        $libraryTotal = 0;

        foreach ($libraryWords as $word) {
            // $word is a dictionary row: id is the unified dictionary id
            // used as the progress map key.
            $libraryTotal++;

            // Already enrolled by dictionary id - the same fast reject the
            // add path applies before it ever looks at the text.
            if (isset($existingWordIdSet[$word->id])) {
                $duplicates[] = [
                    'word_id' => (int) $word->id,
                    'word' => is_string($word->content) ? $word->content : '',
                ];
                continue;
            }

            // Rows without usable text are neither new nor duplicate: the add
            // path skips them silently, so the preview must too.
            if (!is_string($word->content) || $word->content === '') {
                continue;
            }

            // Text-identity dedupe: skip words whose normalized text is
            // already in the group (map or gwords), and dedupe repeats inside
            // the incoming library itself (case/spacing variants are distinct
            // dictionary rows).
            $identityKey = $this->buildWordIdentityKey($word->content, $languageCode);
            if (isset($existingKeySet[$identityKey])) {
                $duplicates[] = [
                    'word_id' => (int) $word->id,
                    'word' => $word->content,
                ];
                continue;
            }
            $existingKeySet[$identityKey] = true;

            $newWordIds[] = (int) $word->id;
            $weights[(int) $word->id] = strlen($word->content);
        }

        return [
            'new_word_ids' => $newWordIds,
            'weights' => $weights,
            'duplicates' => $duplicates,
            'library_total' => $libraryTotal,
            'existing_count' => count($existingWordIdSet),
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

            // Shared non-mutating classifier: the SAME dedupe the preview
            // endpoint runs, so "new vs duplicate" can never diverge between
            // the confirm dialog and this write path.
            $classification = $this->classifyLibraryWords($lockedGroup, $progressRow, $libraryWords, $languageCode);
            $newWordIds = $classification['new_word_ids'];
            $weights = $classification['weights'];

            // Single JSON merge: one row update instead of chunked
            // row-per-word inserts (no 65535 bind-parameter ceiling).
            // New words added to the Default Vocabulary Group get a random
            // position (po) so they interleave among the already-positioned
            // words without re-shuffling the existing order (design §5.4).
            $addedCount = 0;
            if (!empty($newWordIds)) {
                $assignRandomPosition = ($lockedGroup->gname === DGroupAPublic::$default_group_name);
                $addedCount = $progressRow->putWords($newWordIds, (string) now(), $weights, $assignRandomPosition);
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

    /**
     * POST /group/preview_add_library {gid, library_id}
     *
     * READ-ONLY confirm-dialog preview for add_library: reports what adding
     * the library to the group WOULD do without writing anything. Reuses the
     * same ownership check, language gate, already-linked source and the
     * shared classifyLibraryWords() dedupe the add path uses - but never
     * hard-errors on a language mismatch (returns language_match:false and
     * still computes the counts) and never creates the progress row.
     */
    public function previewAddLibraryToGroup(AppQyV1PreviewAddLibraryToGroupRequest $request): JsonResponse
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

        // Same language gate as add_library, but preview NEVER hard-errors:
        // surface language_match so the dialog can warn while still showing
        // the projected counts.
        $languageMatch = true;
        if ($group->language && $library->language
            && !AppQyV1LanguageConfigService::languagesMatch($group->language, $library->language)) {
            $languageMatch = false;
        }

        // Same already-linked source add_library re-checks under lock.
        $alreadyLinked = AppQyV1GroupLibraryModel::where('group_id', $group->id)
            ->where('library_id', $libraryId)
            ->exists();

        // Library stores a full name ('english'); identity keys and the
        // progress row use the normalized 2-letter code.
        $languageCode = $library->language;
        if ($languageCode) {
            $languageCode = AppQyV1LanguageConfigService::normalizeToCode($languageCode);
        }
        if (!is_string($languageCode)) {
            $languageCode = '';
        }

        // Read-only: load (never create) the progress row. forUserGroup()
        // would persist an empty row, so query directly and fall back to an
        // unsaved in-memory model when the group has no progress yet - that
        // gives the shared classifier an empty membership without a write.
        $progressRow = AppQyV1GroupWordProgressModel::where('group_id', $group->id)->first();
        if (!$progressRow) {
            $rowLanguage = $languageCode;
            if ($rowLanguage === '') {
                $rowLanguage = 'en';
            }
            $progressRow = new AppQyV1GroupWordProgressModel([
                'user_id' => $user->id,
                'group_id' => $group->id,
                'language_code' => $rowLanguage,
                'words' => [],
                'total_words' => 0,
            ]);
        }

        // Whole-library membership resolved the same way add_library does.
        $libraryWords = $library->dictionaryWords(0, count($library->getWordIdsArray()));

        $classification = $this->classifyLibraryWords($group, $progressRow, $libraryWords, $languageCode);
        $toAdd = count($classification['new_word_ids']);

        // Status breakdown from the progress map - the SAME derivations
        // getProgressStats uses (proficiency level via the enum, due via
        // entryDueForReview). entryCount doubles as the progress-map size for
        // the group total (gwords JSON + progress entries).
        $readCount = 0;
        $memorizedCount = 0;
        $dueCount = 0;
        $entryCount = 0;
        $nowTs = time();
        foreach ($progressRow->getWordsMap() as $stored) {
            $entry = AppQyV1GroupWordProgressModel::EMPTY_ENTRY;
            if (is_array($stored)) {
                $entry = array_merge($entry, $stored);
            }
            $entryCount++;
            if ((int) $entry['rc'] > 0) {
                $readCount++;
            }
            if (AppQyV1ProficiencyLevelEnum::fromProficiency((float) $entry['pf']) === AppQyV1ProficiencyLevelEnum::MASTERED) {
                $memorizedCount++;
            }
            if (AppQyV1GroupWordProgressModel::entryDueForReview($entry, $nowTs)) {
                $dueCount++;
            }
        }

        // Group total = gwords JSON words + progress-map entries, identical
        // to getProgressStats total_words.
        $gwords = $group->gwords;
        $gwordsCount = 0;
        if (is_array($gwords)) {
            $gwordsCount = count($gwords);
        }
        $currentInGroup = $gwordsCount + $entryCount;

        // Cap the returned duplicate rows; keep the full count separate.
        $duplicates = $classification['duplicates'];
        $duplicatesCount = count($duplicates);
        $duplicatesPreview = array_slice($duplicates, 0, 100);

        return $this->success([
            'gid' => $group->gid,
            'library_id' => (int) $libraryId,
            'library_name' => $library->name,
            'already_linked' => $alreadyLinked,
            'current_in_group' => $currentInGroup,
            'library_total' => $classification['library_total'],
            'to_add' => $toAdd,
            'projected_total' => $currentInGroup + $toAdd,
            'duplicates' => $duplicatesPreview,
            'duplicates_count' => $duplicatesCount,
            'language_match' => $languageMatch,
            'status_breakdown' => [
                'read' => $readCount,
                'memorized' => $memorizedCount,
                'due' => $dueCount,
                'total' => $entryCount,
            ],
        ], 'Library add preview computed successfully');
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
