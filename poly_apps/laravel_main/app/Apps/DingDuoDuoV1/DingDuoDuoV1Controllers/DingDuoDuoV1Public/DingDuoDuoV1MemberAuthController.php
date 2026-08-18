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
use App\Http\Controllers\Controller;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Services\DingDuoDuoV1MemberService;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Services\DingDuoDuoV1LicenseService;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Requests\DingDuoDuoV1MemberLoginRequest;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Constants\DingDuoDuoV1Constants;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Constants\DingDuoDuoV1ErrorCodes;

/**
 * Public member auth for the 订多多 extension's no-super-code path: credential
 * login against the global users table (returns a Sanctum token + member) and a
 * token-scoped "me" lookup. The extension presents the Sanctum token on the
 * X-DD-Token header (or ?token=); validation goes through Sanctum.
 */
class DingDuoDuoV1MemberAuthController extends Controller
{
    /**
     * POST member/login {username, password, device_id?} -> {token, member}.
     */
    public function login(DingDuoDuoV1MemberLoginRequest $request): JsonResponse
    {
        $data = $request->validated();

        $result = DingDuoDuoV1MemberService::login(
            $data['username'],
            $data['password'],
            $data['device_id'] ?? null
        );

        if ($result === null) {
            return response()->json([
                'success' => false,
                'message' => DingDuoDuoV1ErrorCodes::getMessage(DingDuoDuoV1ErrorCodes::INVALID_CREDENTIALS),
                'code' => DingDuoDuoV1ErrorCodes::INVALID_CREDENTIALS,
            ], 401);
        }

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    /**
     * GET member/me -> the member resolved from the Sanctum token presented on
     * the X-DD-Token header (or ?token=), plus the current license payload.
     */
    public function me(Request $request): JsonResponse
    {
        $token = (string) $request->header(DingDuoDuoV1Constants::MEMBER_TOKEN_HEADER, '');
        if ($token === '') {
            $token = (string) $request->input('token', '');
        }
        $token = trim($token);

        $member = $token === ''
            ? null
            : DingDuoDuoV1MemberService::activeMemberForToken($token);

        if (!$member) {
            return response()->json([
                'success' => false,
                'message' => DingDuoDuoV1ErrorCodes::getMessage(DingDuoDuoV1ErrorCodes::INVALID_TOKEN),
                'code' => DingDuoDuoV1ErrorCodes::INVALID_TOKEN,
            ], 401);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'member' => $member->toArray(),
                'license' => DingDuoDuoV1LicenseService::resolveByToken($token),
            ],
        ]);
    }
}
