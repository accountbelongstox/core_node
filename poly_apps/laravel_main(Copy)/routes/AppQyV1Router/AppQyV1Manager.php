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

# -----------------------------Manager-------------------------------
use App\Apps\AppQyV1\Controllers\AppQyV1Group\AppQyV1WordGroupManagementController as DGMController;
$version = getAppVersionFromFilename(__FILE__);
$apiVersionPrefix = 'dict/'.$version;
Route::prefix($apiVersionPrefix)->group(function () {
    Route::prefix('manager')->group(function () {
        Route::middleware(['custom.authenticate'])->group(function () {
            Route::any('/get_all_groups_by_manager', [DGMController::class, 'getAllGroupByManager']);
        });
    });
});

