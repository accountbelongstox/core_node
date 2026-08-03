<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Constants\AppKeys;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1GroupWordProgressModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Support\Facades\DB;

class AppQyV1SentenceWordTableService
{
    private const MAX_WORDS = 400;

    private string $connection;
    private string $tableName;
    private AppQyV1WordMediaService $mediaService;

    public function __construct()
    {
        $this->connection = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);
        $this->tableName = AppTablePrefixServiceProvider::buildTableName(AppKeys::APPQYV1, 'sentence_word_playbacks');
        $this->mediaService = new AppQyV1WordMediaService();
    }

    public function resolve(
        string $sentence,
        string $language,
        ?string $targetLanguage,
        string $clientKey,
        ?int $userId,
        int $maxReadCount = 0
    ): array
    {
        $words = $this->tokenize($sentence);
        $md5s = array_map('md5', $words);
        $trackingKey = $this->trackingKey($clientKey, $userId);
        $playedQuery = DB::connection($this->connection)->table($this->tableName)
            ->where('client_key', $trackingKey)
            ->where('language', $language)
            ->whereIn('word_md5', $md5s);
        if ($userId === null) {
            $playedQuery->whereNull('user_id');
        } else {
            $playedQuery->where('user_id', $userId);
        }
        $played = $playedQuery->pluck('play_count', 'word_md5');
        $addedToShelf = [];
        if ($userId !== null) {
            $addedToShelf = $this->ensureShelfMembership($words, $language, $userId);
            $playedWords = array_values(array_filter(
                $words,
                static fn (string $word): bool => (int) ($played->get(md5($word)) ?? 0) > 0
            ));
            if (!empty($playedWords)) {
                $this->syncShelfProgress($playedWords, $language, $userId, false);
            }
        }
        $shelfStates = $this->shelfWordStates($md5s, $language, $userId);
        $rows = [];

        foreach ($words as $word) {
            $media = $this->mediaService->resolve(
                $word,
                $language,
                $targetLanguage,
                false,
                null,
                false,
                false
            );
            $wordMd5 = md5($word);
            $localPlayCount = (int) ($played->get($wordMd5) ?? 0);
            $shelfState = $shelfStates[$wordMd5] ?? null;
            $playCount = $userId === null
                ? $localPlayCount
                : (int) ($shelfState['read_count'] ?? 0);
            $media['played'] = $playCount > 0;
            $media['play_count'] = $playCount;
            $media['in_default_group'] = $userId !== null && $shelfState !== null;
            $media['added_to_default_group'] = isset($addedToShelf[$wordMd5]);
            $media['eligible_for_new_only'] = $playCount <= $maxReadCount;
            $rows[] = $media;
        }

        return $rows;
    }

    public function markPlayed(array $words, string $language, string $clientKey, ?int $userId): int
    {
        $now = now();
        $count = 0;
        $trackingKey = $this->trackingKey($clientKey, $userId);
        $readCountsByMd5 = [];

        foreach (array_slice(array_values($words), 0, self::MAX_WORDS) as $word) {
            $normalized = mb_strtolower(trim((string) $word));
            if ($normalized === '') {
                continue;
            }
            $wordMd5 = md5($normalized);
            $readCountsByMd5[$wordMd5] = ($readCountsByMd5[$wordMd5] ?? 0) + 1;
        }

        foreach ($readCountsByMd5 as $wordMd5 => $readCount) {
            DB::connection($this->connection)->table($this->tableName)->insertOrIgnore([[
                'user_id' => $userId,
                'client_key' => $trackingKey,
                'language' => $language,
                'word_md5' => $wordMd5,
                'play_count' => 0,
                'last_played_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]]);
            $playbackQuery = DB::connection($this->connection)->table($this->tableName)
                ->where('client_key', $trackingKey)
                ->where('language', $language)
                ->where('word_md5', $wordMd5);
            if ($userId === null) {
                $playbackQuery->whereNull('user_id');
            } else {
                $playbackQuery->where('user_id', $userId);
            }
            $playbackQuery->increment('play_count', $readCount, [
                'last_played_at' => $now,
                'updated_at' => $now,
            ]);
            $count += $readCount;
        }

        $this->syncShelfProgress($words, $language, $userId, true, $readCountsByMd5);

        return $count;
    }

    private function shelfWordStates(array $md5s, string $language, ?int $userId): array
    {
        if ($userId === null || empty($md5s)) {
            return [];
        }
        $defaultGroup = AppQyV1LanguageStudyGroupService::getDefaultGroupForLanguage(
            $userId,
            $language
        );
        if ($defaultGroup === null) {
            return [];
        }
        $progressRow = AppQyV1GroupWordProgressModel::query()
            ->where('user_id', $userId)
            ->where('group_id', $defaultGroup->id)
            ->first();
        if ($progressRow === null) {
            return [];
        }
        $dictionaryRows = AppQyV1LangDictionaryModel::forLanguage($language)
            ->whereIn('md5', $md5s)
            ->get(['id', 'md5']);
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

    private function ensureShelfMembership(array $words, string $language, ?int $userId): array
    {
        if ($userId === null || empty($words)) {
            return [];
        }
        $md5s = array_map(static fn ($word) => md5(mb_strtolower(trim((string) $word))), $words);
        $dictionaryRows = AppQyV1LangDictionaryModel::forLanguage($language)
            ->whereIn('md5', $md5s)
            ->get(['id', 'md5']);
        $wordIds = $dictionaryRows
            ->pluck('id')
            ->map(static fn ($id) => (int) $id)
            ->all();
        if (empty($wordIds)) {
            return [];
        }
        $defaultGroup = AppQyV1LanguageStudyGroupService::getDefaultGroupForLanguage(
            $userId,
            $language
        );
        if ($defaultGroup === null) {
            $defaultGroup = AppQyV1LanguageStudyGroupService::createLanguageDefaultGroup(
                $userId,
                $language
            );
        }
        if ($defaultGroup === null) {
            return [];
        }
        $result = (new AppQyV1WordGroupService())->addWordsToGroup(
            $defaultGroup,
            $wordIds,
            $userId
        );
        $addedWordIds = array_fill_keys(array_map(
            static fn ($id): string => (string) (int) $id,
            $result['word_ids_added'] ?? []
        ), true);
        $addedMd5s = [];
        foreach ($dictionaryRows as $dictionaryRow) {
            if (isset($addedWordIds[(string) (int) $dictionaryRow->id])) {
                $addedMd5s[(string) $dictionaryRow->md5] = true;
            }
        }
        return $addedMd5s;
    }

    private function syncShelfProgress(
        array $words,
        string $language,
        ?int $userId,
        bool $increment = true,
        array $readCountsByMd5 = []
    ): void
    {
        if ($userId === null || empty($words)) {
            return;
        }
        $md5s = array_map(static fn ($word) => md5(mb_strtolower(trim((string) $word))), $words);
        $dictionaryRows = AppQyV1LangDictionaryModel::forLanguage($language)
            ->whereIn('md5', $md5s)
            ->get(['id', 'md5']);
        $wordIds = $dictionaryRows->pluck('id')->map(static fn ($id) => (int) $id)->all();
        $defaultGroup = AppQyV1LanguageStudyGroupService::getDefaultGroupForLanguage(
            $userId,
            $language
        );
        if ($defaultGroup === null) {
            $defaultGroup = AppQyV1LanguageStudyGroupService::createLanguageDefaultGroup(
                $userId,
                $language
            );
        }
        if ($defaultGroup !== null && !empty($wordIds)) {
            (new AppQyV1WordGroupService())->addWordsToGroup(
                $defaultGroup,
                $wordIds,
                $userId
            );
        }
        if ($defaultGroup === null || empty($wordIds)) {
            return;
        }
        $progressRow = AppQyV1GroupWordProgressModel::query()
            ->where('user_id', $userId)
            ->where('group_id', $defaultGroup->id)
            ->first();
        if ($progressRow === null) {
            return;
        }
        $changed = false;
        foreach ($dictionaryRows as $dictionaryRow) {
            $wordId = (int) $dictionaryRow->id;
            $map = $progressRow->getWordsMap();
            $entry = $map[(string) $wordId] ?? null;
            if (!is_array($entry)) {
                continue;
            }
            $readCount = (int) ($entry['rc'] ?? 0);
            if (!$increment && $readCount > 0) {
                continue;
            }
            $progressRow->updateWordProgress($wordId, [
                'lr' => time(),
                'rc' => $increment
                    ? $readCount + max(1, (int) ($readCountsByMd5[(string) $dictionaryRow->md5] ?? 1))
                    : 1,
            ]);
            $changed = true;
        }
        if ($changed) {
            $progressRow->save();
        }
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
