<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\InviteCode;
use App\Models\User;
use Illuminate\Support\Str;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;

/**
 * Invite Code Controller
 * Uses standardized ApiResponse trait
 * NO try-catch blocks - trust Laravel validation and database operations
 */
class InviteCodeController extends Controller
{
    use ApiResponse;

    /**
     * Get all invite codes (admin only)
     */
    public function index(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAdmin($request);

        if (!$user) {
            $errorType = AuthHelper::getAuthErrorType($request, true);
            if ($errorType === 'unauthorized') {
                return $this->unauthorized();
            }
            return $this->forbidden();
        }

        $codes = InviteCode::with(['creator', 'usages.user'])
            ->orderBy('created_at', 'desc')
            ->get();

        return $this->success($codes, 'Invite codes retrieved successfully');
    }

    /**
     * Get public invite codes (no authentication required)
     * Returns masked codes for registration page display
     */
    public function listPublic(Request $request): JsonResponse
    {
        $codes = InviteCode::where('is_active', true)
            ->where(function($query) {
                $query->whereNull('expires_at')
                      ->orWhere('expires_at', '>', now());
            })
            ->whereColumn('used_count', '<', 'max_uses')
            ->select(['id', 'code', 'type', 'max_uses', 'used_count', 'expires_at', 'is_active', 'created_at'])
            ->orderBy('created_at', 'desc')
            ->limit(10) // Limit to 10 most recent active codes
            ->get();

        return $this->success($codes, 'Public invite codes retrieved successfully');
    }

    /**
     * Create new invite code (admin only)
     */
    public function create(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAdmin($request);

        if (!$user) {
            $errorType = AuthHelper::getAuthErrorType($request, true);
            if ($errorType === 'unauthorized') {
                return $this->unauthorized();
            }
            return $this->forbidden();
        }

        $validated = $request->validate([
            'type' => 'required|in:admin,super_admin,moderator,user',
            'max_uses' => 'required|integer|min:1',
            'expires_at' => 'nullable|date',
            'description' => 'nullable|string|max:500',
        ]);

        $expiresAt = isset($validated['expires_at']) ? $validated['expires_at'] : null;
        $description = isset($validated['description']) ? $validated['description'] : null;

        $code = InviteCode::create([
            'code' => strtoupper($validated['type'] . '_' . Str::random(20)),
            'type' => $validated['type'],
            'max_uses' => $validated['max_uses'],
            'used_count' => 0,
            'expires_at' => $expiresAt,
            'is_active' => true,
            'created_by' => $user->id,
            'description' => $description,
        ]);

        \Log::info('[InviteCode] Code created', [
            'code' => $code->code,
            'type' => $code->type,
            'created_by' => $user->username
        ]);

        return $this->success($code, 'Invite code created successfully');
    }

    /**
     * Deactivate invite code (admin only)
     */
    public function deactivate(Request $request, int $id): JsonResponse
    {
        $user = AuthHelper::requireAdmin($request);

        if (!$user) {
            $errorType = AuthHelper::getAuthErrorType($request, true);
            if ($errorType === 'unauthorized') {
                return $this->unauthorized();
            }
            return $this->forbidden();
        }

        $code = InviteCode::findOrFail($id);
        $code->update(['is_active' => false]);

        \Log::info('[InviteCode] Code deactivated', [
            'code' => $code->code,
            'deactivated_by' => $user->username
        ]);

        return $this->success($code, 'Invite code deactivated successfully');
    }

    /**
     * Validate invite code (public endpoint for registration)
     */
    public function validate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string',
        ]);

        $code = InviteCode::where('code', $validated['code'])->first();

        if (!$code) {
            return $this->error('Invalid invite code', 400);
        }

        $canBeUsed = $code->canBeUsed();

        $data = null;
        if ($canBeUsed) {
            $data = [
                'type' => $code->type,
                'role_level' => $code->getRoleLevel(),
                'role_name' => $code->getRoleName(),
            ];
        }

        $message = $canBeUsed ? 'Valid invite code' : 'Invite code is expired or already used';

        return $this->success([
            'valid' => $canBeUsed,
            'data' => $data,
        ], $message);
    }
}
