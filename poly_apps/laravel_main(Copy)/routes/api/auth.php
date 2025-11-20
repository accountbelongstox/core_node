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

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\EmailVerificationNotificationController;
use App\Http\Controllers\Auth\NewPasswordController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\Auth\VerifyEmailController;
$apiVersionPrefix = '';
Route::prefix($apiVersionPrefix)->group(function () {
    Route::post('/register', [RegisteredUserController::class, 'apiStore'])->name('common.register');
    Route::post('/forgot-password', [PasswordResetLinkController::class, 'store'])->name('common.password.email');
    Route::post('/reset-password', [NewPasswordController::class, 'store'])->name('common.password.store');
    Route::get('/verify-email/{id}/{hash}', VerifyEmailController::class)->middleware(['auth', 'signed', 'throttle:6,1'])->name('common.verification.verify');
    Route::post('/email/verification-notification', [EmailVerificationNotificationController::class, 'store'])->middleware(['auth', 'throttle:6,1'])->name('common.verification.send');
    Route::any('/login', [LoginController::class, 'login']);
    Route::any('/logout', [LoginController::class, 'logout'])->middleware('auth:sanctum');
    Route::middleware(['auth:sanctum'])->group(function () {
        Route::any('/user', function (Request $request) {
            return $request->user();
        });
    });
});
