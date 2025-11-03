<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

use App\Apps\AppQyV1\Controllers\AppQyV1UserAuth\AppQyV1AuthenticationLoginController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| AppQyV1 Authentication Routes
|--------------------------------------------------------------------------
|
| Routes for app_qy authentication system matching frontend expectations
| Base path: /api/auth/
|
*/

Route::prefix('auth')->group(function () {

    // Phone SMS Authentication
    Route::post('/phone/send-code', [AppQyV1AuthenticationLoginController::class, 'sendSmsCode']);
    Route::post('/phone/verify', [AppQyV1AuthenticationLoginController::class, 'verifySmsCode']);

    // WeChat OAuth Authentication
    Route::post('/wechat', [AppQyV1AuthenticationLoginController::class, 'wechatLogin']);
    Route::get('/wechat/auth-url', [AppQyV1AuthenticationLoginController::class, 'getWechatAuthUrl']);

    // Token Management
    Route::post('/refresh', [AppQyV1AuthenticationLoginController::class, 'refreshToken']);
    Route::post('/logout', [AppQyV1AuthenticationLoginController::class, 'logout']);

    // User management
    Route::get('/user', [AppQyV1AuthenticationLoginController::class, 'getCurrentUser']);
    Route::post('/forgot-password', [AppQyV1AuthenticationLoginController::class, 'forgotPassword']);
    Route::post('/reset-password', [AppQyV1AuthenticationLoginController::class, 'resetPassword']);
    Route::get('/verify-email/{id}/{hash}', [AppQyV1AuthenticationLoginController::class, 'verifyEmail']);
    Route::post('/email/verification-notification', [AppQyV1AuthenticationLoginController::class, 'resendEmailVerification']);

});