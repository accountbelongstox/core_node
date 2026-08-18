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
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use App\Models\User;
use App\Services\UnifiedAuthService;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Services\DingDuoDuoV1MemberService;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Models\DingDuoDuoV1MemberModel;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Constants\DingDuoDuoV1Constants;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Constants\DingDuoDuoV1ErrorCodes;

/**
 * Admin member management (CRUD) + expiry / permissions / tier control. Guarded by
 * 'custom.authenticate' at the route layer.
 */
class DingDuoDuoV1MemberAdminController extends Controller
{
    /**
     * GET admin/members -> paginated member list (optional ?q= username filter).
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = max(1, min(100, (int) $request->input('per_page', 20)));
        $q = trim((string) $request->input('q', ''));
        $tier = trim((string) $request->input('tier', ''));

        return response()->json([
            'success' => true,
            'data' => DingDuoDuoV1MemberModel::adminPage($q, $tier, $perPage),
        ]);
    }

    /**
     * GET admin/members/{id} -> a single member.
     */
    public function show(int $id): JsonResponse
    {
        $member = DingDuoDuoV1MemberModel::findById($id);
        if (!$member) {
            return $this->notFound();
        }

        return response()->json([
            'success' => true,
            'data' => $member->toArray(),
        ]);
    }

    /**
     * POST admin/members -> create a member. Credentials are stored on the
     * canonical global users table (created via UnifiedAuthService, or reused +
     * password-reset when the username already exists); the member row keeps
     * only app-specific extension fields linked by user_id.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'username' => ['required', 'string', 'max:191'],
            'password' => ['required', 'string', 'min:4', 'max:255'],
            'tier' => ['nullable', 'string', 'max:32'],
            'max_binds' => ['nullable', 'integer', 'min:0'],
            'balance' => ['nullable', 'numeric'],
            'permissions' => ['nullable', 'array'],
            'expires_at' => ['nullable', 'date'],
            'status' => ['nullable', 'string', 'max:32'],
            'remark' => ['nullable', 'string', 'max:255'],
        ]);

        if (DingDuoDuoV1MemberModel::usernameExists($data['username'])) {
            return response()->json([
                'success' => false,
                'message' => DingDuoDuoV1ErrorCodes::getMessage(DingDuoDuoV1ErrorCodes::DUPLICATE_ENTRY),
                'code' => DingDuoDuoV1ErrorCodes::DUPLICATE_ENTRY,
            ], 400);
        }

        $user = User::findByUsernameOrEmail($data['username']);
        if ($user) {
            UnifiedAuthService::resetPassword($user->username, $data['password']);
        } else {
            $registered = UnifiedAuthService::register([
                'username' => $data['username'],
                'email' => null,
                'password' => $data['password'],
            ]);

            if (!$registered['success']) {
                return response()->json([
                    'success' => false,
                    'message' => DingDuoDuoV1ErrorCodes::getMessage(DingDuoDuoV1ErrorCodes::INTERNAL_ERROR),
                    'code' => DingDuoDuoV1ErrorCodes::INTERNAL_ERROR,
                ], 500);
            }

            $user = $registered['user'];
        }

        $member = new DingDuoDuoV1MemberModel();
        $member->user_id = (int) $user->id;
        $member->username = $data['username'];
        // Legacy NOT NULL column retained for pre-linkage rows; auth never reads
        // it for linked members, so store an unusable random placeholder.
        $member->password = Hash::make(Str::random(64));
        $member->tier = $data['tier'] ?? DingDuoDuoV1Constants::DEFAULT_TIER;
        $member->max_binds = (int) ($data['max_binds'] ?? DingDuoDuoV1Constants::DEFAULT_MAX_BINDS);
        $member->balance = (float) ($data['balance'] ?? 0);
        $member->permissions = array_values($data['permissions'] ?? []);
        $member->expires_at = $data['expires_at'] ?? null;
        $member->status = $data['status'] ?? 'active';
        $member->remark = $data['remark'] ?? null;
        $member->saveRecord();

        return response()->json([
            'success' => true,
            'data' => $member->toArray(),
        ]);
    }

    /**
     * PUT admin/members/{id} -> update mutable fields. A given password is
     * applied to the linked global user (users table is authoritative); only
     * unlinked legacy rows still get the member-row hash updated so the
     * login-time migration path can carry it over.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $member = DingDuoDuoV1MemberModel::findById($id);
        if (!$member) {
            return $this->notFound();
        }

        $data = $request->validate([
            'password' => ['nullable', 'string', 'min:4', 'max:255'],
            'tier' => ['nullable', 'string', 'max:32'],
            'max_binds' => ['nullable', 'integer', 'min:0'],
            'balance' => ['nullable', 'numeric'],
            'permissions' => ['nullable', 'array'],
            'expires_at' => ['nullable', 'date'],
            'status' => ['nullable', 'string', 'max:32'],
            'remark' => ['nullable', 'string', 'max:255'],
        ]);

        if (array_key_exists('password', $data) && $data['password'] !== null && $data['password'] !== '') {
            $user = null;
            if ($member->user_id !== null) {
                $user = User::findById((int) $member->user_id);
            }
            if (!$user) {
                $user = User::findByUsernameOrEmail($member->username);
            }

            if ($user) {
                UnifiedAuthService::resetPassword($user->username, $data['password']);
                if ($member->user_id === null) {
                    $member->user_id = (int) $user->id;
                }
            } else {
                $member->password = Hash::make($data['password']);
            }
        }
        if (array_key_exists('tier', $data) && $data['tier'] !== null) {
            $member->tier = $data['tier'];
        }
        if (array_key_exists('max_binds', $data) && $data['max_binds'] !== null) {
            $member->max_binds = (int) $data['max_binds'];
        }
        if (array_key_exists('balance', $data) && $data['balance'] !== null) {
            $member->balance = (float) $data['balance'];
        }
        if (array_key_exists('permissions', $data) && $data['permissions'] !== null) {
            $member->permissions = array_values($data['permissions']);
        }
        if (array_key_exists('expires_at', $data)) {
            $member->expires_at = $data['expires_at'];
        }
        if (array_key_exists('status', $data) && $data['status'] !== null) {
            $member->status = $data['status'];
        }
        if (array_key_exists('remark', $data)) {
            $member->remark = $data['remark'];
        }
        $member->saveRecord();

        return response()->json([
            'success' => true,
            'data' => $member->toArray(),
        ]);
    }

    /**
     * DELETE admin/members/{id} -> remove a member.
     */
    public function destroy(int $id): JsonResponse
    {
        $member = DingDuoDuoV1MemberModel::findById($id);
        if (!$member) {
            return $this->notFound();
        }

        $member->deleteRecord();

        return response()->json([
            'success' => true,
            'message' => 'Member deleted',
        ]);
    }

