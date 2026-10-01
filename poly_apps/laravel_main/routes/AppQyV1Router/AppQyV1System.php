<?php

use App\Support\ApiComputeCatalog;
use Illuminate\Support\Facades\Route;

# System and Initialization Routes for AppQyV1
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1System\AppQyV1SystemInitializationController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1System\AppQyV1SupportedLanguagesController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1System\AppQyV1SystemInitComplianceCtl;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1System\AppQyV1ProcessingCapabilityController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordQurey\AppQyV1WordQueryController;

$version = getAppVersionFromFilename(__FILE__);
$apiVersionPrefix = 'app_qy_v1';

Route::prefix($apiVersionPrefix)->group(function () {
    
    // Public system routes; /initialize needs a client key or an admin session
    Route::group(['prefix' => 'system'], function () {
        Route::post('/initialize', [AppQyV1SystemInitializationController::class, 'initialize'])->middleware(ApiComputeCatalog::AUTH_MIDDLEWARE_ADMIN);
        Route::get('/initialization-status', [AppQyV1SystemInitializationController::class, 'status']);
        Route::get('/init-compliance', [AppQyV1SystemInitComplianceCtl::class, 'complianceReport']);
        Route::get('/dictionary-statistics', [AppQyV1SystemInitializationController::class, 'getDictionaryStatistics']);
        Route::get('/statistics', [AppQyV1SystemInitializationController::class, 'getSystemStatistics']);
        Route::get('/statistics/summary', [AppQyV1SystemInitializationController::class, 'getSystemStatisticsSummary']);
        Route::get('/statistics/languages', [AppQyV1SystemInitializationController::class, 'getSystemStatisticsLanguages']);
        Route::get('/statistics/queues', [AppQyV1SystemInitializationController::class, 'getSystemStatisticsQueues']);
        Route::get('/supported-languages', [AppQyV1SupportedLanguagesController::class, 'getSupportedLanguages']);
        Route::get('/supported-languages/{code}', [AppQyV1SupportedLanguagesController::class, 'getLanguageByCode']);
        // Laravel-host processing capability + recommendation (laravel direct vs pycore).
        Route::get('/processing-capability', [AppQyV1ProcessingCapabilityController::class, 'show']);
    });

    // Enhanced word query routes
    Route::middleware(['auth:sanctum'])->group(function () {
        
        // Enhanced word queries
        Route::get('/word/{word}/enhanced', [AppQyV1WordQueryController::class, 'queryWordEnhanced']);
        Route::post('/word/{word}/enhanced', [AppQyV1WordQueryController::class, 'queryWordEnhanced']);
    });
    
    // Client token protected routes for system operations
    Route::middleware(['client.token'])->group(function () {
        Route::post('/system/reinitialize', [AppQyV1SystemInitializationController::class, 'initialize']);
    });
});
