<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1UserAuth\AppQyV1AuthenticationLoginController as DictloginController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1UserAuth\AppQyV1AuthenticationEmailVerificationNotificationController as EmailVerificationNotificationController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1UserAuth\AppQyV1AuthenticationPasswordResetController as NewPasswordController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1UserAuth\AppQyV1AuthenticationPasswordResetLinkController as PasswordResetLinkController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1UserAuth\AppQyV1AuthenticationRegistrationController as DictregisteredUserController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1UserAuth\AppQyV1AuthenticationEmailVerificationController as VerifyEmailController;

$version = getAppVersionFromFilename(__FILE__);
$apiVersionPrefix = 'app_qy_v1';

Route::prefix($apiVersionPrefix)->group(function () {
    Route::any('/register', [DictregisteredUserController::class, 'apiStore'])->name('dict.register');
    Route::any('/forgot-password', [PasswordResetLinkController::class, 'store'])->name('dict.password.email');
    Route::any('/reset-password', [NewPasswordController::class, 'store'])->name('dict.password.store');
    Route::any('/verify-email/{id}/{hash}', [VerifyEmailController::class, '__invoke'])->middleware(['auth', 'signed', 'throttle:6,1'])->name('dict.verification.verify');
    Route::any('/email/verification-notification', [EmailVerificationNotificationController::class, 'store'])->middleware(['auth', 'throttle:6,1'])->name('dict.verification.send');
    Route::any('/login', [DictloginController::class, 'login']);

    Route::middleware(['auth:sanctum'])->group(function () {
        Route::any('/logout', [DictloginController::class, 'logout']);
        Route::any('/user', function (Request $request) {
            return $request->user();
        });
    });
});

Route::prefix('v1/auth')->group(function () {
    Route::any('/register', [DictregisteredUserController::class, 'apiStore'])->name('v1.auth.register');
    Route::any('/login', [DictloginController::class, 'login'])->name('v1.auth.login');
    Route::any('/forgot-password', [PasswordResetLinkController::class, 'store'])->name('v1.auth.password.email');
    Route::any('/reset-password', [NewPasswordController::class, 'store'])->name('v1.auth.password.store');

    Route::middleware(['auth:sanctum'])->group(function () {
        Route::any('/logout', [DictloginController::class, 'logout'])->name('v1.auth.logout');
        Route::any('/user', function (Request $request) {
            return $request->user();
        })->name('v1.auth.user');
    });
});
