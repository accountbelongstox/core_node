<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1GroupLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1GroupWordProgressModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;

class AppQyV1WordGroupService
{
    public function addLibraryToGroup(
        AppQyV1WordGroupModel $group,
        int $libraryId,
        int $userId
    ): array {
        return AppQyV1WordGroupModel::runInTransaction(function () use ($group, $libraryId, $userId) {
            $library = AppQyV1VocabularyLibraryModel::requireById($libraryId);

            // Serialize concurrent adds for the same group: the row lock makes
            // the text-identity dedupe below race-safe (in-transaction state).
            // The progress row is keyed by the same group, so the group lock
            // plus the single-row JSON update keeps the merge atomic.
            $lockedGroup = AppQyV1WordGroupModel::lockById((int) $group->id);

            $groupLibrary = AppQyV1GroupLibraryModel::attachLibrary((int) $lockedGroup->id, $libraryId);

            $result = $this->addWordsFromLibrary($lockedGroup, $library, $userId);

            $this->clearGroupCache($group->gid, $userId);

            return [
                'group_library' => $groupLibrary,
                'words_added' => $result['words_added'],
                'total_words' => $result['total_words'],
            ];
        });
    }

    public function addWordsToGroup(
        AppQyV1WordGroupModel $group,
        array $wordIds,
        int $userId
    ): array {
        return AppQyV1WordGroupModel::runInTransaction(function () use ($group, $wordIds, $userId) {
            $languageCode = $this->resolveGroupLanguageCode($group);
            $progressRow = AppQyV1GroupWordProgressModel::forUserGroup($userId, $group->id, $languageCode);
            $lockedRow = AppQyV1GroupWordProgressModel::lockForGroup($group->id);
            if ($lockedRow) {
                $progressRow = $lockedRow;
            }

            // Membership check = array_key_exists on the JSON map.
            $wordsMap = $progressRow->getWordsMap();
            $wordsToAdd = [];
            $skippedCount = 0;
            foreach ($wordIds as $wordId) {
                if (array_key_exists((string) (int) $wordId, $wordsMap)) {
                    $skippedCount++;
                    continue;
                }
                $wordsToAdd[] = (int) $wordId;
            }

            if (empty($wordsToAdd)) {
                return [
                    'words_added' => 0,
                    'words_skipped' => $skippedCount,
                    'total_requested' => count($wordIds),
                    'word_ids_added' => [],
                ];
            }

            // word ids are dictionary ids (tts_cache_{lang}); the group's
            // language (single language per group) selects the table.
            $validIds = [];
            $weights = [];
            $rows = AppQyV1LangDictionaryModel::rowsByIds(
                $languageCode,
                $wordsToAdd,
                ['id', 'content']
            );
            foreach ($rows as $row) {
                $validIds[] = (int) $row->id;
                $weights[(int) $row->id] = strlen((string) $row->content);
            }
            $skippedCount += count($wordsToAdd) - count($validIds);

            // The language-default group is the Shelf learning stream. Keep
            // sentence-playback additions aligned with words added from the
            // Shelf UI by assigning their initial randomized positions here.
            $assignRandomPosition = (bool) $group->is_language_default;
            $addedCount = $progressRow->putWords(
                $validIds,
                (string) now(),
                $weights,
                $assignRandomPosition
            );
            if ($addedCount > 0) {
                $progressRow->saveRecord();
            }

            $this->clearGroupCache($group->gid, $userId);

            return [
                'words_added' => $addedCount,
                'words_skipped' => $skippedCount,
                'total_requested' => count($wordIds),
                'word_ids_added' => $addedCount > 0 ? $validIds : [],
            ];
        });
    }

    protected function addWordsFromLibrary(
        AppQyV1WordGroupModel $group,
        AppQyV1VocabularyLibraryModel $library,
        int $userId
    ): array {
        // Write boundary: language_code columns store 2-letter codes, while
        // vocabulary_libraries.language may store a full name ('english').
        $languageCode = $library->language;
        if ($languageCode) {
            $languageCode = AppQyV1LanguageConfigService::normalizeToCode($languageCode);
        }
        if (!is_string($languageCode)) {
            $languageCode = '';
        }
        $rowLanguage = $languageCode;
        if ($rowLanguage === '') {
            $rowLanguage = 'en';
        }

        $progressRow = AppQyV1GroupWordProgressModel::forUserGroup($userId, $group->id, $rowLanguage);
        $lockedRow = AppQyV1GroupWordProgressModel::lockForGroup($group->id);
        if ($lockedRow) {
            $progressRow = $lockedRow;
        }

        // Stable word identity stays text-based: the progress map's keys are
        // dictionary ids, but case/spacing variants of the same word are
        // distinct dictionary rows. Dedupe by word_id AND by normalized text
        // against the map's words (batch-resolved against the dictionary)
        // plus the gwords list.
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
                $existingKeySet[strtolower(trim($content)) . '|' . $languageCode] = true;
            }
        }

        $gwords = $group->gwords;
        if (is_array($gwords)) {
            foreach ($gwords as $gword) {
                if (is_string($gword) && $gword !== '') {
                    $existingKeySet[strtolower(trim($gword)) . '|' . $languageCode] = true;
                }
            }
        }

        // Library membership: word_ids (ordered dictionary ids) resolved with
        // ONE whereIn on tts_cache_{lang}, in word_ids order.
        $libraryWords = $library->dictionaryWords(0, count($library->getWordIdsArray()));

        $newWordIds = [];
        $weights = [];
        foreach ($libraryWords as $item) {
            if (isset($existingWordIdSet[$item->id])) {
                continue;
            }
            if (!is_string($item->content)) {
                continue;
            }
            if ($item->content === '') {
                continue;
            }
            $identityKey = strtolower(trim($item->content)) . '|' . $languageCode;
            if (isset($existingKeySet[$identityKey])) {
                continue;
            }
            $existingKeySet[$identityKey] = true;
            $newWordIds[] = (int) $item->id;
            $weights[(int) $item->id] = strlen($item->content);
        }

        // Single JSON merge: one row update instead of chunked row-per-word
        // inserts (no 65535 bind-parameter ceiling).
        $addedCount = 0;
        if (!empty($newWordIds)) {
            $addedCount = $progressRow->putWords($newWordIds, (string) now(), $weights);
            $progressRow->saveRecord();
        }

        return [
            'words_added' => $addedCount,
            'total_words' => $libraryWords->count(),
        ];
    }

    /**
     * Normalized 2-letter language code of a group ('en' default): selects
     * the dictionary table the group's word_id values belong to.
     */
    protected function resolveGroupLanguageCode(AppQyV1WordGroupModel $group): string
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

    public function getGroupWithCache(string $gid, int $userId): ?AppQyV1WordGroupModel
    {
        return AppQyV1WordGroupModel::cachedForUserByGid($userId, $gid);
    }

    public function clearGroupCache(string $gid, int $userId): void
    {
        AppQyV1WordGroupModel::forgetCachedForUser($userId, $gid);
    }

    public function getUserGroupsWithCache(int $userId, int $start = 0, int $limit = 1000)
    {
        return AppQyV1WordGroupModel::cachedUserPageWithProgress($userId, $start, $limit);
    }
}
