<?php

namespace App\Services\TaskProcessors;

use App\Models\GlobalTask;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1ArticleAudioWriteback;

class ArticleAudioTaskProcessor implements TaskProcessorInterface
{
    public function canProcess(GlobalTask $task): bool
    {
        return $task->app_name === 'AppQyV1' && $task->task_type === 'article_audio';
    }

    public function processResult(GlobalTask $task, array $result, bool $isDemoMode): int
    {
        if ($isDemoMode) {
            return 0;
        }

        $inner = isset($result['result']) && is_array($result['result'])
            ? $result['result']
            : $result;
        $audioBase64 = (string) ($inner['audio_base64'] ?? '');
        $bytes = base64_decode($audioBase64, true);
        $language = (string) ($task->payload['language'] ?? 'en');
        $content = (string) ($task->payload['content'] ?? '');
        $md5 = (string) ($task->payload['md5'] ?? ($content !== '' ? md5($content) : ''));

        if ($bytes === false || $bytes === '' || $md5 === '') {
            return 0;
        }

        $stored = (new AppQyV1ArticleAudioWriteback())->store(
            $language,
            $md5,
            $bytes,
            (string) ($inner['provider'] ?? 'worker'),
            isset($inner['mime']) ? (string) $inner['mime'] : null
        );

        return $stored ? 1 : 0;
    }

    public function getPriority(): int
    {
        return 10;
    }
}
