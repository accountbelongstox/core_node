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

# System and Initialization Routes for DictV1
use App\Apps\DictV1\Controllers\DictV1System\DictV1SystemInitializationController;
use App\Apps\DictV1\Controllers\DictV1WordQurey\DictV1UntranslatedWordsController;
use App\Apps\DictV1\Controllers\DictV1WordQurey\DictV1WordQueryController;
use App\Apps\DictV1\Controllers\DictV1WordSubmit\DictV1WordDataSubmissionController;

$version = getAppVersionFromFilename(__FILE__);
$apiVersionPrefix = 'dict/' . $version;

Route::prefix($apiVersionPrefix)->group(function () {
    
    // Public system routes (no authentication required)
    Route::group(['prefix' => 'system'], function () {
        Route::post('/initialize', [DictV1SystemInitializationController::class, 'initialize']);
        Route::get('/initialization-status', [DictV1SystemInitializationController::class, 'status']);
        Route::post('/process-vocabulary', [DictV1SystemInitializationController::class, 'processVocabularyOnly']);
        Route::get('/vocabulary-status', [DictV1SystemInitializationController::class, 'getVocabularyStatus']);
    });

    // Enhanced word query routes
    Route::middleware(['custom.authenticate'])->group(function () {
        
        // Enhanced word queries
        Route::get('/word/{word}/enhanced', [DictV1WordQueryController::class, 'queryWordEnhanced']);
        Route::post('/word/{word}/enhanced', [DictV1WordQueryController::class, 'queryWordEnhanced']);
        
        // Untranslated words management
        Route::get('/untranslated', [DictV1UntranslatedWordsController::class, 'getUntranslatedWords']);
        Route::get('/untranslated/priority', [DictV1UntranslatedWordsController::class, 'getWordsByPriority']);
        
        // Word data submission
        Route::post('/word/{word}/translation', [DictV1WordDataSubmissionController::class, 'submitTranslation']);
        Route::post('/word/{word}/audio', [DictV1WordDataSubmissionController::class, 'submitAudio']);
        Route::post('/word/{word}/images', [DictV1WordDataSubmissionController::class, 'submitImages']);
        Route::post('/word/{word}/complete', [DictV1WordDataSubmissionController::class, 'submitCompleteWordData']);
    });
    
    // Client token protected routes for system operations
    Route::middleware(['client.token'])->group(function () {
        Route::post('/system/reinitialize', [DictV1SystemInitializationController::class, 'initialize']);
    });
});