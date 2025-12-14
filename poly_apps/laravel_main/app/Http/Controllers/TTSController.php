<?php

namespace App\Http\Controllers;

use App\Services\EdgeTTS\EdgeTTSService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use App\Traits\ApiResponse;

/**
 * @deprecated This controller is deprecated. Use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1TTSController instead.
 * All TTS APIs have been moved to AppQyV1 with database-backed caching.
 *
 * Old endpoints: /tts/*
 * New endpoints: /app_qy_v1/ai_tools/tts/*
 *
 * Uses standardized ApiResponse trait
 * NO ?? or || allowed - use explicit if statements
 */
class TTSController extends Controller
{
    use ApiResponse;

    private $ttsService;

    public function __construct()
    {
        $this->ttsService = new EdgeTTSService();
    }
    
    public function generate(Request $request): JsonResponse
    {
        $request->validate([
            'text' => 'required|string',
            'language' => 'required|string',
            'type' => 'nullable|string|in:sentence,word,letter',
            'options' => 'nullable|array',
        ]);
        
        $result = $this->ttsService->generateAudio(
            text: $request->input('text'),
            langCode: $request->input('language'),
            textType: $request->input('type', 'sentence'),
            options: $request->input('options', [])
        );

        // Service returns pre-formatted response
        return response()->json($result);
    }
    
    public function batchGenerate(Request $request): JsonResponse
    {
        $request->validate([
            'items' => 'required|array',
            'items.*.text' => 'required|string',
            'items.*.language' => 'required|string',
            'items.*.type' => 'nullable|string|in:sentence,word,letter',
            'items.*.options' => 'nullable|array',
        ]);

        $results = $this->ttsService->batchGenerate($request->input('items'));

        return $this->success(['results' => $results], 'Batch generation completed');
    }
    
    public function checkGeneration(Request $request): JsonResponse
    {
        $request->validate([
            'audio_path' => 'required|string',
        ]);
        
        $result = $this->ttsService->checkGeneration($request->input('audio_path'));

        // Service returns pre-formatted response
        return response()->json($result);
    }
    
    public function batchCheck(Request $request): JsonResponse
    {
        $request->validate([
            'audio_paths' => 'required|array',
            'audio_paths.*' => 'required|string',
        ]);

        $results = [];
        foreach ($request->input('audio_paths') as $path) {
            $results[$path] = $this->ttsService->checkGeneration($path);
        }

        return $this->success(['results' => $results], 'Batch check completed');
    }
    
    public function serveAudioWithSpeed(string $language, string $type, string $speed, string $filename)
    {
        $relativePath = $language . '/' . $type . '/' . $speed . '/' . $filename;
        $fullPath = $this->ttsService->getAudioPath($relativePath);

        if (!$fullPath) {
            abort(404, 'Audio file not found');
        }

        if (!file_exists($fullPath)) {
            abort(404, 'Audio file not found');
        }

        $content = file_get_contents($fullPath);

        return response($content, 200, [
            'Content-Type' => 'audio/mpeg',
            'Cache-Control' => 'public, max-age=31536000',
            'Content-Length' => strlen($content),
        ]);
    }
    
    public function serveAudio(string $language, string $type, string $filename)
    {
        $relativePath = $language . '/' . $type . '/' . $filename;
        $fullPath = $this->ttsService->getAudioPath($relativePath);

        if (!$fullPath) {
            abort(404, 'Audio file not found');
        }

        if (!file_exists($fullPath)) {
            abort(404, 'Audio file not found');
        }

        $content = file_get_contents($fullPath);

        return response($content, 200, [
            'Content-Type' => 'audio/mpeg',
            'Cache-Control' => 'public, max-age=31536000',
            'Content-Length' => strlen($content),
        ]);
    }
    
    public function serveSentenceByMd5(string $language, string $md5)
    {
        $filename = $md5 . '.mp3';
        $relativePath = $language . '/sentence/' . $filename;
        $fullPath = $this->ttsService->getAudioPath($relativePath);
        
        if (!$fullPath || !file_exists($fullPath)) {
            abort(404, 'Audio file not found');
        }
        
        $content = file_get_contents($fullPath);
        
        return response($content, 200, [
            'Content-Type' => 'audio/mpeg',
            'Cache-Control' => 'public, max-age=31536000',
            'Content-Length' => strlen($content),
        ]);
    }
    
    public function getVoices(Request $request): JsonResponse
    {
        return $this->success(
            ['voices' => $this->ttsService->getAvailableVoices()],
            'Available voices retrieved successfully'
        );
    }

    public function getCacheStats(Request $request): JsonResponse
    {
        $stats = $this->ttsService->getCacheStats();

        return $this->success(['stats' => $stats], 'Cache stats retrieved successfully');
    }

    public function clearCache(Request $request): JsonResponse
    {
        $request->validate([
            'language' => 'nullable|string',
            'type' => 'nullable|string|in:sentence,word,letter',
        ]);

        $cleared = $this->ttsService->clearCache(
            $request->input('language'),
            $request->input('type')
        );

        return $this->success(
            ['cleared_files' => $cleared],
            "Cleared {$cleared} cache file(s)"
        );
    }
}
