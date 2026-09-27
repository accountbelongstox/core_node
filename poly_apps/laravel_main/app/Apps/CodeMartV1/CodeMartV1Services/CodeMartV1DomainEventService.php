<?php

namespace App\Apps\CodeMartV1\CodeMartV1Services;

use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ActivityModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1NotificationModel;
use Illuminate\Support\Facades\Log;

/**
 * Single entry point for CodeMart domain side effects: every state transition
 * records an immutable activity row and notifies the affected users. Title and
 * body are i18n keys resolved by the interface (cm-locales `notifications.*`).
 */
class CodeMartV1DomainEventService
{
    public static function emit(
        ?int $actorId,
        string $resourceType,
        int $resourceId,
        string $action,
        ?string $fromState = null,
        ?string $toState = null,
        array $notifyUserIds = [],
        ?string $notificationType = null,
        ?string $titleKey = null,
        ?string $bodyKey = null,
        array $params = []
    ): void {
        try {
            CodeMartV1ActivityModel::record(
                $actorId,
                $resourceType,
                $resourceId,
                $action,
                $fromState,
                $toState,
                $params === [] ? null : $params
            );
        } catch (\Throwable $e) {
            Log::warning('[CodeMartV1DomainEvent] activity record failed: ' . $e->getMessage());
        }

        if ($notificationType === null || $titleKey === null) {
            return;
        }

        $recipients = array_values(array_unique(array_filter(
            $notifyUserIds,
            static fn ($userId): bool => is_int($userId) && $userId > 0 && $userId !== $actorId
        )));

        foreach ($recipients as $userId) {
            try {
                CodeMartV1NotificationModel::createRecord([
                    'user_id' => $userId,
                    'type' => $notificationType,
                    'title_key' => $titleKey,
                    'body_key' => $bodyKey,
                    'params' => $params + ['action' => $action, 'to_state' => $toState],
                    'resource_type' => $resourceType,
                    'resource_id' => $resourceId,
                ]);
            } catch (\Throwable $e) {
                Log::warning('[CodeMartV1DomainEvent] notification failed: ' . $e->getMessage());
            }
        }
    }
}
