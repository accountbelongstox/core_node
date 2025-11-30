<?php

namespace App\Http\Controllers;

use App\Services\TranslationService;
use App\Services\Translation\TranslationTaskManager;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

/**
 * @deprecated This controller is deprecated. Use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1TranslationController instead.
 * All translation APIs have been moved to AppQyV1 with database-backed caching.
 * 
 * Old endpoints: /translation/*
 * New endpoints: /app_qy_v1/ai_tools/translation/*
 */
class TranslationController extends Controller
{
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
            return [
                'model' => $mappingData['mapping'][$modelIndex],
                'provider' => $mappingData['provider_mapping'][$modelIndex] ?? 'openrouter',
            ];
        }
        
        return null;
    }
    
    public function translate(Request $request): JsonResponse
    {
        if (!$this->validatePasscode($request)) {
            return response()->json([
                'success' => false,
                'error' => 'Invalid passcode',
            ], 401);
        }
        
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
        if (!$this->validatePasscode($request)) {
            return response()->json([
                'success' => false,
                'error' => 'Invalid passcode',
            ], 401);
        }
        
        $request->validate([
            'texts' => 'required|array',
            'texts.*' => 'required|string',
            'target_language' => 'required|string',
            'type' => 'nullable|string',
            'model' => 'nullable|integer',
        ]);
        
        $modelInfo = $this->resolveModelId($request->input('model'));
        
        $results = $this->translationService->batchTranslate(
            texts: $request->input('texts'),
            targetLanguage: $request->input('target_language'),
            type: $request->input('type', 'general'),
            model: $modelInfo['model'] ?? null,
            provider: $modelInfo['provider'] ?? 'openrouter'
        );
        
        return response()->json([
            'success' => true,
            'results' => $results,
        ]);
    }
    
    public function detectAndTranslate(Request $request): JsonResponse
    {
        if (!$this->validatePasscode($request)) {
            return response()->json([
                'success' => false,
                'error' => 'Invalid passcode',
            ], 401);
        }
        
        $request->validate([
            'text' => 'required|string',
            'target_language' => 'required|string',
            'model' => 'nullable|integer',
        ]);
        
        $modelInfo = $this->resolveModelId($request->input('model'));
        
        $result = $this->translationService->detectAndTranslate(
            text: $request->input('text'),
            targetLanguage: $request->input('target_language'),
            model: $modelInfo['model'] ?? null,
            provider: $modelInfo['provider'] ?? 'openrouter'
        );
        
        return response()->json($result);
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
    
    public function getLanguageTemplates(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'templates' => $this->translationService->getLanguageTemplates(),
        ]);
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
    
    public function translateForLearning(Request $request): JsonResponse
    {
        if (!$this->validatePasscode($request)) {
            return response()->json([
                'success' => false,
                'error' => 'Invalid passcode',
            ], 401);
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
        
        $params = [
            'text' => $request->input('text'),
            'target_languages' => $request->input('target_languages'),
            'options' => $request->input('options', []),
            'model' => $modelInfo['model'] ?? null,
            'provider' => $modelInfo['provider'] ?? 'openrouter',
            'generate_audio' => $request->input('generate_audio', false),
            'translation_method' => $request->input('translation_method', 'ai'),
            'timeout' => $request->input('timeout', 300),
            'skip_cache' => $request->input('skip_cache', false),
        ];
        
        $taskId = $this->taskManager->createTask($params);
        $task = $this->taskManager->getTask($taskId);
        
        if ($task['status'] === TranslationTaskManager::STATUS_COMPLETED) {
            return response()->json([
                'success' => true,
                'task_id' => $taskId,
                'status' => 'completed',
                'cached' => true,
                'result' => $task['result'],
                'processing_time' => $task['processing_time'],
            ]);
        }
        
        $prompt = null;
        if ($params['translation_method'] === 'ai') {
            $prompt = $this->translationService->buildMultiLanguagePrompt(
                $params['text'],
                $params['target_languages'],
                $params['options']
            );
        }
        
        return response()->json([
            'success' => true,
            'task_id' => $taskId,
            'status' => 'pending',
            'message' => 'Task created, please poll for status',
            'prompt' => $prompt,
        ]);
    }
    
    public function getTaskStatus(Request $request, string $taskId): JsonResponse
    {
        $task = $this->taskManager->getTask($taskId);
        
        if (!$task) {
            return response()->json([
                'success' => false,
                'error' => 'Task not found',
            ], 404);
        }
        
        $response = [
            'success' => true,
            'task_id' => $taskId,
            'status' => $task['status'],
            'created_at' => $task['created_at'],
        ];
        
        if ($task['status'] === TranslationTaskManager::STATUS_PROCESSING) {
            $response['message'] = 'Task is being processed...';
            $response['elapsed_time'] = time() - ($task['started_at'] ?? $task['created_at']);
        } elseif ($task['status'] === TranslationTaskManager::STATUS_COMPLETED) {
            $response['result'] = $task['result'];
            $response['processing_time'] = $task['processing_time'];
            $response['cached'] = $task['cached'] ?? false;
        } elseif ($task['status'] === TranslationTaskManager::STATUS_FAILED) {
            $response['error'] = $task['error'];
            $response['processing_time'] = $task['processing_time'];
        } elseif ($task['status'] === TranslationTaskManager::STATUS_PENDING) {
            $response['message'] = 'Task is waiting to be processed...';
            $response['queue_time'] = time() - $task['created_at'];
        }
        
        return response()->json($response);
    }
    
    public function processNextTask(Request $request): JsonResponse
    {
        if ($this->taskManager->isLocked()) {
            $currentTask = $this->taskManager->getCurrentTask();
            return response()->json([
                'success' => false,
                'message' => 'Another task is being processed',
                'current_task_id' => $currentTask['task_id'] ?? null,
            ]);
        }
        
        $tasks = [];
        $tasksFile = \App\Providers\PathMapper::getLaravelDatabaseDir() . '/translation_tasks/tasks.json';
        if (!file_exists($tasksFile)) {
            return response()->json([
                'success' => false,
                'message' => 'No pending tasks',
            ]);
        }
        $tasksData = json_decode(file_get_contents($tasksFile), true) ?? [];
        
        foreach ($tasksData as $taskId => $task) {
            if ($task['status'] === TranslationTaskManager::STATUS_PENDING) {
                $tasks[] = ['id' => $taskId, 'created_at' => $task['created_at']];
            }
        }
        
        if (empty($tasks)) {
            return response()->json([
                'success' => false,
                'message' => 'No pending tasks',
            ]);
        }
        
        usort($tasks, function($a, $b) {
            return $a['created_at'] <=> $b['created_at'];
        });
        
        $taskId = $tasks[0]['id'];
        $task = $this->taskManager->getTask($taskId);
        
        if (!$this->taskManager->acquireLock($taskId)) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to acquire lock',
            ]);
        }
        
        try {
            $this->taskManager->updateTaskStatus($taskId, TranslationTaskManager::STATUS_PROCESSING);
            
            $result = $this->translationService->translateForLearning(
                text: $task['params']['text'],
                targetLanguages: $task['params']['target_languages'],
                options: $task['params']['options'] ?? [],
                model: $task['params']['model'] ?? null,
                provider: $task['params']['provider'] ?? 'openrouter',
                generateAudio: $task['params']['generate_audio'] ?? false,
                translationMethod: $task['params']['translation_method'] ?? 'ai',
                timeout: $task['params']['timeout'] ?? 300
            );
            
            if ($result['success']) {
                $this->taskManager->updateTaskStatus($taskId, TranslationTaskManager::STATUS_COMPLETED, $result);
            } else {
                $this->taskManager->updateTaskStatus(
                    $taskId,
                    TranslationTaskManager::STATUS_FAILED,
                    null,
                    $result['error'] ?? 'Unknown error'
                );
            }
            
            $this->taskManager->releaseLock();
            
            return response()->json([
                'success' => true,
                'task_id' => $taskId,
                'status' => $result['success'] ? 'completed' : 'failed',
            ]);
            
        } catch (\Exception $e) {
            $this->taskManager->updateTaskStatus($taskId, TranslationTaskManager::STATUS_FAILED, null, $e->getMessage());
            $this->taskManager->releaseLock();
            
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }
    
    public function simpleTranslateWithGoogle(Request $request): JsonResponse
    {
        if (!$this->validatePasscode($request)) {
            return response()->json([
                'success' => false,
                'error' => 'Invalid passcode',
            ], 401);
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
}
