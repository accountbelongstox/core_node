<?php

namespace App\Apps\CodeMartV1\CodeMartV1Services;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1DeveloperStatsModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskModel;
use Illuminate\Support\Facades\DB;

/**
 * Single owner of project status changes. Every change is checked against
 * CodeMartV1Constants::PROJECT_TRANSITIONS for the acting role, applied under
 * a row lock, and emitted through CodeMartV1DomainEventService.
 *
 * Result: success => ['ok' => true, 'error_code' => null, 'from' => ..., 'to' => ..., 'project' => model]
 *         failure => ['ok' => false, 'error_code' => ..., 'http_status' => ..., 'message' => ..., 'details' => ...]
 */
class CodeMartV1ProjectStateService
{
    public const ACTION_STATUS_CHANGED = 'status_changed';
    public const ACTION_ANALYSIS_COMPLETED = 'analysis_completed';
    public const ACTION_PROPOSAL_ACCEPTED = 'proposal_accepted';
    public const ACTION_REVISION_REQUESTED = 'revision_requested';
    public const ACTION_FIRST_TASK_ACCEPTED = 'first_task_accepted';
    public const ACTION_FUNDED = 'funded';
    public const ACTION_TASKS_OPENED = 'tasks_opened';
    public const ACTION_TASK_CANCELLED_BY_PROJECT = 'cancelled_by_project';

    /** Owner (or administrator with $asAdmin) requested transition. */
    public static function transition(
        CodeMartV1ProjectModel $project,
        string $toStatus,
        ?int $actorId,
        ?string $reason = null,
        bool $asAdmin = false
    ): array {
        $actorRole = $asAdmin ? CodeMartV1Constants::TRANSITION_ACTOR_ADMIN : CodeMartV1Constants::TRANSITION_ACTOR_OWNER;

        if (!$asAdmin && ($actorId === null || !$project->isOwnedBy($actorId))) {
            return self::failure(CodeMartV1Constants::ERROR_ACCESS_DENIED, 403, 'Only the project owner can change the project status');
        }

        return self::apply($project, $toStatus, $actorId, $actorRole, self::ACTION_STATUS_CHANGED, $reason);
    }

    /** Flow-driven transition (analysis, proposal acceptance, funding, first acceptance). */
    public static function systemTransition(
        CodeMartV1ProjectModel $project,
        string $toStatus,
        ?int $actorId,
        string $action,
        ?string $reason = null,
        array $params = [],
        bool $notify = true
    ): array {
        return self::apply($project, $toStatus, $actorId, CodeMartV1Constants::TRANSITION_ACTOR_SYSTEM, $action, $reason, $params, $notify);
    }

    /** Targets the given actor role may request from the project's current status. */
    public static function allowedTargets(string $fromStatus, string $actorRole): array
    {
        $targets = [];
        foreach (CodeMartV1Constants::PROJECT_TRANSITIONS[$fromStatus] ?? [] as $toStatus => $actors) {
            if (in_array($actorRole, $actors, true)) {
                $targets[] = $toStatus;
            }
        }

        return $targets;
    }

    /**
     * Pending tasks become marketplace-visible once the project accepts work
     * (open / in_progress). Called on every transition into open and by the
     * funding flow. Returns the number of opened tasks.
     */
    public static function openPendingTasks(CodeMartV1ProjectModel $project, ?int $actorId = null): int
    {
        $opened = 0;
        $fresh = CodeMartV1ProjectModel::findById((int) $project->id);

        if (!$fresh || !$fresh->acceptsWork()) {
            return 0;
        }

        $pendingTasks = CodeMartV1TaskModel::forProjectInStatuses((int) $fresh->id, [CodeMartV1Constants::TASK_STATUS_PENDING]);
        foreach ($pendingTasks as $task) {
            if (CodeMartV1TaskModel::compareAndSetStatus(
                (int) $task->id,
                CodeMartV1Constants::TASK_STATUS_PENDING,
                CodeMartV1Constants::TASK_STATUS_OPEN
            )) {
                $opened++;
                CodeMartV1DomainEventService::emit(
                    $actorId,
                    CodeMartV1Constants::RESOURCE_TASK,
                    (int) $task->id,
                    self::ACTION_TASKS_OPENED,
                    CodeMartV1Constants::TASK_STATUS_PENDING,
                    CodeMartV1Constants::TASK_STATUS_OPEN,
                    [],
                    null,
                    null,
                    null,
                    ['project_id' => (int) $fresh->id]
                );
            }
        }

        return $opened;
    }

