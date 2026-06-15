<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Services\Dashboard\DebugAuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Exposes whether the current request gets the local-debug login bypass, so the
 * dashboard frontend can decide to skip its login gate. Intentionally unguarded
 * (it reveals no secrets -- only whether login is required from this client).
 */
class DebugAuthController extends Controller
{
    public function status(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => DebugAuthService::status($request),
        ]);
    }
}