    /**
     * POST admin/members/{id}/expiry {expires_at} -> set / clear the expiry.
     */
    public function setExpiry(Request $request, int $id): JsonResponse
    {
        $member = DingDuoDuoV1MemberModel::findById($id);
        if (!$member) {
            return $this->notFound();
        }

        $data = $request->validate([
            'expires_at' => ['nullable', 'date'],
        ]);

        DingDuoDuoV1MemberService::setExpiry($member, $data['expires_at'] ?? null);

        return response()->json([
            'success' => true,
            'data' => $member->freshRecord()->toArray(),
        ]);
    }

    /**
     * POST admin/members/{id}/permissions {permissions:[...]} -> replace the list.
     */
    public function setPermissions(Request $request, int $id): JsonResponse
    {
        $member = DingDuoDuoV1MemberModel::findById($id);
        if (!$member) {
            return $this->notFound();
        }

        $data = $request->validate([
            'permissions' => ['present', 'array'],
            'permissions.*' => ['string', 'max:64'],
        ]);

        DingDuoDuoV1MemberService::setPermissions($member, $data['permissions']);

        return response()->json([
            'success' => true,
            'data' => $member->freshRecord()->toArray(),
        ]);
    }

    /**
     * POST admin/members/{id}/tier {tier, max_binds?} -> set tier (and quota).
     */
    public function setTier(Request $request, int $id): JsonResponse
    {
        $member = DingDuoDuoV1MemberModel::findById($id);
        if (!$member) {
            return $this->notFound();
        }

        $data = $request->validate([
            'tier' => ['required', 'string', 'max:32'],
            'max_binds' => ['nullable', 'integer', 'min:0'],
        ]);

        DingDuoDuoV1MemberService::setTier(
            $member,
            $data['tier'],
            array_key_exists('max_binds', $data) ? (int) $data['max_binds'] : null
        );

        return response()->json([
            'success' => true,
            'data' => $member->freshRecord()->toArray(),
        ]);
    }

    private function notFound(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => DingDuoDuoV1ErrorCodes::getMessage(DingDuoDuoV1ErrorCodes::MEMBER_NOT_FOUND),
            'code' => DingDuoDuoV1ErrorCodes::MEMBER_NOT_FOUND,
        ], 404);
    }
}
