<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TranslationEventModel;
use App\Support\QueueCenterContract;

/**
 * Pushes the contract `clip.ready` event (realtime.clip_ready) when a word or
 * sentence clip lands: only resource ids, so waiting clients fetch them by id
 * instead of polling audio/lookup. Ids of one request are collected and
 * emitted after the response in events of at most `max_ids`.
 */
final class AppQyV1ClipReadyPublisher
{
    /** @var array<string,true> resource ids of the current request */
    private static array $pending = [];
    private static bool $scheduled = false;

    public static function publish(string $kind, string $language, string $content): void
    {
        if ($language === '' || $content === '') {
            return;
        }
        self::$pending[AppQyV1AudioBundleService::resourceKey($kind, $language, $content)] = true;
        if (self::$scheduled) {
            return;
        }
        self::$scheduled = true;
        defer(static function (): void {
            self::flush();
        });
    }

    private static function flush(): void
    {
        $ids = array_keys(self::$pending);
        self::$pending = [];
        self::$scheduled = false;
        try {
            $max = max(1, (int) (QueueCenterContract::realtime()['clip_ready']['max_ids'] ?? 200));
            foreach (array_chunk($ids, $max) as $chunk) {
                AppQyV1TranslationEventModel::emit(QueueCenterContract::realtimeEvent('clip_ready'), ['ids' => $chunk]);
            }
        } catch (\Throwable) {
        }
    }
}
