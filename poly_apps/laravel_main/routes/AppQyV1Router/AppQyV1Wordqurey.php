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
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordQurey\AppQyV1WordQueryController as WordQController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordQurey\AppQyV1WordLookupController;

$version = getAppVersionFromFilename(__FILE__);
$apiVersionPrefix = 'app_qy_v1';

Route::prefix($apiVersionPrefix)->group(function () {
    Route::get('/lookup', [AppQyV1WordLookupController::class, 'lookup']);
    Route::post('/lookup/batch', [AppQyV1WordLookupController::class, 'batchLookup']);
    
    Route::middleware(['client.token'])->group(function () {
        Route::any('/word_exists', [WordQController::class, 'wordExists']);
        Route::any('/qurey_word', [WordQController::class, 'checkWord']);
        Route::get('/word/{word}', [WordQController::class, 'checkWord']);
        Route::any('/qurey_words', [WordQController::class, 'batchWordExists']);
    });
});

