<?php

use App\Http\Controllers\CloudClipboardCtl;
use App\Support\CloudClipboardContract;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

Route::withoutMiddleware([EnsureFrontendRequestsAreStateful::class])
    ->prefix(ltrim(str_replace('/api/', '', CloudClipboardContract::get('api_prefix')), '/'))
    ->group(function () {
        Route::get('data', [CloudClipboardCtl::class, 'data']);
        Route::post('generate', [CloudClipboardCtl::class, 'generate'])->middleware('throttle:30,1');
        Route::post('hub-authorization', [CloudClipboardCtl::class, 'authorizeHub'])->middleware('throttle:60,1');
        Route::get('file', [CloudClipboardCtl::class, 'file']);
        Route::post('{action}', [CloudClipboardCtl::class, 'mutate'])
            ->where('action', 'text|new|restore|delete|upload|delete-file|password');
    });
