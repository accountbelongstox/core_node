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
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Group\AppQyV1WordGroupCreationController as DGAController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Group\AppQyV1WordGroupQueryController as DGQController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Group\AppQyV1WordGroupDeletionController as DGDController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Dictionaries\AppQyV1DictionaryManagementController as AddDController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Dictionaries\AppQyV1DictionaryQueryController as QueryDController;
$version = getAppVersionFromFilename(__FILE__);
$apiVersionPrefix = 'app_qy_v1';
Route::prefix($apiVersionPrefix)->group(function () {
    Route::middleware(['custom.authenticate'])->group(function () {
        Route::any('/create_group', [DGAController::class, 'createDictGroup']);
        Route::any('/query_all_groups', [DGQController::class, 'getAllGroup']);
        Route::any('/query_group_by_name', [DGQController::class, 'getGroupByName']);
        Route::any('/query_group_by_gid', [DGQController::class, 'getGroupByGid']);
        Route::any('/query_gwords', [DGQController::class, 'getGwords']);
        Route::any('/query_gcontent', [DGQController::class, 'getGcontent']);
        Route::any('/query_gfrequency', [DGQController::class, 'getGFrequency']);
        Route::any('/delete_group_by_name', [DGDController::class, 'deleteDictGroupByGname']);
        Route::any('/delete_group_by_gid', [DGDController::class, 'deleteDictGroupByGid']);

        // Dictionary Routes
        // Route::any('/add_dictionary', [AddDController::class, 'addDictionary']);
        // Route::any('/add_dictionary_list', [AddDController::class, 'addDictionaryList']);
    });
    
    // Client Token Auth Routes - Protected by client.token middleware
    Route::middleware(['client.token'])->group(function () {
        Route::any('/add_dictionary', [AddDController::class, 'filterAndAddDictionaryList']);
        Route::any('/find_non_existing_dictionary', [QueryDController::class, 'findNonExistingEntries']);
    });
});

