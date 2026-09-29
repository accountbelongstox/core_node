<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Dashboard\CodeUpdateController;

// Open read-only probe for laravel-manager header (no secrets).
Route::get('dashboard/code-last-modified', [CodeUpdateController::class, 'lastModified']);
