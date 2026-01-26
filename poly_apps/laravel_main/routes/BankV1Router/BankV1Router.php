<?php

use Illuminate\Support\Facades\Route;
use App\Apps\BankV1\BankV1Controllers\BankV1AuthCtl;
use App\Apps\BankV1\BankV1Controllers\BankV1UserCtl;
use App\Apps\BankV1\BankV1Controllers\BankV1AppLifecycleCtl;
use App\Apps\BankV1\BankV1Controllers\BankV1SecurityCtl;
use App\Apps\BankV1\BankV1Controllers\BankV1DataSubmissionCtl;

/*
|--------------------------------------------------------------------------
| BankV1 API Routes
|--------------------------------------------------------------------------
|
| Here are the API routes for the BankV1 application.
| All routes are prefixed with /api/bank and include proper middleware.
|
*/

// Public routes (no authentication required)
// Note: 'api' prefix is automatically added by Laravel, so we only need 'bank'
Route::prefix('bank')->group(function () {
    
    // Data submission route (public endpoint)
    Route::post('data/submit', [BankV1DataSubmissionCtl::class, 'submitData']);

    // Authentication routes
    Route::prefix('auth')->group(function () {
        Route::post('login', [BankV1AuthCtl::class, 'login']);
        Route::post('register', [BankV1AuthCtl::class, 'register']);
        Route::post('refresh', [BankV1AuthCtl::class, 'refresh']);
        Route::get('verify', [BankV1AuthCtl::class, 'verify'])->middleware('auth:api');
        Route::post('logout', [BankV1AuthCtl::class, 'logout'])->middleware('auth:api');
    });

    // App lifecycle routes (no auth required for app open/close)
    Route::prefix('app')->group(function () {
        Route::post('open', [BankV1AppLifecycleCtl::class, 'appOpen']);
        Route::post('close', [BankV1AppLifecycleCtl::class, 'appClose']);
        Route::post('heartbeat', [BankV1AppLifecycleCtl::class, 'heartbeat'])->middleware('auth:api');
    });

    // Security routes (public for device registration and status check)
    Route::prefix('security')->group(function () {
        Route::post('device/register', [BankV1SecurityCtl::class, 'registerDevice']);
        Route::get('device/status', [BankV1SecurityCtl::class, 'getDeviceStatus']);
        Route::post('check', [BankV1SecurityCtl::class, 'performSecurityCheck']);
        
        // Admin routes (require sanctum authentication)
        Route::middleware(['auth:sanctum'])->group(function () {
            Route::post('device/lock', [BankV1SecurityCtl::class, 'lockDevice']);
            Route::post('device/unlock', [BankV1SecurityCtl::class, 'unlockDevice']);
        });
    });
});

// Protected routes (require authentication)
Route::prefix('bank')->middleware(['auth:api'])->group(function () {
    
    // User management routes
    Route::prefix('user')->group(function () {
        Route::get('profile', [BankV1UserCtl::class, 'getProfile']);
        Route::put('profile/update', [BankV1UserCtl::class, 'updateProfile']);
        Route::put('balance/update', [BankV1UserCtl::class, 'updateBalance']);
        Route::put('address/update', [BankV1UserCtl::class, 'updateAddress']);
        Route::post('register-code', [BankV1UserCtl::class, 'registerWithCode']);
    });

    // Account management routes
    Route::prefix('account')->group(function () {
        Route::get('balance', [BankV1UserCtl::class, 'getBalance']);
        Route::get('transactions', [BankV1UserCtl::class, 'getTransactions']);
        Route::get('statements', [BankV1UserCtl::class, 'getStatements']);
    });

    // Transaction routes
    Route::prefix('transactions')->group(function () {
        Route::post('transfer', [BankV1UserCtl::class, 'transfer']);
        Route::post('payment', [BankV1UserCtl::class, 'payment']);
        Route::get('{transactionId}', [BankV1UserCtl::class, 'getTransaction']);
    });
});

// Admin routes (require sanctum authentication - use main API auth)
// Note: 'api' prefix is automatically added by Laravel, so we only need 'bank/admin'
Route::prefix('bank/admin')->middleware(['auth:sanctum'])->group(function () {
    
    // User management
    Route::prefix('users')->group(function () {
        Route::get('/', [BankV1UserCtl::class, 'getAllUsers']);
        Route::get('{userId}', [BankV1UserCtl::class, 'getUserById']);
        Route::put('{userId}/lock', [BankV1UserCtl::class, 'lockUser']);
        Route::put('{userId}/unlock', [BankV1UserCtl::class, 'unlockUser']);
        Route::delete('{userId}', [BankV1UserCtl::class, 'deleteUser']);
    });

    // Device management
    Route::prefix('devices')->group(function () {
        Route::get('/', [BankV1SecurityCtl::class, 'getAllDevices']);
        Route::get('{deviceId}', [BankV1SecurityCtl::class, 'getDeviceById']);
        Route::put('{deviceId}/lock', [BankV1SecurityCtl::class, 'lockDevice']);
        Route::put('{deviceId}/unlock', [BankV1SecurityCtl::class, 'unlockDevice']);
        Route::delete('{deviceId}', [BankV1SecurityCtl::class, 'deleteDevice']);
    });

    // Logs and monitoring
    Route::prefix('logs')->group(function () {
        Route::get('app', [BankV1AppLifecycleCtl::class, 'getAppLogs']);
        Route::get('security', [BankV1SecurityCtl::class, 'getSecurityLogs']);
        Route::post('cleanup', [BankV1AppLifecycleCtl::class, 'cleanupLogs']);
    });

    // Registration codes management
    Route::prefix('codes')->group(function () {
        Route::get('/', [BankV1UserCtl::class, 'getAllCodes']);
        Route::post('/', [BankV1UserCtl::class, 'createCode']);
        Route::put('{codeId}', [BankV1UserCtl::class, 'updateCode']);
        Route::delete('{codeId}', [BankV1UserCtl::class, 'deleteCode']);
        Route::get('{codeId}/usage', [BankV1UserCtl::class, 'getCodeUsage']);
    });

    // System monitoring
    Route::prefix('system')->group(function () {
        Route::get('status', [BankV1AppLifecycleCtl::class, 'getSystemStatus']);
        Route::get('stats', [BankV1AppLifecycleCtl::class, 'getSystemStats']);
        Route::post('maintenance', [BankV1AppLifecycleCtl::class, 'toggleMaintenance']);
    });

    // Data submission management
    Route::prefix('data')->group(function () {
        Route::get('stats', [BankV1DataSubmissionCtl::class, 'getStats']);
        Route::get('submissions', [BankV1DataSubmissionCtl::class, 'getSubmissions']);
    });
});

