<?php

namespace App\Apps\CodeMartV1\CodeMartV1Services;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskModel;

/**
 * Single owner of task status changes, checked against
 * CodeMartV1Constants::TASK_TRANSITIONS and applied as compare-and-set.
 *
 * Result: success => ['ok' => true, 'error_code' => null, 'from' => ..., 'to' => ..., 'task' => model]
 *         failure => ['ok' => false, 'error_code' => ..., 'http_status' => ..., 'message' => ..., 'details' => ...]
 */
class CodeMartV1TaskStateService
{
    public const ACTION_STATUS_CHANGED = 'status_changed';
    public const ACTION_ACCEPTED = 'accepted';
    public const ACTION_SUBMITTED = 'submitted';
    public const ACTION_APPROVED = 'approved';
    public const ACTION_REVISION_REQUESTED = 'revision_requested';
    public const ACTION_REJECTED = 'rejected';

    /** Party roles (manager / assignee) the user holds on a task. */
    public static function actorRoles(CodeMartV1TaskModel $task, ?CodeMartV1ProjectModel $project, int $userId): array
    {
        $roles = [];
        if ($project && $project->isManagedBy($userId)) {
            $roles[] = CodeMartV1Constants::TRANSITION_ACTOR_MANAGER;
        }
        if ($task->assigned_to !== null && (int) $task->assigned_to === $userId) {
            $roles[] = CodeMartV1Constants::TRANSITION_ACTOR_ASSIGNEE;
        }

        return $roles;
    }

    public static function allowedTargets(string $fromStatus, array $actorRoles): array
    {
        $targets = [];
        foreach (CodeMartV1Constants::TASK_TRANSITIONS[$fromStatus] ?? [] as $toStatus => $actors) {
            if (array_intersect($actorRoles, $actors) !== []) {
                $targets[] = $toStatus;
            }
        }

        return $targets;
    }

    /** User-requested transition (POST /tasks/{id}/transition). */
    public static function transition(CodeMartV1TaskModel $task, string $toStatus, int $actorId, ?string $reason = null): array
    {
        $project = $task->resolveProject();
        $roles = self::actorRoles($task, $project, $actorId);
        $fromStatus = (string) $task->status;

        if ($roles === []) {
            return self::failure(CodeMartV1Constants::ERROR_ACCESS_DENIED, 403, 'You are not a party of this task');
        }
        if (array_intersect($roles, CodeMartV1Constants::taskTransitionActors($fromStatus, $toStatus)) === []) {
            return self::failure(CodeMartV1Constants::ERROR_INVALID_TASK_TRANSITION, 409, 'Task status transition is not allowed', [
                'from' => $fromStatus,
                'to' => $toStatus,
                'allowed' => self::allowedTargets($fromStatus, $roles),
            ]);
        }
        if ($toStatus === CodeMartV1Constants::TASK_STATUS_IN_PROGRESS && (!$project || !$project->acceptsWork())) {
            return self::failure(CodeMartV1Constants::ERROR_PROJECT_INVALID_STATE, 409, 'The project does not accept work in its current status', [
                'project_status' => $project?->status,
            ]);
        }

        $extra = [];
        if ($toStatus === CodeMartV1Constants::TASK_STATUS_IN_PROGRESS && $task->started_at === null) {
            $extra['started_at'] = now();
        }

        return self::commit($task, $project, $fromStatus, $toStatus, $actorId, self::ACTION_STATUS_CHANGED, $extra, ['reason' => $reason]);
    }

    /**
     * Flow-driven transition (accept, submit, review). $notification:
     * null => default task status notification to all parties;
     * [] => activity only; ['title' => key, 'body' => key, 'type' => type, 'recipients' => ids] => custom.
     */
    public static function systemTransition(
        CodeMartV1TaskModel $task,
        string $toStatus,
        ?int $actorId,
        string $action,
        array $extra = [],
        array $params = [],
        ?array $notification = null
    ): array {
        $fromStatus = (string) $task->status;

        if (!in_array(CodeMartV1Constants::TRANSITION_ACTOR_SYSTEM, CodeMartV1Constants::taskTransitionActors($fromStatus, $toStatus), true)) {
            return self::failure(CodeMartV1Constants::ERROR_INVALID_TASK_TRANSITION, 409, 'Task status transition is not allowed', [
                'from' => $fromStatus,
                'to' => $toStatus,
            ]);
        }

        return self::commit($task, $task->resolveProject(), $fromStatus, $toStatus, $actorId, $action, $extra, $params, $notification);
    }

    private static function commit(
        CodeMartV1TaskModel $task,
        ?CodeMartV1ProjectModel $project,
        string $fromStatus,
        string $toStatus,
        ?int $actorId,
        string $action,
        array $extra,
        array $params,
        ?array $notification = null
    ): array {
        $previousAssignee = $task->assigned_to !== null ? (int) $task->assigned_to : 0;

        if (!CodeMartV1TaskModel::compareAndSetStatus((int) $task->id, $fromStatus, $toStatus, $extra)) {
            return self::failure(CodeMartV1Constants::ERROR_STATE_CONFLICT, 409, 'The task changed state concurrently', [
                'expected' => $fromStatus,
            ]);
        }
        $task->refresh();

        $parties = array_merge($project ? $project->managerIds() : [], [$previousAssignee]);
        $recipients = $notification['recipients'] ?? $parties;
        $notificationType = $notification === [] ? null : ($notification['type'] ?? CodeMartV1Constants::NOTIFICATION_TYPE_TASK);

        CodeMartV1DomainEventService::emit(
            $actorId,
            CodeMartV1Constants::RESOURCE_TASK,
            (int) $task->id,
            $action,
            $fromStatus,
            $toStatus,
            $notification === [] ? [] : $recipients,
            $notificationType,
            $notification === [] ? null : ($notification['title'] ?? CodeMartV1Constants::NOTIFY_TASK_STATUS_CHANGED),
            $notification === [] ? null : ($notification['body'] ?? CodeMartV1Constants::NOTIFY_TASK_STATUS_CHANGED_BODY),
            array_merge($params, [
                'task_id' => (int) $task->id,
                'task_title' => (string) $task->title,
                'project_id' => $project ? (int) $project->id : null,
                'from_state' => $fromStatus,
            ])
        );

        return [
            'ok' => true,
            'error_code' => null,
            'from' => $fromStatus,
            'to' => $toStatus,
            'task' => $task,
        ];
    }

    private static function failure(string $errorCode, int $httpStatus, string $message, ?array $details = null): array
    {
        return [
            'ok' => false,
            'error_code' => $errorCode,
            'http_status' => $httpStatus,
            'message' => $message,
            'details' => $details,
        ];
    }
}
