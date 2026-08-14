<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TranslationEventModel;

final class AppQyV1TranslationRealtimeService
{
    public function queued(
        string $taskId,
        array $words,
        string $language,
        string $targetLanguage,
        int $priority
    ): void {
        AppQyV1TranslationEventModel::emit('task.queued', [
            'task_id' => $taskId,
            'words' => array_values($words),
            'language' => $language,
            'target_language' => $targetLanguage,
            'priority' => $priority,
        ]);
    }

    public function priority(string $taskId, int $priority, ?int $oldPriority = null): void
    {
        $payload = [
            'task_id' => $taskId,
            'priority' => $priority,
            'bump' => $oldPriority === null || $priority > $oldPriority
                ? 'bumped'
                : 'reprioritized',
        ];

        if ($oldPriority !== null) {
            $payload['old_priority'] = $oldPriority;
        }

        AppQyV1TranslationEventModel::emit('task.priority', $payload);
    }

    public function wordTranslated(
        string $word,
        string $language,
        string $targetLanguage,
        string $translation,
        string $provider
    ): void {
        AppQyV1TranslationEventModel::emit('word.translated', [
            'word' => $word,
            'language' => $language,
            'target_language' => $targetLanguage,
            'translation' => $translation,
            'provider' => $provider,
        ]);
    }

}
