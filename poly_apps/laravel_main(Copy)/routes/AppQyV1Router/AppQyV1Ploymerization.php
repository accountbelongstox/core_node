<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

use Illuminate\Support\Facades\Route;

# -----------------------------Dict-------------------------------
use App\Apps\AppQyV1\Controllers\AppQyV1Ploymerization\AppQyV1GroupPolymerizationController as GPDController;
// use App\Apps\AppQyV1\Controllers\AppQyV1Ploymerization\GPQController;

$version = getAppVersionFromFilename(__FILE__);
$apiVersionPrefix = 'dict/'.$version;
Route::prefix($apiVersionPrefix)->group(function () {
    Route::middleware(['custom.authenticate'])->group(function () {
        Route::any('/create_group_and_fetch_list', [GPDController::class, 'queryGroupFetchList']);

    });
});

