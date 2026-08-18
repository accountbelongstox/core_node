<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\DingDuoDuoV1\DingDuoDuoV1Controllers\DingDuoDuoV1Admin;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Http\Controllers\Controller;
use Illuminate\Database\QueryException;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Models\DingDuoDuoV1PddBindingModel;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Constants\DingDuoDuoV1ErrorCodes;

/**
 * Admin cross-PDD-user management: list / add / remove the PDD users a member or
 * super-code is allowed to manage. Guarded by 'custom.authenticate' at the route
 * layer.
 */
class DingDuoDuoV1BindingAdminController extends Controller
{
    /**
     * GET admin/bindings -> bindings, optionally scoped to ?owner_type=&owner_id=.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = max(1, min(200, (int) $request->input('per_page', 50)));
        $ownerType = trim((string) $request->input('owner_type', ''));
        $ownerId = trim((string) $request->input('owner_id', ''));

        return response()->json([
            'success' => true,
            'data' => DingDuoDuoV1PddBindingModel::adminPage($ownerType, $ownerId, $perPage),
        ]);
    }

    /**
     * POST admin/bindings {owner_type, owner_id, pdd_user_id, nickname?} -> add a
     * binding (idempotent on the owner+pdd_user unique key).
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'owner_type' => ['required', 'string', 'in:member,super_code'],
            'owner_id' => ['required', 'string', 'max:64'],
            'pdd_user_id' => ['required', 'string', 'max:191'],
            'nickname' => ['nullable', 'string', 'max:191'],
            'status' => ['nullable', 'string', 'max:32'],
        ]);

        try {
            /** @var DingDuoDuoV1PddBindingModel $binding */
            $binding = DingDuoDuoV1PddBindingModel::findOrNewBinding(
                $data['owner_type'],
                $data['owner_id'],
                $data['pdd_user_id']
            );
            $binding->nickname = $data['nickname'] ?? $binding->nickname;
            $binding->status = $data['status'] ?? ($binding->status ?: 'active');
            $binding->saveRecord();
        } catch (QueryException $e) {
            $binding = DingDuoDuoV1PddBindingModel::findBinding(
                $data['owner_type'],
                $data['owner_id'],
                $data['pdd_user_id']
            );
            if (!$binding) {
                throw $e;
            }
        }

        return response()->json([
            'success' => true,
            'data' => $binding->toArray(),
        ]);
    }

    /**
     * DELETE admin/bindings/{id} -> remove a binding.
     */
    public function destroy(int $id): JsonResponse
    {
        $binding = DingDuoDuoV1PddBindingModel::findById($id);
        if (!$binding) {
            return response()->json([
                'success' => false,
                'message' => DingDuoDuoV1ErrorCodes::getMessage(DingDuoDuoV1ErrorCodes::BINDING_NOT_FOUND),
                'code' => DingDuoDuoV1ErrorCodes::BINDING_NOT_FOUND,
            ], 404);
        }

        $binding->deleteRecord();

        return response()->json([
            'success' => true,
            'message' => 'Binding removed',
        ]);
    }
}
