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

        $result = CodeMartV1TaskModel::marketplacePage(
            $skills,
            (float) $minBudget,
            (float) $maxBudget,
            (int) $page,
            (int) $pageSize
        );
        $total = $result['total'];
        $tasks = $result['tasks'];

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

        if (!CodeMartV1TaskModel::acceptOpenTask((int) $taskId, $user->id)) {
            return $this->notFound('Task not found or already assigned');
        }

        return $this->success([
            'message' => 'Task accepted successfully',
            'task_id' => $taskId,
        ]);
    }

    public function getMyTasks(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $tasks = CodeMartV1TaskModel::assignedTasks($user->id);

        return $this->success(['my_tasks' => $tasks]);
    }
}
