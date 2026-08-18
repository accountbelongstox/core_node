<?php

use Illuminate\Support\Facades\Route;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1ClientDeviceSettingsController;

/*
|--------------------------------------------------------------------------
| AppQyV1 Client (guest device) Routes — PUBLIC, no auth
|--------------------------------------------------------------------------
|
| Roaming settings keyed by browser fingerprint / stable client id.
| Base path: /api/app_qy_v1/client/
|
*/

$apiVersionPrefix = 'app_qy_v1';

Route::prefix($apiVersionPrefix)->group(function () {
    Route::prefix('client')->group(function () {
        Route::get('/device-settings', [AppQyV1ClientDeviceSettingsController::class, 'get']);
        Route::put('/device-settings', [AppQyV1ClientDeviceSettingsController::class, 'save']);
        Route::post('/device-settings', [AppQyV1ClientDeviceSettingsController::class, 'save']);
    });
});
