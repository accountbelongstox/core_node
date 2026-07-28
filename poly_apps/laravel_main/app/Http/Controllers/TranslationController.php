<?php

namespace App\Http\Controllers;

use App\Services\TranslationService;
use App\Services\Translation\TranslationTaskManager;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Traits\ApiResponse;

/**
 * @deprecated This controller is deprecated. Use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1TranslationController instead.
 * All translation APIs have been moved to AppQyV1 with database-backed caching.
 *
 * Old endpoints: /translation/*
 * New endpoints: /app_qy_v1/ai_tools/translation/*
 *
 * Uses standardized ApiResponse trait
 * NO try-catch blocks - trust Laravel validation and database operations
 */
class TranslationController extends Controller
{
    use ApiResponse;

    private $translationService;
    private $taskManager;
    private const DEFAULT_PASSCODE = '12345678';

    public function __construct()
    {
        $this->translationService = new TranslationService();
        $this->taskManager = new TranslationTaskManager();
    }
    
    private function validatePasscode(Request $request): bool
    {
        return true;
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
            $provider = 'openrouter';
            if (isset($mappingData['provider_mapping'][$modelIndex])) {
                $provider = $mappingData['provider_mapping'][$modelIndex];
            }
            return [
                'model' => $mappingData['mapping'][$modelIndex],
                'provider' => $provider,
            ];
        }

