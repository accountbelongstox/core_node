<?php
namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1MilestoneModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectAttachmentModel;
use App\Apps\CodeMartV1\CodeMartV1Utils\CodeMartV1FileUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class CodeMartV1ProjectCtl extends Controller
{
    use ApiResponse;

    private CodeMartV1FileUploadService $fileUploadService;

    public function __construct(CodeMartV1FileUploadService $fileUploadService)
    {
        $this->fileUploadService = $fileUploadService;
    }

    public function getProjects(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $query = CodeMartV1ProjectModel::query();

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('complexity')) {
            $query->where('complexity', $request->complexity);
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
        $projects = $query->orderBy('created_at', 'desc')
                          ->offset(($page - 1) * $pageSize)
                          ->limit($pageSize)
                          ->get();

        return $this->success([
            'projects' => $projects,
            'pagination' => [
                'page' => $page,
                'pageSize' => $pageSize,
                'total' => $total,
                'totalPages' => ceil($total / $pageSize),
            ],
        ]);
    }

    public function createProject(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

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
            return $this->error('Validation failed', 422, $validator->errors());
        }

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
            'required_skills' => json_encode($request->skills ?? []),
            'languages' => json_encode($request->languages ?? []),
            'frameworks' => json_encode($request->frameworks ?? []),
            'databases' => json_encode($request->databases ?? []),
            'status' => 'draft',
        ]);

        DB::commit();

        return $this->success($project, 'Project created successfully', 201);
    }

    public function getProject(Request $request, $projectId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $project = CodeMartV1ProjectModel::with(['milestones', 'attachments'])->find($projectId);

        if (!$project) {
            return $this->notFound('Project not found');
        }

        if ($project->client_id !== $user->id && $project->architect_id !== $user->id) {
            return $this->forbidden('You do not have access to this project');
        }

        return $this->success($project);
    }

    public function updateProject(Request $request, $projectId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $project = CodeMartV1ProjectModel::find($projectId);

        if (!$project) {
            return $this->notFound('Project not found');
        }

        if ($project->client_id !== $user->id) {
            return $this->forbidden('Only the project owner can update this project');
        }

        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|string|max:255',
            'description' => 'sometimes|string',
            'status' => 'sometimes|in:draft,open,in_progress,paused,completed,cancelled,archived',
            'complexity' => 'sometimes|in:simple,medium,complex,very_complex',
            'budget' => 'sometimes|numeric|min:100',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        DB::beginTransaction();

        $project->update($request->only([
            'title',
            'description',
            'status',
            'complexity',
            'budget',
        ]));

        DB::commit();

        return $this->success($project, 'Project updated successfully');
    }

    public function publishProject(Request $request, $projectId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $project = CodeMartV1ProjectModel::find($projectId);

        if (!$project) {
            return $this->notFound('Project not found');
        }

        if ($project->client_id !== $user->id) {
            return $this->forbidden('Only the project owner can publish this project');
        }

        if ($project->status !== 'draft') {
            return $this->error('Only draft projects can be published');
        }

        DB::beginTransaction();

        $project->update([
            'status' => 'open',
            'published_at' => now(),
        ]);

        DB::commit();

        return $this->success($project, 'Project published successfully');
    }

    public function createMilestone(Request $request, $projectId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $project = CodeMartV1ProjectModel::find($projectId);

        if (!$project) {
            return $this->notFound('Project not found');
        }

        if ($project->client_id !== $user->id && $project->architect_id !== $user->id) {
            return $this->forbidden('You do not have permission to create milestones for this project');
        }

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'due_date' => 'required|date|after:today',
            'budget' => 'required|numeric|min:0',
            'deliverables' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        DB::beginTransaction();

        $milestone = CodeMartV1MilestoneModel::create([
            'project_id' => $projectId,
            'title' => $request->title,
            'description' => $request->description,
            'due_date' => $request->due_date,
            'budget' => $request->budget,
            'deliverables' => json_encode($request->deliverables ?? []),
            'status' => 'pending',
        ]);

        DB::commit();

        return $this->success($milestone, 'Milestone created successfully', 201);
    }

    public function uploadProjectAttachment(Request $request, $projectId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $project = CodeMartV1ProjectModel::find($projectId);

        if (!$project) {
            return $this->notFound('Project not found');
        }

        if ($project->client_id !== $user->id) {
            return $this->forbidden('Only the project owner can upload attachments');
        }

        $validator = Validator::make($request->all(), [
            'file' => 'required|file|max:10240',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        DB::beginTransaction();

        $uploadResult = $this->fileUploadService->uploadFile($request->file('file'), 'projects');

        $attachment = CodeMartV1ProjectAttachmentModel::create([
            'project_id' => $projectId,
            'file_name' => $uploadResult['original_name'],
            'file_path' => $uploadResult['path'],
            'file_size' => $uploadResult['size'],
            'file_type' => $uploadResult['mime_type'],
            'uploaded_by' => $user->id,
        ]);

        DB::commit();

        return $this->success($attachment, 'Attachment uploaded successfully', 201);
    }
}
