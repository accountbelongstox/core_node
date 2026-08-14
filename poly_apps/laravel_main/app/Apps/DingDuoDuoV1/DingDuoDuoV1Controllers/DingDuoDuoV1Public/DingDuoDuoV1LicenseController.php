<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\DingDuoDuoV1\DingDuoDuoV1Controllers\DingDuoDuoV1Public;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller as BaseController;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Services\DingDuoDuoV1LicenseService;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Services\DingDuoDuoV1MemberService;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Models\DingDuoDuoV1MemberModel;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Enums\DingDuoDuoV1LicenseMode;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Constants\DingDuoDuoV1Constants;

/**
 * Public license endpoints the 订多多 extension polls when the user has no
 * super-code: verify resolves the entitlement; heartbeat additionally bumps the
 * device's last-seen timestamp.
 */
class DingDuoDuoV1LicenseController extends BaseController
{
    /**
     * POST license/verify {device_id, token} -> resolved license payload.
     */
    public function verify(Request $request): JsonResponse
    {
        $deviceId = (string) $request->input('device_id', '');
        $token = $this->resolveToken($request);

        $license = DingDuoDuoV1LicenseService::resolveByToken($token, $deviceId);

        if ($deviceId !== '') {
            $this->touchDevice($deviceId, $license);
        }

        return response()->json([
            'success' => true,
            'data' => $license,
        ]);
    }

    /**
     * POST license/heartbeat {device_id, token} -> updates device last-seen and
     * returns the (re-resolved) license.
     */
    public function heartbeat(Request $request): JsonResponse
    {
        $deviceId = (string) $request->input('device_id', '');
        $token = $this->resolveToken($request);

        $license = DingDuoDuoV1LicenseService::resolveByToken($token, $deviceId);

        if ($deviceId !== '') {
            $this->touchDevice($deviceId, $license);
        }

        return response()->json([
            'success' => true,
            'data' => $license,
        ]);
    }

    /**
     * Token from the body, falling back to the X-DD-Token header.
     */
    private function resolveToken(Request $request): string
    {
        $token = (string) $request->input('token', '');
        if ($token === '') {
            $token = (string) $request->header(DingDuoDuoV1Constants::MEMBER_TOKEN_HEADER, '');
        }
        return trim($token);
    }

    /**
     * Bump the device heartbeat, attaching the member id when the license is a
     * member entitlement (super / locked modes leave member_id untouched).
     */
    private function touchDevice(string $deviceId, array $license): void
    {
        $memberId = null;
        if (($license['mode'] ?? null) === DingDuoDuoV1LicenseMode::Member->value) {
            $member = DingDuoDuoV1MemberModel::byToken((string) ($license['token'] ?? ''));
            $memberId = $member ? (int) $member->id : null;
        }

        DingDuoDuoV1MemberService::upsertDevice($deviceId, $memberId);
    }
}
