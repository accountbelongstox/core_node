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
use Illuminate\Routing\Controller as BaseController;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Services\DingDuoDuoV1SuperCodeService;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Models\DingDuoDuoV1SuperCodeModel;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Constants\DingDuoDuoV1Constants;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Constants\DingDuoDuoV1ErrorCodes;

/**
 * Admin super-code management: list, issue (mint + persist), show, revoke. Guarded
 * by 'custom.authenticate' at the route layer.
 */
class DingDuoDuoV1SuperCodeAdminController extends BaseController
{
    /**
     * GET admin/super-codes -> paginated super-code list (optional ?status=).
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = max(1, min(100, (int) $request->input('per_page', 20)));
        $query = DingDuoDuoV1SuperCodeModel::query()->orderByDesc('id');

        $status = trim((string) $request->input('status', ''));
        if ($status !== '') {
            $query->where('status', $status);
        }

        return response()->json([
            'success' => true,
            'data' => $query->paginate($perPage),
        ]);
    }

    /**
     * GET admin/super-codes/{id} -> a single super code.
     */
    public function show(int $id): JsonResponse
    {
        $code = DingDuoDuoV1SuperCodeModel::query()->find($id);
        if (!$code) {
            return $this->notFound();
        }

        return response()->json([
            'success' => true,
            'data' => $code->toArray(),
        ]);
    }

    /**
     * POST admin/super-codes {label?, tier?, max_binds?, features?, scope?, expires_at?}
     * -> mint a verifiable code (from the label) and persist it.
     */
    public function issue(Request $request): JsonResponse
    {
        $data = $request->validate([
            'label' => ['nullable', 'string', 'max:191'],
            'tier' => ['nullable', 'string', 'max:32'],
            'max_binds' => ['nullable', 'integer', 'min:0'],
            'features' => ['nullable', 'array'],
            'scope' => ['nullable', 'array'],
            'expires_at' => ['nullable', 'date'],
        ]);

        $label = $data['label'] ?? '';
        $base = $label !== '' ? $label : ('VIP' . strtoupper(substr(uniqid(), -6)));
        $code = DingDuoDuoV1SuperCodeService::mint($base);

        $authUser = $request->user();
        $createdBy = $authUser?->username ?? $authUser?->id;

        /** @var DingDuoDuoV1SuperCodeModel $superCode */
        $superCode = DingDuoDuoV1SuperCodeModel::query()->firstOrNew(['code' => $code]);
        $superCode->label = $label !== '' ? $label : $superCode->label;
        $superCode->tier = $data['tier'] ?? DingDuoDuoV1Constants::TIER_UNLIMITED;
        $superCode->max_binds = (int) ($data['max_binds'] ?? 0);
        $superCode->features = array_values($data['features'] ?? ['*']);
        $superCode->scope = $data['scope'] ?? null;
        $superCode->expires_at = $data['expires_at'] ?? null;
        $superCode->status = DingDuoDuoV1SuperCodeModel::STATUS_ACTIVE;
        if ($createdBy !== null) {
            $superCode->created_by = (string) $createdBy;
        }
        $superCode->save();

        return response()->json([
            'success' => true,
            'data' => $superCode->fresh()->toArray(),
        ]);
    }

    /**
     * POST admin/super-codes/{id}/revoke -> mark a super code revoked.
     */
    public function revoke(int $id): JsonResponse
    {
        $code = DingDuoDuoV1SuperCodeModel::query()->find($id);
        if (!$code) {
            return $this->notFound();
        }

        $code->status = DingDuoDuoV1SuperCodeModel::STATUS_REVOKED;
        $code->save();

        return response()->json([
            'success' => true,
            'data' => $code->fresh()->toArray(),
        ]);
    }

    private function notFound(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => DingDuoDuoV1ErrorCodes::getMessage(DingDuoDuoV1ErrorCodes::SUPER_CODE_NOT_FOUND),
            'code' => DingDuoDuoV1ErrorCodes::SUPER_CODE_NOT_FOUND,
        ], 404);
    }
}
