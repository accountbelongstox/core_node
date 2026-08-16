<?php

use Illuminate\Support\Facades\Route;
use App\Http\Common\CommonAvatarService;

/**
 * Public API Routes - Avatar Cache Service
 *
 * Provides cached avatar images from multiple providers
 */

// ===============================================
// NEW: Multi-Provider Avatar API
// ===============================================

// Get avatar with provider selection (default: pravatar)
Route::get('/public/avatar/{name}', function (string $name) {
    $size = request()->query('size');
    $provider = request()->query('provider');
    $sizeParam = ($size !== null && $size !== '') ? (int)$size : null;
    return CommonAvatarService::getAvatarResponse($name, $sizeParam, $provider);
})->name('api.public.avatar');

// Get list of all available providers
Route::get('/public/avatar-providers/list', function () {
    $providers = CommonAvatarService::getProvidersInfo();
    return response()->json([
        'success' => true,
        'providers' => $providers,
        'default' => 'pravatar',
    ]);
})->name('api.public.avatar.providers');

// Get cache statistics
Route::get('/public/avatar-cache/stats', function () {
    $stats = CommonAvatarService::getCacheStats();
    return response()->json($stats);
})->name('api.public.avatar.stats');

// Clear specific user cache (supports provider parameter)
Route::delete('/public/avatar-cache/{name}', function (string $name) {
    $provider = request()->query('provider');
    $success = CommonAvatarService::clearCache($name, $provider);
    return response()->json([
        'success' => $success,
        'message' => $success ? 'Cache cleared' : 'Cache not found',
    ]);
})->name('api.public.avatar.clear');

// Clear all avatar cache (admin only)
Route::delete('/public/avatar-cache', function () {
    $result = CommonAvatarService::clearAllCache();
    return response()->json($result);
})->name('api.public.avatar.clear-all');
