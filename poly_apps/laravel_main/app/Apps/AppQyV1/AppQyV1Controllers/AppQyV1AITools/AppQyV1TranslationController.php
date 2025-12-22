<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools;

use App\Http\Controllers\Controller;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TranslationService;
use App\Services\OpenRouterClient;
use App\Services\DeepSeekClient;
use App\Services\GeminiClient;
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
        
        $result = $this->translationService->translate(
            text: $request->input('text'),
            targetLanguage: $request->input('target_language'),
            type: $request->input('type', 'general'),
            model: $modelInfo['model'] ?? null,
            provider: $modelInfo['provider'] ?? 'openrouter'
        );
        
        return response()->json($result);
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
        
        $results = [];
        foreach ($request->input('texts') as $text) {
            $results[] = $this->translationService->translate(
                text: $text,
                targetLanguage: $request->input('target_language'),
                type: $request->input('type', 'general'),
                model: $modelInfo['model'] ?? null,
                provider: $modelInfo['provider'] ?? 'openrouter'
            );
        }
        
        return response()->json([
            'success' => true,
            'results' => $results,
        ]);
    }
    
    public function getLanguages(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'languages' => $this->translationService->getAvailableLanguages(),
        ]);
    }
    
    public function getTypes(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'types' => $this->translationService->getAvailableTypes(),
        ]);
    }
    
    public function getModels(Request $request): JsonResponse
    {
        $openrouterClient = new OpenRouterClient();
        $deepseekClient = new DeepSeekClient();
        $geminiClient = new GeminiClient();
        
        $openrouterModels = $openrouterClient->getFreeModels();
        foreach ($openrouterModels as &$model) {
            $model['provider'] = 'openrouter';
        }
        
        $deepseekModels = $deepseekClient->getModels();
        $geminiModels = $geminiClient->getModels();
        
        $allModels = array_merge($deepseekModels, $geminiModels, $openrouterModels);
        
        $seen = [];
        $uniqueModels = [];
        foreach ($allModels as $model) {
            if (!isset($seen[$model['id']])) {
                $seen[$model['id']] = true;
                $uniqueModels[] = $model;
            }
        }
        
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
        
        return response()->json([
            'success' => true,
            'models' => $uniqueModels,
        ]);
    }
    
    public function simpleTranslateWithGoogle(Request $request): JsonResponse
    {
        $request->validate([
            'text' => 'required|string',
            'target_language' => 'required|string',
        ]);
        
        $text = $request->input('text');
        $targetLanguage = $request->input('target_language');
        
        $translatorUtil = new \App\CallPycoreUtils\PycoreTranslatorUtil();
        
        $result = $translatorUtil->translateSingle(
            $text,
            'auto',
            $targetLanguage,
            true
        );
        
        if (isset($result['error'])) {
            return response()->json([
                'success' => false,
                'error' => $result['error'],
                'details' => $result['details'] ?? null,
            ]);
        }
        
        return response()->json([
            'success' => true,
            'translated_text' => $result['translated_text'] ?? '',
            'original_text' => $result['original_text'] ?? $text,
            'src_lang' => $result['src_lang'] ?? 'auto',
            'dest_lang' => $result['dest_lang'] ?? $targetLanguage,
            'provider' => 'google',
        ]);
    }
    
    public function getTemplates(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'templates' => $this->translationService->getLanguageTemplates(),
        ]);
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

        $results = [];

        foreach ($targetLanguages as $targetLang) {
                $translation = $this->translationService->translateWithModel(
                    text: $text,
                    targetLanguage: $targetLang,
                    model: $modelInfo['model'] ?? null,
                    provider: $modelInfo['provider'] ?? 'google',
                    options: $request->input('options', [])
                );

                if ($translation['success']) {
                    $results[$targetLang] = [
                        'translation' => $translation['translation'],
                        'provider' => $translation['provider'] ?? 'unknown',
                    ];

                    if ($generateAudio && isset($translation['translation'])) {
                        $ttsService = new \App\Services\EdgeTTS\EdgeTTSService();
                        $audioResult = $ttsService->generateAudio($translation['translation'], $targetLang, 'sentence');
                        $audioResult = $this->fixAudioUrl($audioResult);

                        if ($audioResult['success']) {
                            $results[$targetLang]['audio_url'] = $audioResult['audio_url'];
                        }
                    }
                } else {
                    $results[$targetLang] = [
                        'error' => $translation['error'] ?? 'Translation failed',
                    ];
                }
        }

        return response()->json([
            'success' => true,
            'status' => 'completed',
            'result' => $results,
            'processing_time' => 0,
        ]);
    }
    
    public function getTaskStatus(Request $request, string $taskId): JsonResponse
    {
        return response()->json([
            'success' => false,
            'error' => 'Task system not yet implemented in AppQyV1',
        ]);
    }
    
    public function processNextTask(Request $request): JsonResponse
    {
        return response()->json([
            'success' => false,
            'error' => 'Task system not yet implemented in AppQyV1',
        ]);
    }

    /**
     * Fix audio_url path to use AppQyV1 route prefix
     * Convert /tts/audio/... to /api/app_qy_v1/ai_tools/tts/audio/...
     */
    private function fixAudioUrl(array $result): array
    {
        if (isset($result['audio_url'])) {
            if (strpos($result['audio_url'], '/tts/audio/') === 0) {
                $result['audio_url'] = str_replace('/tts/audio/', '/api/app_qy_v1/ai_tools/tts/audio/', $result['audio_url']);
            }
        }

        return $result;
    }
}
