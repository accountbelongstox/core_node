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
