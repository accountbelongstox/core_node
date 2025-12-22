<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools;

use App\Http\Controllers\Controller;
use App\Services\EdgeTTS\EdgeTTSService;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TTSQueueService;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class AppQyV1TTSController extends Controller
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    private $ttsService;
    private $queueService;

    public function __construct()
    {
        $this->ttsService = new EdgeTTSService();
        $this->queueService = new AppQyV1TTSQueueService();
    }
    
    public function generate(Request $request): JsonResponse
    {
        $request->validate([
            'text' => 'required|string',
            'language' => 'required|string',
            'type' => 'nullable|string',
            'options' => 'nullable|array',
        ]);

        $result = $this->ttsService->generateAudio(
            $request->input('text'),
            $request->input('language'),
            $request->input('type', 'sentence'),
            $request->input('options', [])
        );

        $result = $this->fixAudioUrl($result);

        return response()->json($result);
    }
    
    public function batchGenerate(Request $request): JsonResponse
    {
        $request->validate([
            'items' => 'required|array',
            'items.*.text' => 'required|string',
            'items.*.language' => 'required|string',
            'items.*.type' => 'nullable|string',
            'items.*.options' => 'nullable|array',
        ]);

        $results = [];

        foreach ($request->input('items') as $item) {
            $result = $this->ttsService->generateAudio(
                $item['text'],
                $item['language'],
                $item['type'] ?? 'sentence',
                $item['options'] ?? []
            );
            $results[] = $this->fixAudioUrl($result);
        }

        return response()->json([
            'success' => true,
            'results' => $results,
        ]);
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
    
    public function getLanguages(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'languages' => $this->ttsService->getSupportedLanguages(),
            ],
        ]);
    }

    public function getVoices(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'voices' => $this->ttsService->getAvailableVoices(),
            ],
        ]);
    }

    public function getOptions(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
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
            ],
        ]);
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
