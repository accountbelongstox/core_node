<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools;

use App\Http\Controllers\Controller;
use App\Services\EdgeTTS\EdgeTTSService;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TTSQueueService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1UnifiedTTSQueueService;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TTSQueueModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Requests\AppQyV1TTSCheckBatchRequest;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

/**
 * AppQyV1TTSController
 *
 * IMPORTANT: Direct TTS generation endpoints (generate, batchGenerate) are DEPRECATED.
 * All TTS requests should go through the unified queue system to ensure:
 * - Sequential processing (edge-tts cannot handle concurrent requests)
 * - Proper error handling and retry logic
 * - Dynamic interval adjustment
 * - Task deduplication
 * - File transparency
 *
 * Use these endpoints instead:
 * - POST /api/app_qy_v1/ai_tools/tts/queue/batch/query (intelligent query with auto-creation)
 * - POST /api/app_qy_v1/ai_tools/tts/queue/batch/add (batch add tasks)
 * - POST /api/app_qy_v1/ai_tools/tts/queue/batch/get (batch get by task IDs)
 */
class AppQyV1TTSController extends Controller
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    private $ttsService;
    private $queueService;
    private $unifiedQueueService;

    public function __construct()
    {
        $this->ttsService = new EdgeTTSService();
        $this->queueService = new AppQyV1TTSQueueService();
        $this->unifiedQueueService = new AppQyV1UnifiedTTSQueueService();
    }
    
    /**
     * @deprecated Use POST /queue/batch/query instead for better reliability
     *
     * Generate TTS audio (DEPRECATED - redirects to queue)
     *
     * This endpoint now adds tasks to the queue instead of generating directly.
     * Use the intelligent batch query endpoint for better performance and reliability.
     */
    public function generate(Request $request): JsonResponse
    {
        $request->validate([
            'text' => 'required|string',
            'language' => 'required|string',
            'type' => 'nullable|string',
            'options' => 'nullable|array',
        ]);

        // Redirect to queue system
        $result = $this->unifiedQueueService->intelligentBatchQuery([
            [
                'content' => $request->input('text'),
                'language' => $request->input('language'),
                'type' => $request->input('type'),
            ]
        ], 90); // High priority for direct requests

        $firstResult = $result['results'][0] ?? null;

        if (!$firstResult) {
            return $this->error('Failed to process request', 500, [
                'deprecated_notice' => 'This endpoint is deprecated. Use POST /api/app_qy_v1/ai_tools/tts/queue/batch/query instead.',
            ]);
        }

        // If audio is available immediately (file transparency)
        if (isset($firstResult['audio_url'])) {
            $audioPath = null;
            if (isset($firstResult['audio_path'])) {
                $audioPath = $firstResult['audio_path'];
            }
            return $this->success([
                'cached' => true,
                'audio_url' => $firstResult['audio_url'],
                'audio_path' => $audioPath,
                'text' => $request->input('text'),
                'language' => $request->input('language'),
                'deprecated_notice' => 'This endpoint is deprecated. Use POST /api/app_qy_v1/ai_tools/tts/queue/batch/query instead.',
            ], 'Audio generated successfully');
        }

        // Task queued, return task ID for polling
        $taskId = null;
        if (isset($firstResult['task_id'])) {
            $taskId = $firstResult['task_id'];
        }
        $status = 'pending';
        if (isset($firstResult['status'])) {
            $status = $firstResult['status'];
        }
        return $this->success([
            'queued' => true,
            'task_id' => $taskId,
            'status' => $status,
            'message' => 'Task added to queue. Poll /api/app_qy_v1/ai_tools/tts/queue/task/{task_id} for status.',
            'deprecated_notice' => 'This endpoint is deprecated. Use POST /api/app_qy_v1/ai_tools/tts/queue/batch/query instead.',
        ], 'Task queued successfully');
    }
    
    /**
     * @deprecated Use POST /queue/batch/query instead for better reliability
     *
     * Batch generate TTS audio (DEPRECATED - redirects to queue)
     *
     * This endpoint now adds tasks to the queue instead of generating directly.
     * Use the intelligent batch query endpoint for better performance and reliability.
     */
    public function batchGenerate(Request $request): JsonResponse
    {
        $request->validate([
            'items' => 'required|array',
            'items.*.text' => 'required|string',
            'items.*.language' => 'required|string',
            'items.*.type' => 'nullable|string',
            'items.*.options' => 'nullable|array',
        ]);

        // Convert to queue format
        $queries = [];
        foreach ($request->input('items') as $item) {
            $queries[] = [
                'content' => $item['text'],
                'language' => $item['language'],
                'type' => $item['type'] ?? null,
            ];
        }

        // Redirect to queue system
        $result = $this->unifiedQueueService->intelligentBatchQuery($queries, 90);

        // Convert results to legacy format
        $legacyResults = [];
        foreach ($result['results'] as $item) {
            if (isset($item['audio_url'])) {
                // Audio available immediately
                $legacyResults[] = [
                    'success' => true,
                    'cached' => true,
                    'audio_url' => $item['audio_url'],
                    'audio_path' => $item['audio_path'] ?? null,
                    'text' => $item['content'] ?? $item['content_text'] ?? '',
                    'language' => $item['language'] ?? '',
                ];
            } else {
                // Task queued
                $legacyResults[] = [
                    'success' => true,
                    'queued' => true,
                    'task_id' => $item['task_id'] ?? null,
                    'status' => $item['status'] ?? 'pending',
                    'text' => $item['content'] ?? $item['content_text'] ?? '',
                    'language' => $item['language'] ?? '',
                ];
            }
        }

        return $this->success([
            'results' => $legacyResults,
            'deprecated_notice' => 'This endpoint is deprecated. Use POST /api/app_qy_v1/ai_tools/tts/queue/batch/query instead.',
        ], 'Batch generation processed successfully');
    }
    
    public function serveAudio(string $language, string $type, string $filename)
    {
        $relativePath = "{$language}/{$type}/{$filename}";
        $fullPath = $this->ttsService->getAudioPath($relativePath);
        
        if (!$fullPath) {
            return response()->json([
                'success' => false,
                'error' => 'Audio file not found',
            ], 404);
        }
        
        return response()->file($fullPath, [
            'Content-Type' => 'audio/mpeg',
            'Cache-Control' => 'public, max-age=31536000',
        ]);
    }
    
    public function serveAudioWithSpeed(string $language, string $type, string $speed, string $filename)
    {
        $relativePath = "{$language}/{$type}/{$speed}/{$filename}";
        $fullPath = $this->ttsService->getAudioPath($relativePath);
        
        if (!$fullPath) {
            return $this->notFound('Audio file not found');
        }
        
        return response()->file($fullPath, [
            'Content-Type' => 'audio/mpeg',
            'Cache-Control' => 'public, max-age=31536000',
        ]);
    }
    
    public function getLanguages(Request $request): JsonResponse
    {
        return $this->success([
            'languages' => $this->ttsService->getSupportedLanguages(),
        ], 'Languages retrieved successfully');
    }

    public function getVoices(Request $request): JsonResponse
    {
        return $this->success([
            'voices' => $this->ttsService->getAvailableVoices(),
        ], 'Voices retrieved successfully');
    }

    public function getOptions(Request $request): JsonResponse
    {
        return $this->success([
            'languages' => $this->ttsService->getSupportedLanguages(),
            'voices' => $this->ttsService->getAvailableVoices(),
            'text_types' => ['sentence', 'word', 'letter'],
            'speed' => [
                'min' => -50,
                'max' => 100,
                'step' => 10,
                'default' => 0,
                'unit' => '%',
            ],
            'volume' => [
                'min' => -50,
                'max' => 100,
                'step' => 10,
                'default' => 0,
                'unit' => '%',
            ],
            'pitch' => [
                'min' => -50,
                'max' => 50,
                'step' => 5,
                'default' => 0,
                'unit' => 'Hz',
            ],
        ], 'Options retrieved successfully');
    }

    /**
     * Add batch words to TTS queue
     * Frontend sends words without audio, backend queues for async generation
     *
     * POST /api/app_qy_v1/tts/queue_batch
     */
    public function queueBatch(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->unauthorized('Authentication required');
        }

        $validated = $request->validate([
            'words' => 'required|array|min:1|max:100',
            'words.*.word' => 'required|string|max:255',
            'words.*.language' => 'required|string|max:10',
            'words.*.priority' => 'nullable|integer|min:0|max:100',
        ]);

        $queued = [];
        $available = [];

        foreach ($validated['words'] as $item) {
            $word = $item['word'];
            $language = $item['language'];
            $priority = 0;
            if (isset($item['priority'])) {
                $priority = $item['priority'];
            }

            $result = $this->queueService->requestAudio($word, $language, $priority);

            if ($result === null) {
                $queued[] = [
                    'word' => $word,
                    'language' => $language,
                    'status' => 'queued',
                ];
            } else {
                $available[] = [
                    'word' => $word,
                    'language' => $language,
                    'status' => 'available',
                    'audio_url' => $result['audio_url'],
                ];
            }
        }

        return $this->success([
            'queued' => $queued,
            'available' => $available,
            'queued_count' => count($queued),
            'available_count' => count($available),
        ], 'Batch request processed successfully');
    }

    /**
     * Get queue statistics
     *
     * GET /api/app_qy_v1/tts/queue/stats
     */
    public function getQueueStats(Request $request): JsonResponse
    {
        $stats = $this->queueService->getQueueStats();

        return $this->success($stats, 'Queue statistics retrieved');
    }

    /**
     * Get queue status for specific word
     *
     * GET /api/app_qy_v1/tts/queue/status
     */
    public function checkQueueStatus(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'word' => 'required|string',
            'language' => 'required|string',
        ]);

        $status = $this->queueService->getQueueStatus(
            $validated['word'],
            $validated['language']
        );

        if ($status === null) {
            return $this->notFound('Word not found in queue');
        }

        return $this->success($status, 'Queue status retrieved');
    }

    /**
     * Batch check queue status for multiple words
     *
     * POST /api/app_qy_v1/ai_tools/tts/queue/check_batch
     *
     * Request format:
     * {
     *   "words": [
     *     { "word": "abandon", "language": "en" },
     *     { "word": "adversity", "language": "en" }
     *   ]
     * }
     *
     * Response includes:
     * - results: array of words found in queue with their status
     * - not_found: array of words not in queue (either already available or never requested)
     * - summary: statistics of the batch check
     */
    public function checkBatchStatus(AppQyV1TTSCheckBatchRequest $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->unauthorized('Authentication required');
        }

        $results = [];
        $notFound = [];
        $summary = [
            'total_checked' => count($request->input('words')),
            'completed' => 0,
            'processing' => 0,
            'pending' => 0,
            'failed' => 0,
            'not_found' => 0,
        ];

        foreach ($request->input('words') as $item) {
            $word = $item['word'];
            $language = $item['language'];
            $md5 = md5($word);

            $queueItem = AppQyV1TTSQueueModel::where('word_md5', $md5)
                ->where('language', $language)
                ->first();

            if ($queueItem) {
                $audioUrl = null;
                if ($queueItem->audio_path) {
                    $audioUrl = "/api/app_qy_v1/ai_tools/tts/audio/{$language}/word/{$queueItem->audio_path}";
                }

                $result = [
                    'word' => $queueItem->word,
                    'language' => $queueItem->language,
                    'status' => $queueItem->status,
                    'audio_path' => $queueItem->audio_path,
                    'audio_url' => $audioUrl,
                    'priority' => $queueItem->priority,
                ];

                if ($queueItem->retry_count > 0) {
                    $result['retry_count'] = $queueItem->retry_count;
                }

                if ($queueItem->error_message) {
                    $result['error_message'] = $queueItem->error_message;
                }

                if ($queueItem->requested_at) {
                    $result['requested_at'] = $queueItem->requested_at->toISOString();
                }

                if ($queueItem->started_at) {
                    $result['started_at'] = $queueItem->started_at->toISOString();
                }

                if ($queueItem->completed_at) {
                    $result['completed_at'] = $queueItem->completed_at->toISOString();
                }

                $results[] = $result;
                $summary[$queueItem->status]++;

            } else {
                $dictEntry = AppQyV1LangDictionaryModel::findByMd5($language, $md5);

                if ($dictEntry && isset($dictEntry->tts_files) && !empty($dictEntry->tts_files)) {
                    $hasAudio = false;
                    foreach ($dictEntry->tts_files as $ttsFile) {
                        if (isset($ttsFile['path'])) {
                            $fullPath = $this->ttsService->getAudioPath($ttsFile['path']);
                            if ($fullPath) {
                                $hasAudio = true;
                                break;
                            }
                        }
                    }

                    if ($hasAudio) {
                        $notFound[] = [
                            'word' => $word,
                            'language' => $language,
                            'reason' => 'already_available',
                        ];
                    } else {
                        $notFound[] = [
                            'word' => $word,
                            'language' => $language,
                            'reason' => 'not_in_queue',
                        ];
                    }
                } else {
                    $notFound[] = [
                        'word' => $word,
                        'language' => $language,
                        'reason' => 'not_in_queue',
                    ];
                }

                $summary['not_found']++;
            }
        }

        return $this->success([
            'results' => $results,
            'not_found' => $notFound,
            'summary' => $summary,
        ], 'Batch status check completed');
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
