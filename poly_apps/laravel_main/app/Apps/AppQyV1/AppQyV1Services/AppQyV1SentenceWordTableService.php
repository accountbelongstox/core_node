<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1GroupWordProgressModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SentenceWordPlaybackModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserLearningProgressModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;

class AppQyV1SentenceWordTableService
{
    private const MAX_WORDS = 400;

    private AppQyV1WordMediaService $mediaService;

    public function __construct()
    {
        $this->mediaService = new AppQyV1WordMediaService();
    }

    public function resolve(
        string $sentence,
        string $language,
        ?string $targetLanguage,
        string $clientKey,
        ?int $userId,
        int $maxReadCount = 0,
        ?string $groupId = null
    ): array
    {
        $words = $this->tokenize($sentence);
        $md5s = array_map('md5', $words);
        $trackingKey = $this->trackingKey($clientKey, $userId);
        $played = AppQyV1SentenceWordPlaybackModel::playCounts(
            $trackingKey,
            $language,
            $md5s,
            $userId
        );
        $shelfStates = $this->shelfWordStates($md5s, $language, $userId, $groupId);
        $mediaByWord = [];
        $rows = [];

        foreach ($words as $word) {
            if (!isset($mediaByWord[$word])) {
                $mediaByWord[$word] = $this->mediaService->resolve(
                    $word,
                    $language,
                    $targetLanguage,
                    false,
                    null,
                    false,
                    false
                );
            }
            $media = $mediaByWord[$word];
            $wordMd5 = md5($word);
            $localPlayCount = (int) ($played->get($wordMd5) ?? 0);
            $shelfState = $shelfStates[$wordMd5] ?? null;
            $playCount = $userId === null
                ? $localPlayCount
                : (int) ($shelfState['read_count'] ?? 0);
            $inTargetGroup = $userId !== null && $shelfState !== null;
            $media['played'] = $playCount > 0;
            $media['play_count'] = $playCount;
            $media['in_target_group'] = $inTargetGroup;
            $media['added_to_target_group'] = false;
            $media['in_default_group'] = $inTargetGroup;
            $media['added_to_default_group'] = false;
            $media['eligible_for_new_only'] = $playCount <= $maxReadCount;
            $rows[] = $media;
        }

        return $rows;
    }

    public function markPlayed(array $words, string $language, string $clientKey, ?int $userId, ?string $groupId = null): int
    {
        $normalizedWords = [];
        $readCountsByMd5 = [];
        $trackingKey = $this->trackingKey($clientKey, $userId);

        foreach (array_slice(array_values($words), 0, self::MAX_WORDS) as $word) {
            $normalized = mb_strtolower(trim((string) $word));
            if ($normalized === '') {
                continue;
            }
            $wordMd5 = md5($normalized);
            $normalizedWords[] = $normalized;
            $readCountsByMd5[$wordMd5] = ($readCountsByMd5[$wordMd5] ?? 0) + 1;
        }
        if (empty($readCountsByMd5)) {
            return 0;
        }

        return AppQyV1SentenceWordPlaybackModel::recordPlays(
            $trackingKey,
            $language,
            $readCountsByMd5,
            $userId,
            function () use (
            $normalizedWords,
            $readCountsByMd5,
            $language,
            $userId,
            $groupId
        ): void {
            $this->syncShelfProgress($normalizedWords, $language, $userId, $readCountsByMd5, $groupId);
        });
    }

    /** Target shelf group: the caller-selected group when it belongs to the
     * user, otherwise the language Default Vocabulary Group. */
    private function targetGroup(
        int $userId,
        string $language,
        ?string $groupId,
        bool $createIfMissing = false
    ): ?AppQyV1WordGroupModel
    {
        $groupId = trim((string) $groupId);
        $requestedLanguage = AppQyV1LanguageConfigService::normalizeToCode($language);
        if (!is_string($requestedLanguage) || $requestedLanguage === '') {
            $requestedLanguage = 'en';
        }
        if ($groupId !== '') {
            $selected = AppQyV1WordGroupModel::findOwnedByReference($userId, $groupId);
            $selectedLanguage = $selected === null
                ? null
                : AppQyV1LanguageConfigService::normalizeToCode((string) $selected->language);
            if ($selected !== null && (!is_string($selectedLanguage) || $selectedLanguage === '')) {
                $selectedLanguage = 'en';
            }
            if ($selected !== null && $selectedLanguage === $requestedLanguage) {
                return $selected;
            }
        }
        $defaultGroup = AppQyV1LanguageStudyGroupService::getDefaultGroupForLanguage($userId, $requestedLanguage);
        if ($defaultGroup === null && $createIfMissing) {
            $defaultGroup = AppQyV1LanguageStudyGroupService::createLanguageDefaultGroup($userId, $requestedLanguage);
        }
        return $defaultGroup;
    }

