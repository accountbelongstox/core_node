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

        $page = $request->get('page', 1);
        $pageSize = $request->get('pageSize', 20);

        $query = CodeMartV1ProjectModel::query()
            ->where(function ($scope) use ($user): void {
                $scope->where('client_id', $user->id)
                    ->orWhere('architect_id', $user->id);
            });

        foreach (['status', 'complexity'] as $field) {
            $value = $request->get($field);
            if ($value !== null && $value !== '') {
                $query->where($field, $value);
            }
        }
        $search = trim((string) $request->get('search', ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder->where('title', 'like', '%' . $search . '%')
                    ->orWhere('description', 'like', '%' . $search . '%');
            });
        }

        $total = (clone $query)->count();
        $projects = $query->orderByDesc('created_at')->forPage((int) $page, (int) $pageSize)->get();

        return $this->success([
            'projects' => $projects,
            'pagination' => [
                'page' => (int) $page,
                'pageSize' => (int) $pageSize,
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

        $project = CodeMartV1ProjectModel::runInTransaction(function () use ($request, $user) {
            return CodeMartV1ProjectModel::createRecord([
                'client_id' => $user->id,
                'title' => $request->title,
                'description' => $request->description,
                'complexity' => $request->complexity,
                'budget' => $request->budget,
                'budget_type' => $request->budget_type,
                'currency' => $request->currency,
                'start_date' => $request->start_date,
                'end_date' => $request->end_date,
                'skills' => $request->skills ?? [],
                'languages' => $request->languages ?? [],
                'frameworks' => $request->frameworks ?? [],
                'databases' => $request->databases ?? [],
                'status' => 'draft',
            ]);
        });

        return $this->success($project, 'Project created successfully', 201);
    }

    public function getProject(Request $request, $projectId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $project = CodeMartV1ProjectModel::findDetailed((int) $projectId);

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

        $project = CodeMartV1ProjectModel::findById((int) $projectId);

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

        CodeMartV1ProjectModel::runInTransaction(function () use ($project, $request) {
            $project->updateRecord($request->only([
                'title',
                'description',
                'status',
                'complexity',
                'budget',
            ]));
        });

        return $this->success($project, 'Project updated successfully');
    }

    public function publishProject(Request $request, $projectId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $project = CodeMartV1ProjectModel::findById((int) $projectId);

        if (!$project) {
            return $this->notFound('Project not found');
        }

        if ($project->client_id !== $user->id) {
            return $this->forbidden('Only the project owner can publish this project');
        }

        if ($project->status !== 'draft') {
            return $this->error('Only draft projects can be published');
        }

        CodeMartV1ProjectModel::runInTransaction(function () use ($project) {
            $project->updateRecord([
                'status' => 'open',
                'published_at' => now(),
            ]);
        });

        return $this->success($project, 'Project published successfully');
    }

    public function createMilestone(Request $request, $projectId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $project = CodeMartV1ProjectModel::findById((int) $projectId);

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

        $milestone = CodeMartV1ProjectModel::runInTransaction(function () use ($request, $projectId) {
            return CodeMartV1MilestoneModel::createRecord([
                'project_id' => $projectId,
                'title' => $request->title,
                'description' => $request->description,
                'due_date' => $request->due_date,
                'budget' => $request->budget,
                'deliverables' => json_encode($request->deliverables ?? []),
                'status' => 'pending',
            ]);
        });

        return $this->success($milestone, 'Milestone created successfully', 201);
    }

    public function uploadProjectAttachment(Request $request, $projectId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $project = CodeMartV1ProjectModel::findById((int) $projectId);

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

        $uploadResult = $this->fileUploadService->uploadFile($request->file('file'), 'projects');

        $attachment = CodeMartV1ProjectModel::runInTransaction(function () use ($uploadResult, $projectId, $user) {
            return CodeMartV1ProjectAttachmentModel::createRecord([
                'project_id' => $projectId,
                'file_name' => $uploadResult['original_name'],
                'file_path' => $uploadResult['path'],
                'file_size' => $uploadResult['size'],
                'file_type' => $uploadResult['mime_type'],
                'uploaded_by' => $user->id,
            ]);
        });

        return $this->success($attachment, 'Attachment uploaded successfully', 201);
    }
}
