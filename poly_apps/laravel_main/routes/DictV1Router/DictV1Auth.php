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
use App\Apps\DictV1\Controllers\DictV1AuthenticationLoginController as DictloginController;
use App\Apps\DictV1\Controllers\DictV1AuthenticationEmailVerificationNotificationController as EmailVerificationNotificationController;
use App\Apps\DictV1\Controllers\DictV1AuthenticationPasswordResetController as NewPasswordController;
use App\Apps\DictV1\Controllers\DictV1AuthenticationPasswordResetLinkController as PasswordResetLinkController;
use App\Apps\DictV1\Controllers\DictV1AuthenticationRegistrationController as DictregisteredUserController;
use App\Apps\DictV1\Controllers\DictV1AuthenticationEmailVerificationController as VerifyEmailController;

$version = getAppVersionFromFilename(__FILE__);
$apiVersionPrefix = 'dict/' . $version;

Route::prefix($apiVersionPrefix)->group(function () {
    Route::any('/register', [DictregisteredUserController::class, 'apiStore'])->name('dict.register');
    Route::any('/forgot-password', [PasswordResetLinkController::class, 'store'])->name('dict.password.email');
    Route::any('/reset-password', [NewPasswordController::class, 'store'])->name('dict.password.store');
    Route::any('/verify-email/{id}/{hash}', [VerifyEmailController::class, '__invoke'])->middleware(['auth', 'signed', 'throttle:6,1'])->name('dict.verification.verify');
    Route::any('/email/verification-notification', [EmailVerificationNotificationController::class, 'store'])->middleware(['auth', 'throttle:6,1'])->name('dict.verification.send');
    Route::any('/login', [DictloginController::class, 'login']);
    
    Route::middleware(['custom.authenticate'])->group(function () {
        Route::any('/logout', [DictloginController::class, 'logout']);
        Route::any('/user', function (Request $request) {
            return $request->user();
        });
    });
});
