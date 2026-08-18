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
use App\Apps\PddToolV1\PddToolV1Controllers\PddToolV1Auth\PddToolV1AuthController;
use App\Apps\PddToolV1\PddToolV1Controllers\PddToolV1User\PddToolV1UserController;
use App\Apps\PddToolV1\PddToolV1Controllers\PddToolV1Warehouse\PddToolV1WarehouseController;
use App\Apps\PddToolV1\PddToolV1Controllers\PddToolV1Order\PddToolV1OrderController;
use App\Apps\PddToolV1\PddToolV1Controllers\PddToolV1Erp\PddToolV1ErpController;
use App\Apps\PddToolV1\PddToolV1Controllers\PddToolV1Payment\PddToolV1RechargeController;

/*
|--------------------------------------------------------------------------
| PddToolV1 (订多多) ROOT-level SaaS surface
|--------------------------------------------------------------------------
|
| Registered from bootstrap/app.php `then:` closure so these paths carry NO
| /api prefix and NO api/web middleware group. The 订多多 Chrome extension
| calls them bare (e.g. POST /login, GET /users/me). Authed routes use the
| project-standard 'custom.authenticate' middleware (Sanctum bearer token).
|
*/

// --- Public (no auth) ---
// NOTE: the root GET / health probe (200) is already served by the web.php
// index route, which is registered BEFORE this `then:` closure and would win the
// match. A PddToolV1-specific liveness endpoint is exposed at GET /pdd/health so
// the SaaS surface still has its own probe without clobbering the web index.
Route::get('/pdd/health', [PddToolV1AuthController::class, 'health']);
Route::post('/login', [PddToolV1AuthController::class, 'login']);
Route::post('/register', [PddToolV1AuthController::class, 'register']);

// Public recharge package list + shareable batch page.
Route::get('/recharge/packages', [PddToolV1RechargeController::class, 'packages']);
Route::get('/batch-orders/{batchId}', [PddToolV1OrderController::class, 'batchPage']);

// Public hosted pages the extension opens in a browser tab.
Route::get('/payment-page', [PddToolV1RechargeController::class, 'paymentPage']);
Route::get('/link-converter', [PddToolV1OrderController::class, 'linkConverterPage']);

// Gateway async notify callbacks (verified by signature, not a bearer token).
Route::post('/pay/alipay/notify', [PddToolV1RechargeController::class, 'alipayNotify']);
Route::post('/pay/wechat/notify', [PddToolV1RechargeController::class, 'wechatNotify']);

// --- Authed (shared Sanctum bearer-token middleware) ---
Route::middleware('custom.authenticate')->group(function () {
    // Profile
    Route::get('/users/me', [PddToolV1UserController::class, 'me']);
    Route::put('/users/me/password', [PddToolV1UserController::class, 'changePassword']);

    // PDD account binding
    Route::post('/users/me/pdd-accounts', [PddToolV1UserController::class, 'bindPddAccount']);
    Route::get('/users/me/pdd-accounts/{pddUserId}', [PddToolV1UserController::class, 'getPddAccount']);

    // Warehouses (CRUD)
    Route::get('/users/me/warehouses', [PddToolV1WarehouseController::class, 'index']);
    Route::post('/users/me/warehouses', [PddToolV1WarehouseController::class, 'store']);
    Route::put('/users/me/warehouses/{warehouseCode}', [PddToolV1WarehouseController::class, 'update']);
    Route::delete('/users/me/warehouses/{warehouseCode}', [PddToolV1WarehouseController::class, 'destroy']);

    // Batch orders
    Route::post('/batch-orders', [PddToolV1OrderController::class, 'createBatch']);
    Route::get('/batch-orders/{batchId}/purchase-orders', [PddToolV1OrderController::class, 'getPurchaseOrders']);

    // Order-link conversion
    Route::post('/convert-order-link', [PddToolV1OrderController::class, 'convertOrderLink']);

    // Recharge (authed create + status)
    Route::post('/recharge/create', [PddToolV1RechargeController::class, 'create']);
    Route::get('/recharge/status/{outTradeNo}', [PddToolV1RechargeController::class, 'status']);

    // ERP / duoduokai / qianniuhua bridge (STUB)
    Route::get('/erp/config', [PddToolV1ErpController::class, 'getConfig']);
    Route::post('/erp/config', [PddToolV1ErpController::class, 'saveConfig']);
    Route::delete('/erp/config', [PddToolV1ErpController::class, 'deleteConfig']);
    Route::post('/erp/test-connection', [PddToolV1ErpController::class, 'testConnection']);
    Route::post('/erp/minicheng/request', [PddToolV1ErpController::class, 'minichengRequest']);
    Route::post('/erp/qianniuhua/{action}', [PddToolV1ErpController::class, 'qianniuhua']);
});
