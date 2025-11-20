<?php
namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Http\Controllers\Controller;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1MilestoneModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectProposalModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectAttachmentModel;
use App\Apps\CodeMartV1\CodeMartV1Utils\CodeMartV1FileUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class CodeMartV1ProjectCtl extends Controller
{
    private CodeMartV1FileUploadService $fileUploadService;

    public function __construct(CodeMartV1FileUploadService $fileUploadService)
    {
        $this->fileUploadService = $fileUploadService;
    }

    public function getProjects(Request $request): JsonResponse
    {
        $query = CodeMartV1ProjectModel::query();

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('complexity')) {
            $query->where('complexity', $request->complexity);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where('title', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
        }

        $page = $request->get('page', 1);
        $pageSize = $request->get('pageSize', 20);

        $total = $query->count();
        $projects = $query->orderBy('created_at', 'desc')
                          ->paginate($pageSize, ['*'], 'page', $page);

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $projects->items(),
                'total' => $total,
                'page' => $page,
                'pageSize' => $pageSize,
                'totalPages' => ceil($total / $pageSize),
            ],
        ], 200);
    }

    public function createProject(Request $request): JsonResponse
    {
        $user = auth()->guard('sanctum')->user();

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'complexity' => 'required|in:simple,medium,complex,very_complex',
            'budget' => 'required|numeric|min:100',
            'budget_type' => 'required|in:fixed,hourly',
            'currency' => 'required|string|size:3',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after:start_date',
            'skills' => 'nullable|array',
            'languages' => 'nullable|array',
            'frameworks' => 'nullable|array',
            'databases' => 'nullable|array',
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

            $project = CodeMartV1ProjectModel::create([
                'client_id' => $user->id,
                'title' => $request->title,
                'description' => $request->description,
                'complexity' => $request->complexity,
                'budget' => $request->budget,
                'budget_type' => $request->budget_type,
                'currency' => $request->currency,
                'start_date' => $request->start_date,
                'end_date' => $request->end_date,
                'skills' => $request->skills,
                'languages' => $request->languages,
                'frameworks' => $request->frameworks,
                'databases' => $request->databases,
                'status' => 'draft',
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Project created successfully',
                'data' => $project,
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to create project: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function getProject(int $projectId): JsonResponse
    {
        $project = CodeMartV1ProjectModel::with([
            'client',
            'milestones',
            'proposal',
            'attachments',
        ])->find($projectId);

        if (!$project) {
            return response()->json([
                'success' => false,
                'message' => 'Project not found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $project,
        ], 200);
    }

    public function updateProject(Request $request, int $projectId): JsonResponse
    {
        $user = auth()->guard('sanctum')->user();
        $project = CodeMartV1ProjectModel::find($projectId);

        if (!$project) {
            return response()->json(['success' => false, 'message' => 'Project not found'], 404);
        }

        if ($project->client_id !== $user->id && $user->rolelevel < 2) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|string|max:255',
            'description' => 'sometimes|string',
            'status' => 'sometimes|in:draft,open,in_progress,paused,completed,cancelled,archived',
            'complexity' => 'sometimes|in:simple,medium,complex,very_complex',
            'budget' => 'sometimes|numeric|min:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $project->update($validator->validated());

            return response()->json([
                'success' => true,
                'message' => 'Project updated successfully',
                'data' => $project,
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update project: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function publishProject(int $projectId): JsonResponse
    {
        $user = auth()->guard('sanctum')->user();
        $project = CodeMartV1ProjectModel::find($projectId);

        if (!$project) {
            return response()->json(['success' => false, 'message' => 'Project not found'], 404);
        }

        if ($project->client_id !== $user->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        try {
            $project->update(['status' => 'open']);

            return response()->json([
                'success' => true,
                'message' => 'Project published successfully',
                'data' => $project,
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to publish project: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function createMilestone(Request $request, int $projectId): JsonResponse
    {
        $user = auth()->guard('sanctum')->user();
        $project = CodeMartV1ProjectModel::find($projectId);

        if (!$project) {
            return response()->json(['success' => false, 'message' => 'Project not found'], 404);
        }

        if ($project->client_id !== $user->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'due_date' => 'required|date|after:today',
            'budget' => 'required|numeric|min:0',
            'deliverables' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            DB::beginTransaction();

            $order = $project->milestones()->max('order') ?? 0;

            $milestone = CodeMartV1MilestoneModel::create([
                'project_id' => $projectId,
                'title' => $request->title,
                'description' => $request->description,
                'due_date' => $request->due_date,
                'budget' => $request->budget,
                'deliverables' => $request->deliverables,
                'order' => $order + 1,
            ]);

            $project->update(['total_milestones' => $project->total_milestones + 1]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Milestone created successfully',
                'data' => $milestone,
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to create milestone: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function uploadProjectAttachment(Request $request, int $projectId): JsonResponse
    {
        $user = auth()->guard('sanctum')->user();
        $project = CodeMartV1ProjectModel::find($projectId);

        if (!$project) {
            return response()->json(['success' => false, 'message' => 'Project not found'], 404);
        }

        if ($project->client_id !== $user->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'file' => 'required|file|max:10240',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $file = $request->file('file');
            $fileName = time() . '_' . $file->getClientOriginalName();
            $path = 'codemart/projects/' . $projectId . '/' . $fileName;

            \Storage::disk('public')->putFileAs(
                'codemart/projects/' . $projectId,
                $file,
                $fileName
            );

            $attachment = CodeMartV1ProjectAttachmentModel::create([
                'project_id' => $projectId,
                'file_name' => $fileName,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'size' => $file->getSize(),
                'path' => $path,
                'uploaded_by' => $user->id,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'File uploaded successfully',
                'data' => $attachment,
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to upload file: ' . $e->getMessage(),
            ], 500);
        }
    }
}
