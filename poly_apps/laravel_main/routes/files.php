<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\FileController;

/*
|--------------------------------------------------------------------------
| File Access Routes
|--------------------------------------------------------------------------
|
| Unified file access system using FileController and FileService
| All file access goes through centralized validation and security checks
|
*/

Route::get('/files/avatars/{app}/{filename}', [FileController::class, 'avatar'])
    ->where(['app' => '[a-zA-Z0-9_-]+', 'filename' => '[a-zA-Z0-9_.-]+']);

Route::get('/files/uploads/{app}/{filename}', [FileController::class, 'upload'])
    ->where(['app' => '[a-zA-Z0-9_-]+', 'filename' => '[a-zA-Z0-9_.-]+']);

Route::get('/files/static/{app}/{filename}', [FileController::class, 'static'])
    ->where(['app' => '[a-zA-Z0-9_-]+', 'filename' => '[a-zA-Z0-9_.-]+']);

