<?php

namespace App\Http\Controllers;

use App\Services\TranslationService;
use App\Services\Translation\TranslationTaskManager;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

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
        $passcode = $request->input('passcode') ?? $request->header('X-Translation-Passcode');
        $expectedPasscode = env('TRANSLATION_PASSCODE', self::DEFAULT_PASSCODE);
        
        return $passcode === $expectedPasscode;
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
            'model' => 'nullable|string',
        ]);
        
        $result = $this->translationService->translate(
            text: $request->input('text'),
            targetLanguage: $request->input('target_language'),
            type: $request->input('type', 'general'),
            model: $request->input('model')
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
            'model' => 'nullable|string',
        ]);
        
        $results = $this->translationService->batchTranslate(
            texts: $request->input('texts'),
            targetLanguage: $request->input('target_language'),
            type: $request->input('type', 'general'),
            model: $request->input('model')
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
            'model' => 'nullable|string',
        ]);
        
        $result = $this->translationService->detectAndTranslate(
            text: $request->input('text'),
            targetLanguage: $request->input('target_language'),
            model: $request->input('model')
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
    
    public function getModels(Request $request): JsonResponse
    {
        $client = new \App\Services\OpenRouterClient();
        $freeModels = $client->getFreeModels();
        
        $modelMapping = [];
        foreach ($freeModels as $index => $model) {
            $modelMapping[$index] = $model['id'];
        }
        
        \Cache::put('translation_model_mapping', $modelMapping, 3600);
        
        return response()->json([
            'success' => true,
            'models' => $freeModels,
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
        $modelMapping = \Cache::get('translation_model_mapping', []);
        $modelId = null;
        
        if ($modelIndex !== null && isset($modelMapping[$modelIndex])) {
            $modelId = $modelMapping[$modelIndex];
        }
        
        $params = [
            'text' => $request->input('text'),
            'target_languages' => $request->input('target_languages'),
            'options' => $request->input('options', []),
            'model' => $modelId,
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
        
        $prompts = [];
        if ($params['translation_method'] === 'ai') {
            foreach ($params['target_languages'] as $lang) {
                $prompts[$lang] = $this->translationService->buildPrompt(
                    $params['text'],
                    $lang,
                    $params['options']
                );
            }
        }
        
        return response()->json([
            'success' => true,
            'task_id' => $taskId,
            'status' => 'pending',
            'message' => 'Task created, please poll for status',
            'prompts' => $prompts,
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
}
