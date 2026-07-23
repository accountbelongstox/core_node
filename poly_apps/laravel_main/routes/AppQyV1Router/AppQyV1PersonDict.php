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
# -----------------------------PersonalDictionary-------------------------------
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1PersonDict\AppQyV1PersonalDictionaryQueryController as PDQController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1PersonDict\AppQyV1PersonalDictionaryCreationController as PDAController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1PersonDict\AppQyV1PersonalDictionaryDeletionController as PDDController;
$version = getAppVersionFromFilename(__FILE__);
$apiVersionPrefix = 'app_qy_v1';
Route::prefix($apiVersionPrefix)->group(function () {
    Route::middleware(['auth:sanctum'])->group(function () {
        Route::any('/create_personal_dictionary', [PDAController::class, 'createPersonalDictionary']);
        Route::any('/query_personal_dictionary', [PDQController::class, 'queryPDictionary']);
        Route::any('/query_personal_dictionary_by_words', [PDQController::class, 'queryPDictionaryByWords']);
        Route::any('/delete_personal_dictionary_by_id', [PDDController::class, 'deletePersonalDictionaryByID']);
        Route::any('/delete_personal_all_dictionary', [PDDController::class, 'deletePersonalAllDictionary']);
    });
});
