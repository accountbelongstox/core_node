<?php

use Illuminate\Support\Facades\Route;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Controllers\DingDuoDuoV1Public\DingDuoDuoV1MemberAuthController;

/*
|--------------------------------------------------------------------------
| DingDuoDuoV1 (订多多) member auth API
|--------------------------------------------------------------------------
|
| require_once'd from routes/api.php, so these carry the /api prefix:
| /api/ding_duo_duo_v1/member/{login,me}. login is public; me resolves the
| member from the X-DD-Token header inline.
|
*/

Route::prefix('ding_duo_duo_v1')->group(function () {
    Route::post('member/register', [DingDuoDuoV1MemberAuthController::class, 'register']);
    Route::post('member/login', [DingDuoDuoV1MemberAuthController::class, 'login']);
    Route::get('member/me', [DingDuoDuoV1MemberAuthController::class, 'me']);
});
