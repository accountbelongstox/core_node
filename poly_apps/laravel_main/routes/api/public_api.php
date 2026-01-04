<?php

use Illuminate\Support\Facades\Route;
use App\Http\Common\CommonPravatarCache;

/**
 * Public API Routes - Avatar Cache Service
 *
 * Provides cached avatar images from pravatar.cc
 */

// Get avatar by name (cached)
Route::get('/public/avatar/{name}', function (string $name) {
    $size = request()->query('size', 150);
    return CommonPravatarCache::getAvatarResponse($name, (int)$size);
})->name('api.public.avatar');

// Get cache statistics
Route::get('/public/avatar-cache/stats', function () {
    $stats = CommonPravatarCache::getCacheStats();
    return response()->json($stats);
})->name('api.public.avatar.stats');

// Clear specific user cache
Route::delete('/public/avatar-cache/{name}', function (string $name) {
    $success = CommonPravatarCache::clearCache($name);
    return response()->json([
        'success' => $success,
        'message' => $success ? 'Cache cleared' : 'Cache not found',
    ]);
})->name('api.public.avatar.clear');

// Clear all avatar cache (admin only)
Route::delete('/public/avatar-cache', function () {
    $result = CommonPravatarCache::clearAllCache();
    return response()->json($result);
})->name('api.public.avatar.clear-all');
