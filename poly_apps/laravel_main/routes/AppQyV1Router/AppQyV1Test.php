<?php

use Illuminate\Support\Facades\Route;
# -----------------------------GlobalVar-------------------------------
use App\Providers\GlobalVar;
$version = getAppVersionFromFilename(__FILE__);
$apiVersionPrefix = 'app_qy_v1';
Route::prefix($apiVersionPrefix)->group(function () {
    Route::middleware(['custom.authenticate'])->group(function () {
        Route::any('/get_gvars', [GlobalVar::class, 'all']);
    });
});