    private static function apply(
        CodeMartV1ProjectModel $project,
        string $toStatus,
        ?int $actorId,
        string $actorRole,
        string $action,
        ?string $reason,
        array $params = [],
        bool $notify = true
    ): array {
        if (!in_array($toStatus, CodeMartV1Constants::getAllProjectStatuses(), true)) {
            return self::failure(CodeMartV1Constants::ERROR_INVALID_PROJECT_TRANSITION, 422, 'Unknown project status', [
                'to' => $toStatus,
            ]);
        }

        $result = CodeMartV1ProjectModel::runInTransaction(function () use ($project, $toStatus, $actorId, $actorRole, $action, $reason, $params, $notify): array {
            $locked = CodeMartV1ProjectModel::lockById((int) $project->id);
            if (!$locked) {
                return self::failure(CodeMartV1Constants::ERROR_PROJECT_NOT_FOUND, 404, 'Project not found');
            }

            $fromStatus = (string) $locked->status;
            if (!in_array($actorRole, CodeMartV1Constants::projectTransitionActors($fromStatus, $toStatus), true)) {
                return self::failure(CodeMartV1Constants::ERROR_INVALID_PROJECT_TRANSITION, 409, 'Project status transition is not allowed', [
                    'from' => $fromStatus,
                    'to' => $toStatus,
                    'allowed' => self::allowedTargets($fromStatus, $actorRole),
                ]);
            }

            if ($toStatus === CodeMartV1Constants::PROJECT_STATUS_COMPLETED
                && CodeMartV1TaskModel::unfinishedCountForProject((int) $locked->id) > 0) {
                return self::failure(CodeMartV1Constants::ERROR_PROJECT_TASKS_UNFINISHED, 409, 'All tasks must be completed or cancelled first', [
                    'unfinished_tasks' => CodeMartV1TaskModel::unfinishedCountForProject((int) $locked->id),
                ]);
            }

            $attributes = [
                'status' => $toStatus,
                'state_revision' => DB::raw('COALESCE(state_revision, 0) + 1'),
                'updated_at' => now(),
            ];
            if ($toStatus === CodeMartV1Constants::PROJECT_STATUS_OPEN && $locked->published_at === null) {
                $attributes['published_at'] = now();
            }
            CodeMartV1ProjectModel::query()->whereKey($locked->id)->update($attributes);
            $locked->refresh();

            $sideEffects = self::applySideEffects($locked, $toStatus, $actorId);

            CodeMartV1DomainEventService::emit(
                $actorId,
                CodeMartV1Constants::RESOURCE_PROJECT,
                (int) $locked->id,
                $action,
                $fromStatus,
                $toStatus,
                $notify ? array_merge($locked->managerIds(), CodeMartV1TaskModel::assigneeIdsForProject((int) $locked->id)) : [],
                $notify ? CodeMartV1Constants::NOTIFICATION_TYPE_TASK : null,
                $notify ? CodeMartV1Constants::NOTIFY_PROJECT_STATUS_CHANGED : null,
                $notify ? CodeMartV1Constants::NOTIFY_PROJECT_STATUS_CHANGED_BODY : null,
                array_merge($params, [
                    'project_id' => (int) $locked->id,
                    'project_title' => (string) $locked->title,
                    'from_state' => $fromStatus,
                    'reason' => $reason,
                    'actor_role' => $actorRole,
                ], $sideEffects)
            );

            return [
                'ok' => true,
                'error_code' => null,
                'from' => $fromStatus,
                'to' => $toStatus,
                'project' => $locked,
                'side_effects' => $sideEffects,
            ];
        });

        if (($result['ok'] ?? false) === true) {
            $project->setRawAttributes($result['project']->getAttributes(), true);
        }

        return $result;
    }

    private static function applySideEffects(CodeMartV1ProjectModel $project, string $toStatus, ?int $actorId): array
    {
        $effects = [];

        if ($toStatus === CodeMartV1Constants::PROJECT_STATUS_OPEN) {
            $effects['opened_tasks'] = self::openPendingTasks($project, $actorId);
        }

        if ($toStatus === CodeMartV1Constants::PROJECT_STATUS_CANCELLED) {
            $effects['cancelled_tasks'] = self::cancelUnfinishedTasks($project, $actorId);
        }

        if ($toStatus === CodeMartV1Constants::PROJECT_STATUS_COMPLETED) {
            $developerIds = CodeMartV1TaskModel::assigneeIdsForProject(
                (int) $project->id,
                [CodeMartV1Constants::TASK_STATUS_COMPLETED]
            );
            CodeMartV1DeveloperStatsModel::recordProjectCompletion($developerIds);
            $effects['credited_developers'] = count($developerIds);
        }

        return $effects;
    }

    private static function cancelUnfinishedTasks(CodeMartV1ProjectModel $project, ?int $actorId): int
    {
        $cancelled = 0;
        $tasks = CodeMartV1TaskModel::forProjectQuery((int) $project->id)
            ->whereNotIn('status', CodeMartV1Constants::TASK_TERMINAL_STATUSES)
            ->get();

        foreach ($tasks as $task) {
            $fromStatus = (string) $task->status;
            if (CodeMartV1TaskModel::compareAndSetStatus((int) $task->id, $fromStatus, CodeMartV1Constants::TASK_STATUS_CANCELLED)) {
                $cancelled++;
                CodeMartV1DomainEventService::emit(
                    $actorId,
                    CodeMartV1Constants::RESOURCE_TASK,
                    (int) $task->id,
                    self::ACTION_TASK_CANCELLED_BY_PROJECT,
                    $fromStatus,
                    CodeMartV1Constants::TASK_STATUS_CANCELLED,
                    [],
                    null,
                    null,
                    null,
                    ['project_id' => (int) $project->id]
                );
            }
        }

        return $cancelled;
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
