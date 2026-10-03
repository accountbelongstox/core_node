<?php

use App\Http\Controllers\CloudClipboardCtl;
use App\Http\Middleware\CloudClipboardReady;
use App\Support\CloudClipboardContract;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

Route::withoutMiddleware([EnsureFrontendRequestsAreStateful::class])
    ->middleware(CloudClipboardReady::class)
    ->prefix(ltrim(str_replace('/api/', '', CloudClipboardContract::get('api_prefix')), '/'))
    ->group(function () {
        Route::get('data', [CloudClipboardCtl::class, 'data']);
        Route::post('generate', [CloudClipboardCtl::class, 'generate'])->middleware('throttle:30,1');
        Route::post('hub-authorization', [CloudClipboardCtl::class, 'authorizeHub'])->middleware('throttle:60,1');
        Route::get(CloudClipboardContract::get('file_path'), [CloudClipboardCtl::class, 'file']);
        Route::get(CloudClipboardContract::get('file_path').'/{entry_id}/{file_id}.{ext}', [CloudClipboardCtl::class, 'file'])
            ->whereUuid(['entry_id', 'file_id'])->where('ext', '[A-Za-z0-9]{1,16}');
        Route::get(CloudClipboardContract::get('file_path').'/{namespace}/{entry_id}/{file_id}.{ext}', [CloudClipboardCtl::class, 'file'])
            ->where('namespace', trim(CloudClipboardContract::get('namespace_pattern'), '^$'))
            ->whereUuid(['entry_id', 'file_id'])->where('ext', '[A-Za-z0-9]{1,16}');
        Route::post('{action}', [CloudClipboardCtl::class, 'mutate'])
            ->where('action', 'text|new|restore|delete|upload|delete-file|password');
    });
