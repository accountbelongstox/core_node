<?php

namespace App\Helpers;

use Illuminate\Http\Request;
use App\Models\User;

/**
 * Authentication Helper
 * Centralized authentication checks
 * NO try-catch blocks - trust framework
 */
class AuthHelper
{
    public static function requireAuth(Request $request): ?User
    {
        return $request->user();
    }

    public static function requireAdmin(Request $request): ?User
    {
        $user = $request->user();

        if (!$user) {
            return null;
        }

        if (!$user->isAdmin()) {
            return null;
        }

        return $user;
    }

    public static function requireSuperAdmin(Request $request): ?User
    {
        $user = $request->user();

        if (!$user) {
            return null;
        }

        if (!$user->isSuperAdmin()) {
            return null;
        }

        return $user;
    }

    public static function getAuthErrorType(Request $request, bool $requireAdmin = false): ?string
    {
        $user = $request->user();

        if (!$user) {
            return 'unauthorized';
        }

        if ($requireAdmin && !$user->isAdmin()) {
            return 'forbidden';
        }

        return null;
    }
}
