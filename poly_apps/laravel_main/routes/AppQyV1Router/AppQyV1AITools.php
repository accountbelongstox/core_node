<?php

use Illuminate\Support\Facades\Route;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1TranslationController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1TTSController;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1ArticleController;
use App\Providers\PathMapper;

Route::prefix('app_qy_v1')->group(function () {
    Route::get('/invitation-code', function() {
        $invitationCodeFile = PathMapper::getLaravelDataDir() . '/app_qy_v1_invitation_code.json';
        
        if (file_exists($invitationCodeFile)) {
            $data = json_decode(file_get_contents($invitationCodeFile), true);
            $code = $data['invitation_code'] ?? '';
            
            if (strlen($code) >= 3) {
                $first = substr($code, 0, 2);
                $last = substr($code, -1);
                $masked = $first . str_repeat('*', strlen($code) - 3) . $last;
                
                return response()->json([
                    'success' => true,
                    'masked_code' => $masked
                ]);
            }
        }
        
        return response()->json([
            'success' => false,
            'masked_code' => 'AP**********5'
        ]);
    });
});

Route::prefix('app_qy_v1/ai_tools')->group(function () {
    
    Route::prefix('translation')->group(function () {
        Route::get('/languages', [AppQyV1TranslationController::class, 'getLanguages']);
        Route::get('/types', [AppQyV1TranslationController::class, 'getTypes']);
        Route::get('/models', [AppQyV1TranslationController::class, 'getModels']);
        Route::get('/templates', [AppQyV1TranslationController::class, 'getTemplates']);
    });
    
    Route::prefix('tts')->group(function () {
        Route::get('/languages', [AppQyV1TTSController::class, 'getLanguages']);
        Route::get('/voices', [AppQyV1TTSController::class, 'getVoices']);
        Route::get('/options', [AppQyV1TTSController::class, 'getOptions']);
        Route::get('/audio/{language}/{type}/{speed}/{filename}', [AppQyV1TTSController::class, 'serveAudioWithSpeed']);
        Route::get('/audio/{language}/{type}/{filename}', [AppQyV1TTSController::class, 'serveAudio']);
    });

    Route::prefix('article')->group(function () {
        Route::get('/task/{taskId}', [AppQyV1ArticleController::class, 'getTaskStatus']);
    });
});

Route::prefix('app_qy_v1/ai_tools')->middleware('auth:sanctum')->group(function () {
    
    Route::prefix('translation')->group(function () {
        Route::post('/translate', [AppQyV1TranslationController::class, 'translate']);
        Route::post('/batch', [AppQyV1TranslationController::class, 'batchTranslate']);
        Route::post('/simple/google', [AppQyV1TranslationController::class, 'simpleTranslateWithGoogle']);
        Route::post('/learning', [AppQyV1TranslationController::class, 'learningMode']);
        Route::get('/task/{taskId}', [AppQyV1TranslationController::class, 'getTaskStatus']);
        Route::post('/process-next', [AppQyV1TranslationController::class, 'processNextTask']);
    });
    
    Route::prefix('tts')->group(function () {
        Route::post('/generate', [AppQyV1TTSController::class, 'generate']);
        Route::post('/batch-generate', [AppQyV1TTSController::class, 'batchGenerate']);
    });

    Route::prefix('article')->group(function () {
        Route::post('/submit', [AppQyV1ArticleController::class, 'submitArticle']);
        Route::post('/preview', [AppQyV1ArticleController::class, 'previewParsing']);
    });
});
