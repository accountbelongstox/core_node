<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\PddToolV1\PddToolV1Controllers\PddToolV1Warehouse;

use Illuminate\Routing\Controller as BaseController;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;
use App\Apps\PddToolV1\PddToolV1Models\PddToolV1WarehouseModel;
use App\Apps\PddToolV1\PddToolV1Services\PddToolV1Presenter;
use App\Apps\PddToolV1\PddToolV1Services\PddToolV1ProfileResolver;

/**
 * Member warehouse (receiver address) CRUD, keyed by warehouse_code. All actions
 * behind 'custom.authenticate' (Sanctum bearer token).
 */
class PddToolV1WarehouseController extends BaseController
{
    /**
     * GET /users/me/warehouses -> [WAREHOUSE]
     */
    public function index(Request $request): JsonResponse
    {
        $user = PddToolV1ProfileResolver::user($request);
        if (!$user) {
            return response()->json(['detail' => 'Could not validate credentials'], 401);
        }

        $rows = PddToolV1WarehouseModel::forUser((int) $user->id);

        return response()->json($rows->map(fn ($w) => PddToolV1Presenter::warehouse($w))->all());
    }

    /**
     * POST /users/me/warehouses (WAREHOUSE) -> WAREHOUSE
     */
    public function store(Request $request): JsonResponse
    {
        $user = PddToolV1ProfileResolver::user($request);
        if (!$user) {
            return response()->json(['detail' => 'Could not validate credentials'], 401);
        }

        $code = trim((string) $request->input('warehouse_code', ''));
        if ($code === '') {
            $code = 'WH' . strtoupper(Str::random(10));
        }

        $existing = PddToolV1WarehouseModel::findForUser((int) $user->id, $code);

        $warehouse = $existing ?: new PddToolV1WarehouseModel();
        $warehouse->user_id = $user->id;
        $warehouse->warehouse_code = $code;
        $this->fillFromRequest($warehouse, $request);
        $warehouse->saveRecord();

        return response()->json(PddToolV1Presenter::warehouse($warehouse));
    }

    /**
     * PUT /users/me/warehouses/{warehouse_code} (WAREHOUSE) -> WAREHOUSE
     */
    public function update(Request $request, string $warehouseCode): JsonResponse
    {
        $user = PddToolV1ProfileResolver::user($request);
        if (!$user) {
            return response()->json(['detail' => 'Could not validate credentials'], 401);
        }

        $warehouse = PddToolV1WarehouseModel::findForUser((int) $user->id, $warehouseCode);

        if (!$warehouse) {
            return response()->json(['detail' => 'Warehouse not found'], 404);
        }

        $this->fillFromRequest($warehouse, $request);
        $warehouse->saveRecord();

        return response()->json(PddToolV1Presenter::warehouse($warehouse));
    }

    /**
     * DELETE /users/me/warehouses/{warehouse_code}
     */
    public function destroy(Request $request, string $warehouseCode): JsonResponse
    {
        $user = PddToolV1ProfileResolver::user($request);
        if (!$user) {
            return response()->json(['detail' => 'Could not validate credentials'], 401);
        }

        $deleted = PddToolV1WarehouseModel::deleteForUser((int) $user->id, $warehouseCode);

        if (!$deleted) {
            return response()->json(['detail' => 'Warehouse not found'], 404);
        }

        return response()->json(['success' => true, 'detail' => 'Warehouse deleted']);
    }

    private function fillFromRequest(PddToolV1WarehouseModel $warehouse, Request $request): void
    {
        $fields = ['warehouse_name', 'receiver_name', 'phone', 'province', 'city', 'district', 'detail_address'];
        foreach ($fields as $field) {
            if ($request->has($field)) {
                $warehouse->{$field} = (string) $request->input($field, '');
            }
        }
    }
}
