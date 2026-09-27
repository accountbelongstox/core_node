<?php

use Illuminate\Support\Facades\Route;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Controllers\DingDuoDuoV1Admin\DingDuoDuoV1MemberAdminController;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Controllers\DingDuoDuoV1Admin\DingDuoDuoV1RechargeAdminController;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Controllers\DingDuoDuoV1Admin\DingDuoDuoV1BindingAdminController;

/*
|--------------------------------------------------------------------------
| DingDuoDuoV1 (订多多) admin API
|--------------------------------------------------------------------------
|
| require_once'd from routes/api.php, so these carry the /api prefix:
| /api/ding_duo_duo_v1/admin/*. Guarded by 'custom.authenticate' (Sanctum
| bearer token) plus 'dashboard.auth' (administrator). Member management /
| expiry / permissions, recharge-API settings, and cross-PDD-user bindings.
|
*/

Route::prefix('ding_duo_duo_v1/admin')->middleware(['custom.authenticate', 'dashboard.auth'])->group(function () {
    // Member management (CRUD) + expiry / permissions / tier.
    Route::get('members', [DingDuoDuoV1MemberAdminController::class, 'index']);
    Route::post('members', [DingDuoDuoV1MemberAdminController::class, 'store']);
    Route::get('members/{id}', [DingDuoDuoV1MemberAdminController::class, 'show'])->whereNumber('id');
    Route::put('members/{id}', [DingDuoDuoV1MemberAdminController::class, 'update'])->whereNumber('id');
    Route::delete('members/{id}', [DingDuoDuoV1MemberAdminController::class, 'destroy'])->whereNumber('id');
    Route::post('members/{id}/expiry', [DingDuoDuoV1MemberAdminController::class, 'setExpiry'])->whereNumber('id');
    Route::post('members/{id}/permissions', [DingDuoDuoV1MemberAdminController::class, 'setPermissions'])->whereNumber('id');
    Route::post('members/{id}/tier', [DingDuoDuoV1MemberAdminController::class, 'setTier'])->whereNumber('id');

    // Recharge-API settings.
    Route::get('recharge-config', [DingDuoDuoV1RechargeAdminController::class, 'getConfig']);
    Route::post('recharge-config', [DingDuoDuoV1RechargeAdminController::class, 'updateConfig']);

    // Cross-PDD-user bindings.
    Route::get('bindings', [DingDuoDuoV1BindingAdminController::class, 'index']);
    Route::post('bindings', [DingDuoDuoV1BindingAdminController::class, 'store']);
    Route::delete('bindings/{id}', [DingDuoDuoV1BindingAdminController::class, 'destroy'])->whereNumber('id');
});