    private function shelfWordStates(array $md5s, string $language, ?int $userId, ?string $groupId = null): array
    {
        if ($userId === null || empty($md5s)) {
            return [];
        }
        $targetGroup = $this->targetGroup($userId, $language, $groupId);
        if ($targetGroup === null) {
            return [];
        }
        $progressRow = AppQyV1GroupWordProgressModel::findForUserGroup($userId, (int) $targetGroup->id);
        if ($progressRow === null) {
            return [];
        }
        $dictionaryRows = AppQyV1LangDictionaryModel::rowsByHashes($language, $md5s, ['id', 'md5']);
        $idsByMd5 = $dictionaryRows->pluck('id', 'md5');
        $wordsMap = $progressRow->getWordsMap();
        $states = [];

        foreach ($idsByMd5 as $md5 => $wordId) {
            $entry = $wordsMap[(string) $wordId] ?? null;
            if (is_array($entry)) {
                $states[(string) $md5] = [
                    'read_count' => (int) ($entry['rc'] ?? 0),
                ];
            }
        }
        return $states;
    }

    private function syncShelfProgress(
        array $words,
        string $language,
        ?int $userId,
        array $readCountsByMd5 = [],
        ?string $groupId = null
    ): void
    {
        if ($userId === null || empty($words)) {
            return;
        }
        $languageCode = AppQyV1LanguageConfigService::normalizeToCode($language);
        if (!is_string($languageCode) || $languageCode === '') {
            $languageCode = 'en';
        }
        $md5s = array_map(static fn ($word) => md5(mb_strtolower(trim((string) $word))), $words);
        $dictionaryRows = AppQyV1LangDictionaryModel::rowsByHashes(
            $languageCode,
            $md5s,
            ['id', 'md5', 'content']
        );
        $wordIds = $dictionaryRows->pluck('id')->map(static fn ($id) => (int) $id)->all();
        $targetGroup = $this->targetGroup($userId, $languageCode, $groupId, true);
        if ($targetGroup === null || empty($wordIds)) {
            return;
        }
        $progressRow = AppQyV1GroupWordProgressModel::forUserGroup(
            $userId,
            $targetGroup->id,
            $languageCode
        );
        $progressRow = AppQyV1GroupWordProgressModel::lockForGroup($targetGroup->id) ?? $progressRow;
        $weights = [];
        foreach ($dictionaryRows as $dictionaryRow) {
            $weights[(int) $dictionaryRow->id] = strlen((string) $dictionaryRow->content);
        }
        $progressRow->putWords(
            $wordIds,
            (string) now(),
            $weights,
            (bool) $targetGroup->is_language_default
        );
        $changed = false;
        foreach ($dictionaryRows as $dictionaryRow) {
            $wordId = (int) $dictionaryRow->id;
            $readCount = max(1, (int) ($readCountsByMd5[(string) $dictionaryRow->md5] ?? 1));
            for ($index = 0; $index < $readCount; $index++) {
                $progressRow->recordRead($wordId);
            }
            $changed = true;
        }
        if ($changed) {
            $progressRow->saveRecord();
            (new AppQyV1WordGroupService())->clearGroupCache($targetGroup->gid, $userId);
            $this->syncUserLearningProgress($userId, $languageCode, $dictionaryRows, $readCountsByMd5);
        }
    }

    /** Mirror sentence reads into the per-user learning progress table so the
     * /user/statistics today / weekly counters (今日背词) move with playback.
     * A read word counts as 'learning' (existing statuses are preserved) and
     * each read bumps review_count + last_reviewed_at, which the statistics
     * aggregation reads as same-day activity. */
    private function syncUserLearningProgress(
        int $userId,
        string $languageCode,
        $dictionaryRows,
        array $readCountsByMd5
    ): void {
        $now = now();
        $reads = [];

        foreach ($dictionaryRows as $dictionaryRow) {
            $readCount = max(1, (int) ($readCountsByMd5[(string) $dictionaryRow->md5] ?? 1));
            $reads[] = [
                'word_hash' => (string) $dictionaryRow->md5,
                'word_content' => (string) $dictionaryRow->content,
                'read_count' => $readCount,
            ];
        }

        AppQyV1UserLearningProgressModel::recordPlaybackReads(
            $userId,
            $languageCode,
            $reads,
            $now
        );
    }

    private function tokenize(string $sentence): array
    {
        // Duplicate occurrences are intentionally preserved so playback can replay
        // the same word each time it appears in the sentence (original sentence order).
        preg_match_all("/[\\p{L}]+(?:['’][\\p{L}]+)*/u", mb_strtolower($sentence), $matches);
        return array_slice(array_values($matches[0] ?? []), 0, self::MAX_WORDS);
    }

    private function trackingKey(string $clientKey, ?int $userId): string
    {
        if ($userId === null) {
            return $clientKey;
        }
        $hash = hash_hmac('sha256', (string) $userId, (string) config('app.key'));
        return 'account-' . substr($hash, 0, 48);
    }
}
