<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools;

use App\Services\PycoreTasks\PycoreTaskQueue;
use App\Services\AiGateway\GoogleTranslateClient;
use App\Http\Controllers\Controller;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TranslationService;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TtsUrl;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class AppQyV1TranslationController extends Controller
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    private $translationService;
    
    public function __construct()
    {
        $this->translationService = new AppQyV1TranslationService();
    }
    
    private function resolveModelId(?int $modelIndex): ?array
    {
        if ($modelIndex === null) {
            return null;
        }
        
        $mappingFile = \App\Providers\PathMapper::getLaravelDatabaseDir() . '/translation_tasks/model_mapping.json';
        
        if (!file_exists($mappingFile)) {
            return null;
        }
        
        $mappingData = json_decode(file_get_contents($mappingFile), true);
        
        if ($mappingData && isset($mappingData['mapping'][$modelIndex])) {
            return [
                'model' => $mappingData['mapping'][$modelIndex],
                'provider' => $mappingData['provider_mapping'][$modelIndex] ?? 'openrouter',
            ];
        }
        
        return null;
    }
    
    public function translate(Request $request): JsonResponse
    {
        $request->validate([
            'text' => 'required|string',
            'target_language' => 'required|string',
            'type' => 'nullable|string',
            'model' => 'nullable|integer',
        ]);
        
        $modelInfo = $this->resolveModelId($request->input('model'));
        
        $model = null;
        $provider = 'openrouter';
        if ($modelInfo) {
            if (isset($modelInfo['model'])) {
                $model = $modelInfo['model'];
            }
            if (isset($modelInfo['provider'])) {
                $provider = $modelInfo['provider'];
            }
        }
        
        $result = $this->translationService->translate(
            text: $request->input('text'),
            targetLanguage: $request->input('target_language'),
            type: $request->input('type', 'general'),
            model: $model,
            provider: $provider
        );
        
        return $this->success($result, __('app_qy_v1.messages.translation_completed_successfully'));
    }
    
    public function batchTranslate(Request $request): JsonResponse
    {
        $request->validate([
            'texts' => 'required|array',
            'texts.*' => 'required|string',
            'target_language' => 'required|string',
            'type' => 'nullable|string',
            'model' => 'nullable|integer',
        ]);
        
        $modelInfo = $this->resolveModelId($request->input('model'));
        
        $model = null;
        $provider = 'openrouter';
        if ($modelInfo) {
            if (isset($modelInfo['model'])) {
                $model = $modelInfo['model'];
            }
            if (isset($modelInfo['provider'])) {
                $provider = $modelInfo['provider'];
            }
        }
        
        $results = [];
        foreach ($request->input('texts') as $text) {
            $results[] = $this->translationService->translate(
                text: $text,
                targetLanguage: $request->input('target_language'),
                type: $request->input('type', 'general'),
                model: $model,
                provider: $provider
            );
        }
        
        return $this->success(['results' => $results], __('app_qy_v1.messages.batch_translation_completed_successfully'));
    }
    
    public function getLanguages(Request $request): JsonResponse
    {
        return $this->success([
            'languages' => $this->translationService->getAvailableLanguages(),
        ], __('app_qy_v1.messages.languages_retrieved_successfully'));
    }
    
    public function getTypes(Request $request): JsonResponse
    {
        return $this->success([
            'types' => $this->translationService->getAvailableTypes(),
        ], __('app_qy_v1.messages.types_retrieved_successfully'));
    }
    
    public function getModels(Request $request): JsonResponse
    {
        $uniqueModels = $this->translationService->availableModels();

        $modelMapping = [];
        $providerMapping = [];
        foreach ($uniqueModels as $index => $model) {
            $modelMapping[$index] = $model['id'];
            $providerMapping[$index] = $model['provider'] ?? 'openrouter';
        }
        
        $mappingFile = \App\Providers\PathMapper::getLaravelDatabaseDir() . '/translation_tasks/model_mapping.json';
        $mappingDir = dirname($mappingFile);
        
        if (!is_dir($mappingDir)) {
            mkdir($mappingDir, 0755, true);
        }
        
        file_put_contents($mappingFile, json_encode([
            'timestamp' => time(),
            'mapping' => $modelMapping,
            'provider_mapping' => $providerMapping,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        
        return $this->success([
            'models' => $uniqueModels,
        ], __('app_qy_v1.messages.models_retrieved_successfully'));
    }
    
    public function simpleTranslateWithGoogle(Request $request): JsonResponse
    {
        $request->validate([
            'text' => 'required|string',
            'target_language' => 'required|string',
        ]);
        
        $text = $request->input('text');
        $targetLanguage = $request->input('target_language');
        
        $result = GoogleTranslateClient::translate($text, 'auto', $targetLanguage, true);
        if (isset($result['error'])) {
            $details = null;
            if (isset($result['details'])) {
                $details = $result['details'];
            }
            return $this->error($result['error'], 400, ['details' => $details]);
        }
        
        $translatedText = '';
        if (isset($result['translated_text'])) {
            $translatedText = $result['translated_text'];
        }
        $originalText = $text;
        if (isset($result['original_text'])) {
            $originalText = $result['original_text'];
        }
        $srcLang = 'auto';
        if (isset($result['src_lang'])) {
            $srcLang = $result['src_lang'];
        }
        $destLang = $targetLanguage;
        if (isset($result['dest_lang'])) {
            $destLang = $result['dest_lang'];
        }
        
        return $this->success([
            'translated_text' => $translatedText,
            'original_text' => $originalText,
            'src_lang' => $srcLang,
            'dest_lang' => $destLang,
            'provider' => 'google',
        ], __('app_qy_v1.messages.translation_completed_successfully'));
    }
    
    public function getTemplates(Request $request): JsonResponse
    {
        return $this->success([
            'templates' => $this->translationService->getLanguageTemplates(),
        ], __('app_qy_v1.messages.templates_retrieved_successfully'));
    }
    
    public function learningMode(Request $request): JsonResponse
    {
        $request->validate([
            'text' => 'required|string',
            'target_languages' => 'required|array',
            'target_languages.*' => 'required|string',
            'options' => 'nullable|array',
            'model' => 'nullable|integer',
            'generate_audio' => 'nullable|boolean',
            'translation_method' => 'nullable|string',
            'skip_cache' => 'nullable|boolean',
        ]);

        $modelInfo = $this->resolveModelId($request->input('model'));
        $targetLanguages = $request->input('target_languages');
        $text = $request->input('text');
        $generateAudio = $request->input('generate_audio', false);

        $model = null;
        $provider = 'google';
        if ($modelInfo) {
            if (isset($modelInfo['model'])) {
                $model = $modelInfo['model'];
            }
            if (isset($modelInfo['provider'])) {
                $provider = $modelInfo['provider'];
            }
        }

        $results = [];

        foreach ($targetLanguages as $targetLang) {
                $translation = $this->translationService->translateWithModel(
                    text: $text,
                    targetLanguage: $targetLang,
                    model: $model,
                    provider: $provider,
                    options: $request->input('options', [])
                );

                if ($translation['success']) {
                    $translationProvider = 'unknown';
                    if (isset($translation['provider'])) {
                        $translationProvider = $translation['provider'];
                    }
                    $results[$targetLang] = [
                        'translation' => $translation['translation'],
                        'provider' => $translationProvider,
                    ];

                    if ($generateAudio && isset($translation['translation'])) {
                        $ttsService = new \App\Services\EdgeTTS\EdgeTTSService();
                        $audioResult = $ttsService->generateAudio($translation['translation'], $targetLang, 'sentence');

                        if ($audioResult['success']) {
                            $results[$targetLang]['audio_url'] = AppQyV1TtsUrl::forPath($audioResult['audio_path']);
                        } else {
                            $results[$targetLang]['audio'] = PycoreTaskQueue::embed($audioResult);
                        }
                    }
                } else {
                    $errorMessage = 'Translation failed';
                    if (isset($translation['error'])) {
                        $errorMessage = $translation['error'];
                    }
                    $results[$targetLang] = [
                        'error' => $errorMessage,
                    ];
                }
        }

        return $this->success([
            'status' => 'completed',
            'result' => $results,
            'processing_time' => 0,
        ], __('app_qy_v1.messages.learning_mode_translation_completed_successfully'));
    }
    
    /**
     * Async word translation is now handled by the global_tasks pipeline.
     * Use the queue endpoints instead of these per-task helpers:
     *   POST app_qy_v1/ai_tools/translation/queue/batch/add    (enqueue words)
     *   POST app_qy_v1/ai_tools/translation/queue/batch/status (read status)
     * See AppQyV1TranslationQueueController and docs TRANSLATION_PIPELINE.md.
     */
    public function getTaskStatus(Request $request, string $taskId): JsonResponse
    {
        return $this->error(
            __('app_qy_v1.messages.per_task_polling_is_superseded_by_the'),
            410
        );
    }

    public function processNextTask(Request $request): JsonResponse
    {
        return $this->error(
            __('app_qy_v1.messages.manual_task_processing_is_superseded_by_the'),
            410
        );
    }
}
