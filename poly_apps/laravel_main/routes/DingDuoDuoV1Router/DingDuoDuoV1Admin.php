<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

use Illuminate\Support\Facades\Route;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Controllers\DingDuoDuoV1Admin\DingDuoDuoV1MemberAdminController;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Controllers\DingDuoDuoV1Admin\DingDuoDuoV1SuperCodeAdminController;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Controllers\DingDuoDuoV1Admin\DingDuoDuoV1RechargeAdminController;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Controllers\DingDuoDuoV1Admin\DingDuoDuoV1BindingAdminController;

/*
|--------------------------------------------------------------------------
| DingDuoDuoV1 (订多多) admin API
|--------------------------------------------------------------------------
|
| require_once'd from routes/api.php, so these carry the /api prefix:
| /api/ding_duo_duo_v1/admin/*. Guarded by 'custom.authenticate' (Sanctum
| bearer token). Member management / expiry / permissions, super-code issuing,
| recharge-API settings and cross-PDD-user bindings.
|
*/

Route::prefix('ding_duo_duo_v1/admin')->middleware(['custom.authenticate'])->group(function () {
    // Member management (CRUD) + expiry / permissions / tier.
    Route::get('members', [DingDuoDuoV1MemberAdminController::class, 'index']);
    Route::post('members', [DingDuoDuoV1MemberAdminController::class, 'store']);
    Route::get('members/{id}', [DingDuoDuoV1MemberAdminController::class, 'show'])->whereNumber('id');
    Route::put('members/{id}', [DingDuoDuoV1MemberAdminController::class, 'update'])->whereNumber('id');
    Route::delete('members/{id}', [DingDuoDuoV1MemberAdminController::class, 'destroy'])->whereNumber('id');
    Route::post('members/{id}/expiry', [DingDuoDuoV1MemberAdminController::class, 'setExpiry'])->whereNumber('id');
    Route::post('members/{id}/permissions', [DingDuoDuoV1MemberAdminController::class, 'setPermissions'])->whereNumber('id');
    Route::post('members/{id}/tier', [DingDuoDuoV1MemberAdminController::class, 'setTier'])->whereNumber('id');

    // Super codes.
    Route::get('super-codes', [DingDuoDuoV1SuperCodeAdminController::class, 'index']);
    Route::post('super-codes', [DingDuoDuoV1SuperCodeAdminController::class, 'issue']);
    Route::get('super-codes/{id}', [DingDuoDuoV1SuperCodeAdminController::class, 'show'])->whereNumber('id');
    Route::post('super-codes/{id}/revoke', [DingDuoDuoV1SuperCodeAdminController::class, 'revoke'])->whereNumber('id');

    // Recharge-API settings.
    Route::get('recharge-config', [DingDuoDuoV1RechargeAdminController::class, 'getConfig']);
    Route::post('recharge-config', [DingDuoDuoV1RechargeAdminController::class, 'updateConfig']);

    // Cross-PDD-user bindings.
    Route::get('bindings', [DingDuoDuoV1BindingAdminController::class, 'index']);
    Route::post('bindings', [DingDuoDuoV1BindingAdminController::class, 'store']);
    Route::delete('bindings/{id}', [DingDuoDuoV1BindingAdminController::class, 'destroy'])->whereNumber('id');
});
