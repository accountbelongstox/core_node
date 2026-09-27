<?php

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
