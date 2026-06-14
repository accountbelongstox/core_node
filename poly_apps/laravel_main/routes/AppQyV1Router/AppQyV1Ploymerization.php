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

# -----------------------------Dict-------------------------------
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Ploymerization\AppQyV1GroupPolymerizationController as GPDController;
// use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Ploymerization\GPQController;

$version = getAppVersionFromFilename(__FILE__);
$apiVersionPrefix = 'dict/'.$version;
Route::prefix($apiVersionPrefix)->group(function () {
    Route::middleware(['custom.authenticate'])->group(function () {
        Route::any('/create_group_and_fetch_list', [GPDController::class, 'queryGroupFetchList']);

    });
});

