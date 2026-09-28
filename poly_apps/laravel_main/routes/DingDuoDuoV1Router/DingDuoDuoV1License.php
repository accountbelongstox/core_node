<?php

use Illuminate\Support\Facades\Route;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Controllers\DingDuoDuoV1Public\DingDuoDuoV1LicenseController;

/*
|--------------------------------------------------------------------------
| DingDuoDuoV1 (订多多) public license API
|--------------------------------------------------------------------------
|
| require_once'd from routes/api.php, so these carry the /api prefix:
| full paths = /api/ding_duo_duo_v1/license/{verify,heartbeat}. Public — the
| extension polls these (no super-code path); entitlement is resolved from the
| presented token / X-DD-Token header.
|
*/

Route::prefix('ding_duo_duo_v1')->group(function () {
    Route::post('license/verify', [DingDuoDuoV1LicenseController::class, 'verify']);
    Route::post('license/heartbeat', [DingDuoDuoV1LicenseController::class, 'heartbeat']);
});
