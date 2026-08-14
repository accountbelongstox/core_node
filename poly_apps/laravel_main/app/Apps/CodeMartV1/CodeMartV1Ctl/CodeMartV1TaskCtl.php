<?php

namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskSubmissionModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskCommentModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1CodeReviewModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1MilestoneModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CodeMartV1TaskCtl extends Controller
{
    use ApiResponse;

    public function getTasks(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $page = $request->get('page', 1);
        $pageSize = $request->get('pageSize', 20);
        $filters = $request->only(['milestone_id', 'status', 'priority', 'assigned_to', 'search']);
        $result = CodeMartV1TaskModel::filteredPage($filters, (int) $page, (int) $pageSize);
        $tasks = $result['tasks'];
        $total = $result['total'];

        return $this->success([
            'items' => $tasks->items(),
            'total' => $total,
            'page' => $page,
            'pageSize' => $pageSize,
            'totalPages' => ceil($total / $pageSize),
        ]);
    }

    public function createTask(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $milestone = CodeMartV1MilestoneModel::findById((int) $request->milestone_id);

        if (!$milestone) {
            return $this->notFound('Milestone not found');
        }

        $validator = Validator::make($request->all(), [
            'milestone_id' => 'required|exists:codemart_milestones,id',
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'priority' => 'required|in:low,medium,high,urgent',
            'assigned_to' => 'nullable|exists:users,id',
            'due_date' => 'nullable|date|after:today',
            'deliverables' => 'nullable|array',
            'budget_allocation' => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        CodeMartV1TaskModel::beginModelTransaction();

        $task = CodeMartV1TaskModel::createForMilestone((int) $request->milestone_id, [
            'title' => $request->title,
            'description' => $request->description,
            'priority' => $request->priority,
            'assigned_to' => $request->assigned_to,
            'due_date' => $request->due_date,
            'deliverables' => $request->deliverables,
            'budget_allocation' => $request->budget_allocation,
        ]);

        CodeMartV1TaskModel::commitModelTransaction();

        return $this->success($task->loadRecordRelations(['milestone', 'assignee']), 'Task created successfully', 201);
    }

    public function getTask(Request $request, int $taskId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $task = CodeMartV1TaskModel::findDetailed($taskId);

        if (!$task) {
            return $this->notFound('Task not found');
        }

        return $this->success($task);
    }

    public function updateTask(Request $request, int $taskId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $task = CodeMartV1TaskModel::findById($taskId);

        if (!$task) {
            return $this->notFound('Task not found');
        }

        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|string|max:255',
            'description' => 'sometimes|string',
            'status' => 'sometimes|in:pending,in_progress,review,completed,blocked',
            'priority' => 'sometimes|in:low,medium,high,urgent',
            'assigned_to' => 'sometimes|nullable|exists:users,id',
            'due_date' => 'sometimes|nullable|date',
            'deliverables' => 'sometimes|nullable|array',
            'budget_allocation' => 'sometimes|nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        $task->updateRecord($validator->validated());

        return $this->success($task->loadRecordRelations(['milestone', 'assignee']), 'Task updated successfully');
    }

    public function submitTask(Request $request, int $taskId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $task = CodeMartV1TaskModel::findById($taskId);

        if (!$task) {
            return $this->notFound('Task not found');
        }

        $validator = Validator::make($request->all(), [
            'submission_note' => 'nullable|string',
            'files' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        CodeMartV1TaskModel::beginModelTransaction();

        $submission = CodeMartV1TaskSubmissionModel::createRecord([
            'task_id' => $taskId,
            'submitted_by' => $user->id,
            'submission_note' => $request->submission_note,
            'files' => $request->files,
            'status' => 'pending',
        ]);

        $task->updateRecord(['status' => 'review']);

        CodeMartV1TaskModel::commitModelTransaction();

        return $this->success($submission->loadRecordRelations(['task', 'submitter']), 'Task submitted successfully', 201);
    }

    public function addComment(Request $request, int $taskId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $task = CodeMartV1TaskModel::findById($taskId);

        if (!$task) {
            return $this->notFound('Task not found');
        }

        $validator = Validator::make($request->all(), [
            'comment' => 'required|string',
            'mentions' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        $comment = CodeMartV1TaskCommentModel::createRecord([
            'task_id' => $taskId,
            'user_id' => $user->id,
            'comment' => $request->comment,
            'mentions' => $request->mentions,
        ]);

        return $this->success($comment->loadRecordRelations(['user']), 'Comment added successfully', 201);
    }

    public function reviewSubmission(Request $request, int $submissionId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $submission = CodeMartV1TaskSubmissionModel::findById($submissionId);

        if (!$submission) {
            return $this->notFound('Submission not found');
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|in:approved,needs_revision,rejected',
            'review_notes' => 'required|string',
            'rating' => 'nullable|integer|min:1|max:5',
            'line_comments' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        CodeMartV1TaskModel::beginModelTransaction();

        $review = CodeMartV1CodeReviewModel::createRecord([
            'task_submission_id' => $submissionId,
            'reviewer_id' => $user->id,
            'status' => $request->status,
            'review_notes' => $request->review_notes,
            'rating' => $request->rating,
            'line_comments' => $request->line_comments,
        ]);

        $submission->updateRecord(['status' => $request->status]);

        $task = $submission->task;
        if ($request->status === 'approved') {
            $task->updateRecord(['status' => 'completed']);
        } elseif ($request->status === 'needs_revision') {
            $task->updateRecord(['status' => 'in_progress']);
        }

        CodeMartV1TaskModel::commitModelTransaction();

        return $this->success($review->loadRecordRelations(['submission', 'reviewer']), 'Review submitted successfully', 201);
    }
}
