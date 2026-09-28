<?php

use Illuminate\Support\Facades\Route;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordQurey\AppQyV1WordQueryController as WordQController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordQurey\AppQyV1WordLookupController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordQurey\AppQyV1EcdictLookupCtl;

$version = getAppVersionFromFilename(__FILE__);
$apiVersionPrefix = 'app_qy_v1';

Route::prefix($apiVersionPrefix)->group(function () {
    Route::get('/lookup', [AppQyV1WordLookupController::class, 'lookup']);
    Route::post('/lookup/batch', [AppQyV1WordLookupController::class, 'batchLookup']);

    // ECDICT offline dictionary (same stardict.db pycore serves; PathMapper-resolved).
    Route::get('/ecdict/status', [AppQyV1EcdictLookupCtl::class, 'status']);
    Route::match(['get', 'post'], '/ecdict/lookup', [AppQyV1EcdictLookupCtl::class, 'lookup']);
    Route::match(['get', 'post'], '/ecdict/match', [AppQyV1EcdictLookupCtl::class, 'match']);
    
    Route::middleware(['client.token'])->group(function () {
        Route::any('/word_exists', [WordQController::class, 'wordExists']);
        Route::any('/qurey_word', [WordQController::class, 'checkWord']);
        Route::get('/word/{word}', [WordQController::class, 'checkWord']);
        Route::any('/qurey_words', [WordQController::class, 'batchWordExists']);
    });
});

