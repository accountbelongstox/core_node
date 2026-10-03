<?php

namespace App\Http\System;

use App\Http\Controllers\Controller;
use App\Support\MeshHeadscale;
use App\Support\ServiceContract;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Mesh VPN login guide (contract access.mesh.headscale): server facts, a fresh
 * single-use pre-auth key and approval of a pending interactive login. Served
 * only by the Laravel that runs next to the Headscale control server.
 */
class MeshController extends Controller
{
    use ApiResponse;

    private const HTTP_SERVICE_UNAVAILABLE = 503;
    private const HTTP_SERVER_ERROR = 500;

    public function guide(): JsonResponse
    {
        if (!MeshHeadscale::available()) {
            return $this->error(__('mesh.errors.unavailable'), self::HTTP_SERVICE_UNAVAILABLE);
        }

        return $this->success(MeshHeadscale::guide(), __('mesh.messages.guide_retrieved'));
    }

    public function preauthKey(): JsonResponse
    {
        $created = null;

        if (!MeshHeadscale::available()) {
            return $this->error(__('mesh.errors.unavailable'), self::HTTP_SERVICE_UNAVAILABLE);
        }
        $created = MeshHeadscale::createPreauthKey();
        if ($created === null) {
            return $this->error(__('mesh.errors.preauth_failed'), self::HTTP_SERVER_ERROR);
        }

        return $this->success($created, __('mesh.messages.preauth_created'));
    }

    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'auth_id' => ['required', 'string', 'regex:/'.ServiceContract::string('access.mesh.headscale.auth_id_pattern').'/'],
        ]);

        if (!MeshHeadscale::available()) {
            return $this->error(__('mesh.errors.unavailable'), self::HTTP_SERVICE_UNAVAILABLE);
        }
        if (!MeshHeadscale::register($validated['auth_id'])) {
            return $this->error(__('mesh.errors.register_failed'), self::HTTP_SERVER_ERROR);
        }

        return $this->success(null, __('mesh.messages.registered'));
    }
}
