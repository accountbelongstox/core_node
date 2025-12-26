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
# -----------------------------PersonalDictionary-------------------------------
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1PersonDict\AppQyV1PersonalDictionaryQueryController as PDQController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1PersonDict\AppQyV1PersonalDictionaryCreationController as PDAController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1PersonDict\AppQyV1PersonalDictionaryDeletionController as PDDController;
$version = getAppVersionFromFilename(__FILE__);
$apiVersionPrefix = 'app_qy_v1';
Route::prefix($apiVersionPrefix)->group(function () {
    Route::middleware(['custom.authenticate'])->group(function () {
        Route::any('/create_personal_dictionary', [PDAController::class, 'createPersonalDictionary']);
        Route::any('/query_personal_dictionary', [PDQController::class, 'queryPDictionary']);
        Route::any('/query_personal_dictionary_by_words', [PDQController::class, 'queryPDictionaryByWords']);
        Route::any('/delete_personal_dictionary_by_id', [PDDController::class, 'deletePersonalDictionaryByID']);
        Route::any('/delete_personal_all_dictionary', [PDDController::class, 'deletePersonalAllDictionary']);
    });
});

