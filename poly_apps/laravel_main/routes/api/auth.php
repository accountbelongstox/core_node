<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\EmailVerificationNotificationController;
use App\Http\Controllers\Auth\NewPasswordController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\Auth\VerifyEmailController;
use App\Http\Controllers\Auth\UserProfileController;

$apiVersionPrefix = '';
Route::prefix($apiVersionPrefix)->group(function () {
    Route::post('/register', [RegisteredUserController::class, 'apiStore'])->name('common.register');
    Route::post('/forgot-password', [PasswordResetLinkController::class, 'store'])->name('common.password.email');
    Route::post('/reset-password', [NewPasswordController::class, 'store'])->name('common.password.store');
    Route::get('/verify-email/{id}/{hash}', VerifyEmailController::class)->middleware(['auth', 'signed', 'throttle:6,1'])->name('common.verification.verify');
    Route::post('/email/verification-notification', [EmailVerificationNotificationController::class, 'store'])->middleware(['auth', 'throttle:6,1'])->name('common.verification.send');
    Route::any('/login', [LoginController::class, 'login'])->name('login');
    Route::any('/logout', [LoginController::class, 'logout'])->middleware('dashboard.auth');
    Route::middleware(['dashboard.auth'])->group(function () {
        Route::any('/user', function (Request $request) {
            return $request->user();
        });
        
        // Common user profile routes
        Route::get('/user/profile', [UserProfileController::class, 'getProfile']);
        Route::put('/user/profile', [UserProfileController::class, 'updateProfile']);
        Route::post('/user/profile', [UserProfileController::class, 'updateProfile']);
        Route::post('/user/change-password', [UserProfileController::class, 'changePassword']);
        
        // Common user preferences routes
        Route::get('/user/preferences', [UserProfileController::class, 'getPreferences']);
        Route::put('/user/preferences', [UserProfileController::class, 'updatePreferences']);
        Route::post('/user/preferences', [UserProfileController::class, 'updatePreferences']);
    });
});
