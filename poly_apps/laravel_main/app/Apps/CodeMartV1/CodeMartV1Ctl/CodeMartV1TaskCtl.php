<?php

namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Http\Controllers\Controller;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskSubmissionModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskCommentModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1CodeReviewModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1MilestoneModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class CodeMartV1TaskCtl extends Controller
{
    public function getTasks(Request $request): JsonResponse
    {
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
            $query->where('title', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
        }

        $page = $request->get('page', 1);
        $pageSize = $request->get('pageSize', 20);

        $total = $query->count();
        $tasks = $query->orderBy('order', 'asc')
                       ->orderBy('created_at', 'desc')
                       ->paginate($pageSize, ['*'], 'page', $page);

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $tasks->items(),
                'total' => $total,
                'page' => $page,
                'pageSize' => $pageSize,
                'totalPages' => ceil($total / $pageSize),
            ],
        ], 200);
    }

    public function createTask(Request $request): JsonResponse
    {
        $user = auth()->guard('sanctum')->user();

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $milestone = CodeMartV1MilestoneModel::find($request->milestone_id);

        if (!$milestone) {
            return response()->json(['success' => false, 'message' => 'Milestone not found'], 404);
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
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            DB::beginTransaction();

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

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Task created successfully',
                'data' => $task->load(['milestone', 'assignee']),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to create task: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function getTask(int $taskId): JsonResponse
    {
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
            return response()->json(['success' => false, 'message' => 'Task not found'], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $task,
        ], 200);
    }

    public function updateTask(Request $request, int $taskId): JsonResponse
    {
        $task = CodeMartV1TaskModel::find($taskId);

        if (!$task) {
            return response()->json(['success' => false, 'message' => 'Task not found'], 404);
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
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $task->update($validator->validated());

            return response()->json([
                'success' => true,
                'message' => 'Task updated successfully',
                'data' => $task->load(['milestone', 'assignee']),
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update task: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function submitTask(Request $request, int $taskId): JsonResponse
    {
        $user = auth()->guard('sanctum')->user();

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $task = CodeMartV1TaskModel::find($taskId);

        if (!$task) {
            return response()->json(['success' => false, 'message' => 'Task not found'], 404);
        }

        $validator = Validator::make($request->all(), [
            'submission_note' => 'nullable|string',
            'files' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            DB::beginTransaction();

            $submission = CodeMartV1TaskSubmissionModel::create([
                'task_id' => $taskId,
                'submitted_by' => $user->id,
                'submission_note' => $request->submission_note,
                'files' => $request->files,
                'status' => 'pending',
            ]);

            $task->update(['status' => 'review']);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Task submitted successfully',
                'data' => $submission->load(['task', 'submitter']),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to submit task: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function addComment(Request $request, int $taskId): JsonResponse
    {
        $user = auth()->guard('sanctum')->user();

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $task = CodeMartV1TaskModel::find($taskId);

        if (!$task) {
            return response()->json(['success' => false, 'message' => 'Task not found'], 404);
        }

        $validator = Validator::make($request->all(), [
            'comment' => 'required|string',
            'mentions' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $comment = CodeMartV1TaskCommentModel::create([
                'task_id' => $taskId,
                'user_id' => $user->id,
                'comment' => $request->comment,
                'mentions' => $request->mentions,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Comment added successfully',
                'data' => $comment->load(['user']),
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to add comment: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function reviewSubmission(Request $request, int $submissionId): JsonResponse
    {
        $user = auth()->guard('sanctum')->user();

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $submission = CodeMartV1TaskSubmissionModel::find($submissionId);

        if (!$submission) {
            return response()->json(['success' => false, 'message' => 'Submission not found'], 404);
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|in:approved,needs_revision,rejected',
            'review_notes' => 'required|string',
            'rating' => 'nullable|integer|min:1|max:5',
            'line_comments' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            DB::beginTransaction();

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

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Review submitted successfully',
                'data' => $review->load(['submission', 'reviewer']),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to submit review: ' . $e->getMessage(),
            ], 500);
        }
    }
}