        return null;
    }
    
    public function translate(Request $request): JsonResponse
    {
        if (!$this->validatePasscode($request)) {
            return $this->unauthorized('Invalid passcode');
        }

        $request->validate([
            'text' => 'required|string',
            'target_language' => 'required|string',
            'type' => 'nullable|string',
            'model' => 'nullable|integer',
        ]);

        $modelInfo = $this->resolveModelId($request->input('model'));

        $type = 'general';
        if ($request->has('type')) {
            $type = $request->input('type');
        }

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
            type: $type,
            model: $model,
            provider: $provider
        );

        return $this->success($result, 'Translation completed successfully');
    }
    
    public function batchTranslate(Request $request): JsonResponse
    {
        if (!$this->validatePasscode($request)) {
            return $this->unauthorized('Invalid passcode');
        }

        $request->validate([
            'texts' => 'required|array',
            'texts.*' => 'required|string',
            'target_language' => 'required|string',
            'type' => 'nullable|string',
            'model' => 'nullable|integer',
        ]);

        $modelInfo = $this->resolveModelId($request->input('model'));

        $type = 'general';
        if ($request->has('type')) {
            $type = $request->input('type');
        }

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

        $results = $this->translationService->batchTranslate(
            texts: $request->input('texts'),
            targetLanguage: $request->input('target_language'),
            type: $type,
            model: $model,
            provider: $provider
        );

        return $this->success(['results' => $results], 'Batch translation completed');
    }
    
    public function detectAndTranslate(Request $request): JsonResponse
    {
        if (!$this->validatePasscode($request)) {
            return $this->unauthorized('Invalid passcode');
        }

        $request->validate([
            'text' => 'required|string',
            'target_language' => 'required|string',
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

        $result = $this->translationService->detectAndTranslate(
            text: $request->input('text'),
            targetLanguage: $request->input('target_language'),
            model: $model,
            provider: $provider
        );

        return $this->success($result, 'Detection and translation completed successfully');
    }
    
    public function getLanguages(Request $request): JsonResponse
    {
        return $this->success(
            ['languages' => $this->translationService->getAvailableLanguages()],
            'Languages retrieved successfully'
        );
    }

    public function getTypes(Request $request): JsonResponse
    {
        return $this->success(
            ['types' => $this->translationService->getAvailableTypes()],
            'Translation types retrieved successfully'
        );
    }

    public function getLanguageTemplates(Request $request): JsonResponse
    {
        return $this->success(
            ['templates' => $this->translationService->getLanguageTemplates()],
            'Language templates retrieved successfully'
        );
    }
    
    public function getModels(Request $request): JsonResponse
    {
        $openrouterClient = new \App\Services\OpenRouterClient();
        $deepseekClient = new \App\Services\DeepSeekClient();
        $geminiClient = new \App\Services\GeminiClient();
        
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
            $provider = 'openrouter';
            if (isset($model['provider'])) {
                $provider = $model['provider'];
            }
            $providerMapping[$index] = $provider;
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

        return $this->success(['models' => $uniqueModels], 'Models retrieved successfully');
    }
    
    public function translateForLearning(Request $request): JsonResponse
    {
        if (!$this->validatePasscode($request)) {
            return $this->unauthorized('Invalid passcode');
        }
        
        $request->validate([
            'text' => 'required|string',
            'target_languages' => 'required|array',
            'target_languages.*' => 'required|string',
            'options' => 'nullable|array',
            'model' => 'nullable|integer',
            'translation_method' => 'nullable|string',
            'timeout' => 'nullable|integer',
            'skip_cache' => 'nullable|boolean',
        ]);
        
        $modelIndex = $request->input('model');
        $modelInfo = $this->resolveModelId($modelIndex);
        
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

        $params = [
            'text' => $request->input('text'),
            'target_languages' => $request->input('target_languages'),
            'options' => $request->input('options', []),
            'model' => $model,
            'provider' => $provider,
            'generate_audio' => $request->input('generate_audio', false),
            'translation_method' => $request->input('translation_method', 'ai'),
            'timeout' => $request->input('timeout', 300),
            'skip_cache' => $request->input('skip_cache', false),
        ];
        
        $taskId = $this->taskManager->createTask($params);
        $task = $this->taskManager->getTask($taskId);
        
        if ($task['status'] === TranslationTaskManager::status('completed')) {
            return $this->success([
                'task_id' => $taskId,
                'status' => 'completed',
                'cached' => true,
                'result' => $task['result'],
                'processing_time' => $task['processing_time'],
            ], 'Task already completed (cached)');
        }

        $prompt = null;
        if ($params['translation_method'] === 'ai') {
            $prompt = $this->translationService->buildMultiLanguagePrompt(
                $params['text'],
                $params['target_languages'],
                $params['options']
            );
        }

        return $this->success([
            'task_id' => $taskId,
            'status' => 'pending',
            'prompt' => $prompt,
        ], 'Task created, please poll for status');
    }
    
    public function getTaskStatus(Request $request, string $taskId): JsonResponse
    {
        $task = $this->taskManager->getTask($taskId);

        if (!$task) {
            return $this->notFound('Task not found');
        }
        
        $response = [
            'success' => true,
            'task_id' => $taskId,
            'status' => $task['status'],
            'created_at' => $task['created_at'],
        ];
        
        if ($task['status'] === TranslationTaskManager::status('processing')) {
            $response['message'] = 'Task is being processed...';
            $startedAt = $task['created_at'];
            if (isset($task['started_at'])) {
                $startedAt = $task['started_at'];
            }
            $response['elapsed_time'] = time() - $startedAt;
        } elseif ($task['status'] === TranslationTaskManager::status('completed')) {
            $response['result'] = $task['result'];
            $response['processing_time'] = $task['processing_time'];
            $cached = false;
            if (isset($task['cached'])) {
                $cached = $task['cached'];
            }
            $response['cached'] = $cached;
        } elseif ($task['status'] === TranslationTaskManager::status('failed')) {
            $response['error'] = $task['error'];
            $response['processing_time'] = $task['processing_time'];
        } elseif ($task['status'] === TranslationTaskManager::status('pending')) {
            $response['message'] = 'Task is waiting to be processed...';
            $response['queue_time'] = time() - $task['created_at'];
        }

        unset($response['success']);
        return $this->success($response, 'Task status retrieved successfully');
    }
    
    public function processNextTask(Request $request): JsonResponse
    {
        if ($this->taskManager->isLocked()) {
            $currentTask = $this->taskManager->getCurrentTask();
            $currentTaskId = null;
            if ($currentTask && isset($currentTask['task_id'])) {
                $currentTaskId = $currentTask['task_id'];
            }
            return $this->error('Another task is being processed', 400, ['current_task_id' => $currentTaskId]);
        }

        $tasks = [];
        $tasksFile = \App\Providers\PathMapper::getLaravelDatabaseDir() . '/translation_tasks/tasks.json';
        if (!file_exists($tasksFile)) {
            return $this->error('No pending tasks', 400);
        }
        $tasksData = json_decode(file_get_contents($tasksFile), true);
        if (!$tasksData) {
            $tasksData = [];
        }
        
        foreach ($tasksData as $taskId => $task) {
            if ($task['status'] === TranslationTaskManager::status('pending')) {
                $tasks[] = ['id' => $taskId, 'created_at' => $task['created_at']];
            }
        }

        if (empty($tasks)) {
            return $this->error('No pending tasks', 400);
        }

        usort($tasks, function($a, $b) {
            return $a['created_at'] <=> $b['created_at'];
        });

        $taskId = $tasks[0]['id'];
        $task = $this->taskManager->getTask($taskId);

        if (!$this->taskManager->acquireLock($taskId)) {
            return $this->error('Failed to acquire lock', 400);
        }

        $this->taskManager->updateTaskStatus($taskId, TranslationTaskManager::status('processing'));

        $options = [];
        if (isset($task['params']['options'])) {
            $options = $task['params']['options'];
        }

        $model = null;
        if (isset($task['params']['model'])) {
            $model = $task['params']['model'];
        }

        $provider = 'openrouter';
        if (isset($task['params']['provider'])) {
            $provider = $task['params']['provider'];
        }

        $generateAudio = false;
        if (isset($task['params']['generate_audio'])) {
            $generateAudio = $task['params']['generate_audio'];
        }

        $translationMethod = 'ai';
        if (isset($task['params']['translation_method'])) {
            $translationMethod = $task['params']['translation_method'];
        }

        $timeout = 300;
        if (isset($task['params']['timeout'])) {
            $timeout = $task['params']['timeout'];
        }

        $result = $this->translationService->translateForLearning(
            text: $task['params']['text'],
            targetLanguages: $task['params']['target_languages'],
            options: $options,
            model: $model,
            provider: $provider,
            generateAudio: $generateAudio,
            translationMethod: $translationMethod,
            timeout: $timeout
        );

        if ($result['success']) {
            $this->taskManager->updateTaskStatus($taskId, TranslationTaskManager::status('completed'), $result);
        } else {
            $error = 'Unknown error';
            if (isset($result['error'])) {
                $error = $result['error'];
            }
            $this->taskManager->updateTaskStatus(
                $taskId,
                TranslationTaskManager::status('failed'),
                null,
                $error
            );
        }

        $this->taskManager->releaseLock();

        return $this->success([
            'task_id' => $taskId,
            'status' => $result['success'] ? 'completed' : 'failed',
        ], 'Task processing completed');
    }
    
    public function simpleTranslateWithGoogle(Request $request): JsonResponse
    {
        if (!$this->validatePasscode($request)) {
            return $this->unauthorized('Invalid passcode');
        }

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
        ], 'Translation completed successfully');
    }
}
