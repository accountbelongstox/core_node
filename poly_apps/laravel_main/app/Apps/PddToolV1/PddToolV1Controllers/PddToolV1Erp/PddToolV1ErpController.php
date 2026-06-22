<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\PddToolV1\PddToolV1Controllers\PddToolV1Erp;

use Illuminate\Routing\Controller as BaseController;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

/**
 * ERP / duoduokai / qianniuhua bridge.
 *
 * STUB: advanced ERP forwarding is not the priority. Every endpoint returns a
 * valid empty envelope {success:true,data:{}} (or 404 null for GET /erp/config).
 * TODO: forward to the real duoduokai / qianniuhua upstreams.
 */
class PddToolV1ErpController extends BaseController
{
    /**
     * GET /erp/config -> 404 (null) when unset. (STUB)
     */
    public function getConfig(Request $request): JsonResponse
    {
        // TODO: persist + return per-member ERP config. Null for now (GET 404 = null).
        return response()->json(['detail' => 'No ERP config'], 404);
    }

    /**
     * POST /erp/config -> echo. (STUB)
     */
    public function saveConfig(Request $request): JsonResponse
    {
        // TODO: persist per-member ERP config.
        return response()->json(['success' => true, 'data' => (object) []]);
    }

    /**
     * DELETE /erp/config. (STUB)
     */
    public function deleteConfig(Request $request): JsonResponse
    {
        // TODO: delete per-member ERP config.
        return response()->json(['success' => true, 'data' => (object) []]);
    }

    /**
     * POST /erp/test-connection. (STUB)
     */
    public function testConnection(Request $request): JsonResponse
    {
        // TODO: probe the configured ERP upstream.
        return response()->json(['success' => true, 'data' => (object) []]);
    }

    /**
     * POST /erp/minicheng/request {path, body} -> forwards /duoduokai/*. (STUB)
     */
    public function minichengRequest(Request $request): JsonResponse
    {
        // TODO: forward {path, body} to the duoduokai upstream.
        return response()->json(['success' => true, 'data' => (object) []]);
    }

    /**
     * POST /erp/qianniuhua/{action}. (STUB)
     */
    public function qianniuhua(Request $request, string $action): JsonResponse
    {
        // TODO: forward to the qianniuhua upstream (fetch-purchase-orders / update-order-status / update-logistics).
        return response()->json(['success' => true, 'data' => (object) []]);
    }
}
