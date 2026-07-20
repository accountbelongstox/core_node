<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

use Illuminate\Support\Facades\Route;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Social\AppQyV1SocialController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Social\AppQyV1ChatController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Social\AppQyV1PresenceController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Social\AppQyV1NotificationController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Social\AppQyV1SocialStreamController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Social\AppQyV1PostController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Social\AppQyV1PostMediaController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Social\AppQyV1LiveController;

$version = getAppVersionFromFilename(__FILE__);
$apiVersionPrefix = 'app_qy_v1';

Route::prefix($apiVersionPrefix)->middleware(['custom.authenticate'])->group(function () {

    Route::prefix('social')->group(function () {
        // ---- Discover / friends ----
        Route::get('/discover', [AppQyV1SocialController::class, 'discover']);
        Route::get('/friends', [AppQyV1SocialController::class, 'getFriends']);
        Route::get('/friends/search', [AppQyV1SocialController::class, 'searchUsers']);
        Route::post('/friends/follow', [AppQyV1SocialController::class, 'follow']);
        Route::post('/friends/unfollow', [AppQyV1SocialController::class, 'unfollow']);
        Route::post('/friends/request', [AppQyV1SocialController::class, 'sendFriendRequest']);
        Route::post('/friends/respond', [AppQyV1SocialController::class, 'respondFriendRequest']);
        Route::get('/friends/requests', [AppQyV1SocialController::class, 'friendRequests']);
        Route::post('/friends/block', [AppQyV1SocialController::class, 'blockUser']);
        Route::get('/leaderboard', [AppQyV1SocialController::class, 'getLeaderboard']);
        Route::get('/activities', [AppQyV1SocialController::class, 'getActivities']);

        // ---- Public user profile (powers #/social/user/<id>) ----
        Route::get('/users/{id}', [AppQyV1SocialController::class, 'getUserProfile'])->whereNumber('id');

        // ---- Chat (every endpoint verifies the caller is a participant) ----
        Route::get('/conversations', [AppQyV1ChatController::class, 'index']);
        Route::post('/conversations', [AppQyV1ChatController::class, 'open']);
        Route::get('/conversations/{id}/messages', [AppQyV1ChatController::class, 'messages'])->whereNumber('id');
        Route::post('/conversations/{id}/messages', [AppQyV1ChatController::class, 'send'])->whereNumber('id');
        Route::post('/conversations/{id}/read', [AppQyV1ChatController::class, 'read'])->whereNumber('id');

        // ---- Presence ----
        Route::post('/presence/heartbeat', [AppQyV1PresenceController::class, 'heartbeat']);
        Route::get('/presence', [AppQyV1PresenceController::class, 'batch']);

        // ---- Notifications ----
        Route::get('/notifications', [AppQyV1NotificationController::class, 'index']);
        Route::get('/notifications/unread-count', [AppQyV1NotificationController::class, 'unreadCount']);
        Route::post('/notifications/read', [AppQyV1NotificationController::class, 'markRead']);

        // ---- Posts / feed (Social Center expansion §POSTS) ----
        Route::get('/posts', [AppQyV1PostController::class, 'timeline']);
        Route::post('/posts', [AppQyV1PostController::class, 'create']);
        Route::get('/posts/{id}', [AppQyV1PostController::class, 'show'])->whereNumber('id');
        Route::delete('/posts/{id}', [AppQyV1PostController::class, 'destroy'])->whereNumber('id');
        Route::post('/posts/{id}/like', [AppQyV1PostController::class, 'like'])->whereNumber('id');
        Route::post('/posts/{id}/unlike', [AppQyV1PostController::class, 'unlike'])->whereNumber('id');
        Route::get('/posts/{id}/comments', [AppQyV1PostController::class, 'comments'])->whereNumber('id');
        Route::post('/posts/{id}/comments', [AppQyV1PostController::class, 'createComment'])->whereNumber('id');
        Route::delete('/posts/{id}/comments/{cid}', [AppQyV1PostController::class, 'deleteComment'])->whereNumber('id')->whereNumber('cid');
        Route::post('/posts/{id}/images', [AppQyV1PostMediaController::class, 'uploadImages'])->whereNumber('id');
        Route::post('/posts/{id}/video', [AppQyV1PostMediaController::class, 'uploadVideo'])->whereNumber('id');

        // ---- Live (external embed + SSE chat; Social Center expansion §LIVE) ----
        Route::get('/live', [AppQyV1LiveController::class, 'list']);
        Route::post('/live', [AppQyV1LiveController::class, 'start']);
        Route::post('/live/{id}/end', [AppQyV1LiveController::class, 'end'])->whereNumber('id');
        Route::post('/live/{id}/heartbeat', [AppQyV1LiveController::class, 'heartbeat'])->whereNumber('id');
        Route::get('/live/{id}/chat', [AppQyV1LiveController::class, 'chat'])->whereNumber('id');
        Route::post('/live/{id}/chat', [AppQyV1LiveController::class, 'sendChat'])->whereNumber('id');

        // ---- Per-user real-time SSE (scoped to the authenticated user) ----
        // EventSource cannot send an Authorization header, so this route reads the
        // Sanctum token from the ?token= query param inside the controller
        // (resolveUserFromQueryToken). It must bypass the bearer-only
        // custom.authenticate middleware, otherwise every logged-in client 401s.
        Route::get('/stream', [AppQyV1SocialStreamController::class, 'stream'])->withoutMiddleware('custom.authenticate');
    });
});
