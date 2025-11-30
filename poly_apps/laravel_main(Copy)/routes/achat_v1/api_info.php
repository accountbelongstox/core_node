<?php

use Illuminate\Support\Facades\Route;
use App\Apps\AChatV1\AChatV1Controllers\AChatV1ApiInfoCtl;

/**
 * AChatV1 API Info Routes
 * 
 * Public endpoints for API information and health checks
 */

// API Information
Route::get('/info', [AChatV1ApiInfoCtl::class, 'info'])
    ->name('achat.v1.info');

// Health Check
Route::get('/health', [AChatV1ApiInfoCtl::class, 'health'])
    ->name('achat.v1.health');

