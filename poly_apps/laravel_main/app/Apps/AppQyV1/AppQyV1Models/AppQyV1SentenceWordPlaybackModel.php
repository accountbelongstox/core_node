<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Support\Collection;

class AppQyV1SentenceWordPlaybackModel extends AppQyV1Model
{
    protected $guarded = [];

    protected ?string $appTableSuffix = 'sentence_word_playbacks';

    public static function playCounts(
        string $clientKey,
        string $language,
        array $wordHashes,
        ?int $userId
    ): Collection {
        $query = self::query()
            ->where('client_key', $clientKey)
            ->where('language', $language)
            ->whereIn('word_md5', $wordHashes);

        $userId === null ? $query->whereNull('user_id') : $query->where('user_id', $userId);

        return $query->pluck('play_count', 'word_md5');
    }

    public static function recordPlays(
        string $clientKey,
        string $language,
        array $readCountsByHash,
        ?int $userId,
        \Closure $afterRecorded
    ): int {
        $model = new static();

        return $model->getConnection()->transaction(static function () use (
            $clientKey,
            $language,
            $readCountsByHash,
            $userId,
            $afterRecorded
        ): int {
            $now = now();
            $count = 0;

            foreach ($readCountsByHash as $wordHash => $readCount) {
                self::query()->insertOrIgnore([[
                    'user_id' => $userId,
                    'client_key' => $clientKey,
                    'language' => $language,
                    'word_md5' => $wordHash,
                    'play_count' => 0,
                    'last_played_at' => $now,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]]);
                $query = self::query()
                    ->where('client_key', $clientKey)
                    ->where('language', $language)
                    ->where('word_md5', $wordHash);
                $userId === null ? $query->whereNull('user_id') : $query->where('user_id', $userId);
                $query->increment('play_count', $readCount, [
                    'last_played_at' => $now,
                    'updated_at' => $now,
                ]);
                $count += $readCount;
            }

            $afterRecorded();

            return $count;
        });
    }
}
