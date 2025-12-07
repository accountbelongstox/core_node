<?php

namespace App\Http\Controllers;

use App\Services\EdgeTTS\EdgeTTSService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

/**
 * @deprecated This controller is deprecated. Use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1TTSController instead.
 * All TTS APIs have been moved to AppQyV1 with database-backed caching.
 * 
 * Old endpoints: /tts/*
 * New endpoints: /app_qy_v1/ai_tools/tts/*
 */
class TTSController extends Controller
{
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
        
        return response()->json([
            'success' => true,
            'results' => $results,
        ]);
    }
    
    public function checkGeneration(Request $request): JsonResponse
    {
        $request->validate([
            'audio_path' => 'required|string',
        ]);
        
        $result = $this->ttsService->checkGeneration($request->input('audio_path'));
        
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
        
        return response()->json([
            'success' => true,
            'results' => $results,
        ]);
    }
    
    public function serveAudioWithSpeed(string $language, string $type, string $speed, string $filename)
    {
        $relativePath = $language . '/' . $type . '/' . $speed . '/' . $filename;
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
    
    public function serveAudio(string $language, string $type, string $filename)
    {
        $relativePath = $language . '/' . $type . '/' . $filename;
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
        return response()->json([
            'success' => true,
            'voices' => $this->ttsService->getAvailableVoices(),
        ]);
    }
    
    public function getCacheStats(Request $request): JsonResponse
    {
        $stats = $this->ttsService->getCacheStats();

        return response()->json([
            'success' => true,
            'stats' => $stats,
        ]);
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

        return response()->json([
            'success' => true,
            'cleared_files' => $cleared,
            'message' => "Cleared {$cleared} cache file(s)",
        ]);
    }
}
