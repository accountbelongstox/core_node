<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

/**
 * Authenticate Middleware
 * Handles authentication for API routes
 * Returns JSON response instead of redirecting for API requests
 */
class Authenticate extends Middleware
{
    /**
     * Get the path the user should be redirected to when they are not authenticated.
     * For API requests, return null to prevent redirect and return JSON instead.
     */
    protected function redirectTo(Request $request): ?string
    {
        // For API requests, return null to prevent redirect
        if ($request->expectsJson() || $request->is('api/*')) {
            return null;
        }

        // For web requests, return login route (if it exists)
        // Since we don't have a web login route, return null
        return null;
    }

    /**
     * Handle an unauthenticated user.
     * Override to return JSON response for API requests.
     */
    protected function unauthenticated($request, array $guards)
    {
        // For API requests, return JSON response
        if ($request->expectsJson() || $request->is('api/*')) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated. Please login first.',
                'code' => 'AUTH_REQUIRED',
                'error' => 'Unauthenticated'
            ], 401);
        }

        // For web requests, call parent method (which will try to redirect)
        // But since redirectTo returns null, it will also return JSON
        return parent::unauthenticated($request, $guards);
    }
}

