<?php

use Illuminate\Support\Facades\Route;
use App\Apps\PddToolV1\PddToolV1Controllers\PddToolV1Admin\PddToolV1AdminController;

/*
|--------------------------------------------------------------------------
| PddToolV1 (订多多) Admin API — pdd-manager console
|--------------------------------------------------------------------------
|
| require_once'd from routes/api.php, so these DO carry the /api prefix:
| full prefix = /api/pdd/admin/*. Protected by the existing 'dashboard.auth'
| middleware (loopback debug bypass OR a valid Sanctum token), matching the
| other manager pages.
|
*/

Route::middleware('dashboard.auth')->prefix('pdd/admin')->group(function () {
    Route::get('/stats', [PddToolV1AdminController::class, 'stats']);

    Route::get('/users', [PddToolV1AdminController::class, 'users']);
    Route::get('/users/{id}', [PddToolV1AdminController::class, 'userDetail'])->whereNumber('id');
    Route::post('/users/{id}/membership', [PddToolV1AdminController::class, 'setMembership'])->whereNumber('id');
    Route::post('/users/{id}/points', [PddToolV1AdminController::class, 'adjustPoints'])->whereNumber('id');
    Route::post('/users/{id}/disable', [PddToolV1AdminController::class, 'disable'])->whereNumber('id');
    Route::post('/users/{id}/enable', [PddToolV1AdminController::class, 'enable'])->whereNumber('id');

    Route::get('/recharges', [PddToolV1AdminController::class, 'recharges']);
    Route::get('/memberships/expiring', [PddToolV1AdminController::class, 'expiring']);

    Route::get('/payment-settings', [PddToolV1AdminController::class, 'getPaymentSettings']);
    Route::post('/payment-settings', [PddToolV1AdminController::class, 'savePaymentSettings']);

    Route::get('/packages', [PddToolV1AdminController::class, 'packages']);
    Route::post('/packages', [PddToolV1AdminController::class, 'upsertPackages']);
});
