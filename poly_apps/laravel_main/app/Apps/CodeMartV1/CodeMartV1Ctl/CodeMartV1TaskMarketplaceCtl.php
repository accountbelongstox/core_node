<?php
namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CodeMartV1TaskMarketplaceCtl extends Controller
{
    use ApiResponse;

    public function browseTasks(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $page = $request->input('page', 1);
        $pageSize = $request->input('pageSize', 20);
        $skills = $request->input('skills', []);
        $minBudget = $request->input('min_budget', 0);
        $maxBudget = $request->input('max_budget', 999999);

        $model = new CodeMartV1TaskModel();
        $dbConnection = $model->getConnection();
        $query = $dbConnection
            ->table('codemart_v1_tasks')
            ->where('status', 'open')
            ->whereNull('assigned_to')
            ->whereBetween('budget_allocation', [$minBudget, $maxBudget]);

        if (!empty($skills)) {
            $query->where(function($q) use ($skills) {
                foreach ($skills as $skill) {
                    $q->orWhereRaw('JSON_CONTAINS(required_skills, ?)', [json_encode($skill)]);
                }
            });
        }

        $total = $query->count();
        $tasks = $query
            ->orderBy('created_at', 'desc')
            ->offset(($page - 1) * $pageSize)
            ->limit($pageSize)
            ->get();

        return $this->success([
            'tasks' => $tasks,
            'pagination' => [
                'page' => $page,
                'pageSize' => $pageSize,
                'total' => $total,
                'totalPages' => ceil($total / $pageSize),
            ],
        ]);
    }

    public function acceptTask(Request $request, $taskId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $model = new CodeMartV1TaskModel();
        $dbConnection = $model->getConnection();
        $task = $dbConnection
            ->table('codemart_v1_tasks')
            ->where('id', $taskId)
            ->where('status', 'open')
            ->whereNull('assigned_to')
            ->first();

        if (!$task) {
            return $this->notFound('Task not found or already assigned');
        }

        $dbConnection
            ->table('codemart_v1_tasks')
            ->where('id', $taskId)
            ->update([
                'assigned_to' => $user->id,
                'status' => 'in_progress',
                'assigned_at' => now(),
                'updated_at' => now(),
            ]);

        return $this->success([
            'message' => 'Task accepted successfully',
            'task_id' => $taskId,
        ]);
    }

    public function getMyTasks(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $model = new CodeMartV1TaskModel();
        $dbConnection = $model->getConnection();
        $tasks = $dbConnection
            ->table('codemart_v1_tasks')
            ->where('assigned_to', $user->id)
            ->whereIn('status', ['in_progress', 'review', 'completed'])
            ->orderBy('updated_at', 'desc')
            ->get();

        return $this->success(['my_tasks' => $tasks]);
    }
}
