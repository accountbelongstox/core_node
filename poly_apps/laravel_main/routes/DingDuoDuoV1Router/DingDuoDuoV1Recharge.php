<?php

use Illuminate\Support\Facades\Route;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Controllers\DingDuoDuoV1Public\DingDuoDuoV1RechargeController;

/*
|--------------------------------------------------------------------------
| DingDuoDuoV1 (订多多) public recharge API
|--------------------------------------------------------------------------
|
| require_once'd from routes/api.php, so these carry the /api prefix:
| /api/ding_duo_duo_v1/recharge/{packages,create,callback}. Public — the
| member is resolved from the presented token / X-DD-Token header inline; the
| callback is the gateway notify hook (idempotent by out_trade_no).
|
*/

Route::prefix('ding_duo_duo_v1')->group(function () {
    Route::get('recharge/packages', [DingDuoDuoV1RechargeController::class, 'packages']);
    Route::post('recharge/create', [DingDuoDuoV1RechargeController::class, 'create']);
    Route::post('recharge/callback', [DingDuoDuoV1RechargeController::class, 'callback']);
});
