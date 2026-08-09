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

        $query = CodeMartV1TaskModel::query()->with(['milestone', 'assignee']);

        if ($request->has('milestone_id')) {
            $query->where('milestone_id', $request->milestone_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('priority')) {
            $query->where('priority', $request->priority);
        }

        if ($request->has('assigned_to')) {
            $query->where('assigned_to', $request->assigned_to);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $page = $request->get('page', 1);
        $pageSize = $request->get('pageSize', 20);

        $total = $query->count();
        $tasks = $query->orderBy('order', 'asc')
                       ->orderBy('created_at', 'desc')
                       ->paginate($pageSize, ['*'], 'page', $page);

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

        $milestone = CodeMartV1MilestoneModel::find($request->milestone_id);

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

        $order = CodeMartV1TaskModel::where('milestone_id', $request->milestone_id)->max('order') ?? 0;

        $task = CodeMartV1TaskModel::create([
            'milestone_id' => $request->milestone_id,
            'title' => $request->title,
            'description' => $request->description,
            'priority' => $request->priority,
            'assigned_to' => $request->assigned_to,
            'due_date' => $request->due_date,
            'deliverables' => $request->deliverables,
            'budget_allocation' => $request->budget_allocation,
            'order' => $order + 1,
            'status' => 'pending',
        ]);

        CodeMartV1TaskModel::commitModelTransaction();

        return $this->success($task->load(['milestone', 'assignee']), 'Task created successfully', 201);
    }

    public function getTask(Request $request, int $taskId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $task = CodeMartV1TaskModel::with([
            'milestone',
            'assignee',
            'submissions' => function ($query) {
                $query->latest();
            },
            'comments' => function ($query) {
                $query->latest();
            },
        ])->find($taskId);

        if (!$task) {
            return $this->notFound('Task not found');
        }

        return $this->success($task);
    }

    public function updateTask(Request $request, int $taskId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $task = CodeMartV1TaskModel::find($taskId);

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

        $task->update($validator->validated());

        return $this->success($task->load(['milestone', 'assignee']), 'Task updated successfully');
    }

    public function submitTask(Request $request, int $taskId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $task = CodeMartV1TaskModel::find($taskId);

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

        $submission = CodeMartV1TaskSubmissionModel::create([
            'task_id' => $taskId,
            'submitted_by' => $user->id,
            'submission_note' => $request->submission_note,
            'files' => $request->files,
            'status' => 'pending',
        ]);

        $task->update(['status' => 'review']);

        CodeMartV1TaskModel::commitModelTransaction();

        return $this->success($submission->load(['task', 'submitter']), 'Task submitted successfully', 201);
    }

    public function addComment(Request $request, int $taskId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $task = CodeMartV1TaskModel::find($taskId);

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

        $comment = CodeMartV1TaskCommentModel::create([
            'task_id' => $taskId,
            'user_id' => $user->id,
            'comment' => $request->comment,
            'mentions' => $request->mentions,
        ]);

        return $this->success($comment->load(['user']), 'Comment added successfully', 201);
    }

    public function reviewSubmission(Request $request, int $submissionId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $submission = CodeMartV1TaskSubmissionModel::find($submissionId);

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

        $review = CodeMartV1CodeReviewModel::create([
            'task_submission_id' => $submissionId,
            'reviewer_id' => $user->id,
            'status' => $request->status,
            'review_notes' => $request->review_notes,
            'rating' => $request->rating,
            'line_comments' => $request->line_comments,
        ]);

        $submission->update(['status' => $request->status]);

        $task = $submission->task;
        if ($request->status === 'approved') {
            $task->update(['status' => 'completed']);
        } elseif ($request->status === 'needs_revision') {
            $task->update(['status' => 'in_progress']);
        }

        CodeMartV1TaskModel::commitModelTransaction();

        return $this->success($review->load(['submission', 'reviewer']), 'Review submitted successfully', 201);
    }
}
