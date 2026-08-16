<?php

use App\Http\Controllers\Api\AiLocalController;
use Illuminate\Support\Facades\Route;

/**
 * Local AI gateway routes — the PHP twin of pycore's /api/local/ai/* surface.
 *
 * Public (no auth): the dashboard's AI Management page calls these from the
 * browser, and provider keys are never returned (only first4…last4 masks). Rate
 * counters are shared with pycore, so the same free-tier budget is enforced
 * regardless of which runtime served the request.
 *
 * A `throttle` bound is applied so an unauthenticated caller cannot flood the
 * gateway: the per-provider free-tier limiter already caps real token spend, and
 * this caps request rate on top (the UI only polls a couple GETs every 5s).
 */
Route::prefix('local/ai')->middleware('throttle:120,1')->group(function () {
    Route::get('catalog', [AiLocalController::class, 'catalog']);
    Route::get('probe', [AiLocalController::class, 'probe']);
    Route::post('chat', [AiLocalController::class, 'chat']);
    Route::get('gateway', [AiLocalController::class, 'gateway']);
    Route::get('rate-limits', [AiLocalController::class, 'rateLimits']);
    Route::get('usage', [AiLocalController::class, 'usage']);
    // AI key management — set/list/delete provider keys (shared with pycore).
    // Keys are never returned raw: list yields first4…last4 masks only.
    Route::get('keys', [AiLocalController::class, 'keysList']);
    Route::post('keys', [AiLocalController::class, 'keySet']);
    Route::post('keys/delete', [AiLocalController::class, 'keyDelete']);
    Route::post('image', [AiLocalController::class, 'image']);
    Route::get('image/history', [AiLocalController::class, 'imageHistory']);
    Route::get('image/history/file/{id}', [AiLocalController::class, 'imageHistoryFile']);
    Route::delete('image/history/{id}', [AiLocalController::class, 'imageHistoryDelete']);
    Route::post('image/history/clear', [AiLocalController::class, 'imageHistoryClear']);
    // Official Laravel AI SDK surface — capability matrix, persistent chat
    // conversations (text + image attachments, SDK failover) and the
    // gateway-local prompt cache.
    Route::get('capabilities', [AiLocalController::class, 'capabilities']);
    Route::get('chat/conversations', [AiLocalController::class, 'chatConversations']);
    Route::get('chat/conversations/{id}', [AiLocalController::class, 'chatMessages']);
    Route::delete('chat/conversations/{id}', [AiLocalController::class, 'chatConversationDelete']);
    Route::post('chat/send', [AiLocalController::class, 'chatSend']);
    Route::get('chat/attachments/{name}', [AiLocalController::class, 'chatAttachment']);
    Route::get('prompt-cache', [AiLocalController::class, 'promptCache']);
    Route::post('prompt-cache/clear', [AiLocalController::class, 'promptCacheClear']);
    Route::get('info', [AiLocalController::class, 'info']);
});
