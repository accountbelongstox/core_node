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
        ?int $userId
    ): array
    {
        $words = $this->tokenize($sentence);
        $md5s = array_map('md5', $words);
        $played = DB::connection($this->connection)->table($this->tableName)
            ->where('client_key', $clientKey)
            ->where('language', $language)
            ->whereIn('word_md5', $md5s)
            ->pluck('play_count', 'word_md5');
        $playedWords = array_values(array_filter(
            $words,
            static fn (string $word): bool => (int) ($played->get(md5($word)) ?? 0) > 0
        ));
        if (!empty($playedWords)) {
            // A word may have been played before its dictionary row existed.
            // Reconcile it into Shelf once translation ingestion creates the row,
            // without counting a read-only resolve as another playback.
            $this->syncShelfProgress($playedWords, $language, $userId, false);
        }
        $shelfPlayed = $this->shelfPlayedMd5s($md5s, $language, $userId);
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
            $playCount = (int) ($played->get($wordMd5) ?? 0);
            $media['played'] = $playCount > 0 || isset($shelfPlayed[$wordMd5]);
            $media['play_count'] = $playCount;
            $rows[] = $media;
        }

        return $rows;
    }

    public function markPlayed(array $words, string $language, string $clientKey, ?int $userId): int
    {
        $now = now();
        $count = 0;

        foreach (array_slice(array_values(array_unique($words)), 0, self::MAX_WORDS) as $word) {
            $normalized = mb_strtolower(trim((string) $word));
            if ($normalized === '') {
                continue;
            }
            DB::connection($this->connection)->table($this->tableName)->insertOrIgnore([[
                'user_id' => $userId,
                'client_key' => $clientKey,
                'language' => $language,
                'word_md5' => md5($normalized),
                'play_count' => 0,
                'last_played_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]]);
            DB::connection($this->connection)->table($this->tableName)
                ->where('client_key', $clientKey)
                ->where('language', $language)
                ->where('word_md5', md5($normalized))
                ->increment('play_count', 1, [
                    'user_id' => $userId,
                    'last_played_at' => $now,
                    'updated_at' => $now,
                ]);
            $count++;
        }

        $this->syncShelfProgress($words, $language, $userId);

        return $count;
    }

    private function shelfPlayedMd5s(array $md5s, string $language, ?int $userId): array
    {
        if ($userId === null || empty($md5s)) {
            return [];
        }
        $dictionaryRows = AppQyV1LangDictionaryModel::forLanguage($language)
            ->whereIn('md5', $md5s)
            ->get(['id', 'md5']);
        $idsByMd5 = $dictionaryRows->pluck('id', 'md5');
        $progressRows = AppQyV1GroupWordProgressModel::query()
            ->where('user_id', $userId)
            ->where('language_code', $language)
            ->get();
        $played = [];

        foreach ($idsByMd5 as $md5 => $wordId) {
            foreach ($progressRows as $progressRow) {
                $entry = $progressRow->getWordsMap()[(string) $wordId] ?? null;
                if (is_array($entry) && (int) ($entry['rc'] ?? 0) > 0) {
                    $played[(string) $md5] = true;
                    break;
                }
            }
        }
        return $played;
    }

    private function syncShelfProgress(
        array $words,
        string $language,
        ?int $userId,
        bool $increment = true
    ): void
    {
        if ($userId === null || empty($words)) {
            return;
        }
        $md5s = array_map(static fn ($word) => md5(mb_strtolower(trim((string) $word))), $words);
        $wordIds = AppQyV1LangDictionaryModel::forLanguage($language)
            ->whereIn('md5', $md5s)
            ->pluck('id')
            ->map(static fn ($id) => (int) $id)
            ->all();
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
        $progressRows = AppQyV1GroupWordProgressModel::query()
            ->where('user_id', $userId)
            ->where('language_code', $language)
            ->get();

        foreach ($progressRows as $progressRow) {
            $changed = false;
            foreach ($wordIds as $wordId) {
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
                    'rc' => $increment ? $readCount + 1 : 1,
                ]);
                $changed = true;
            }
            if ($changed) {
                $progressRow->save();
            }
        }
    }

    private function tokenize(string $sentence): array
    {
        preg_match_all("/[\\p{L}]+(?:['’][\\p{L}]+)*/u", mb_strtolower($sentence), $matches);
        return array_slice(array_values(array_unique($matches[0] ?? [])), 0, self::MAX_WORDS);
    }
}
