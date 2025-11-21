<?php

namespace App\Http\Controllers;

use App\Services\EdgeTTS\EdgeTTSService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

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
    
    public function serveAudio(string $language, string $type, string $filename): Response
    {
        $relativePath = $language . '/' . $type . '/' . $filename;
        $fullPath = $this->ttsService->getAudioPath($relativePath);
        
        if (!$fullPath || !file_exists($fullPath)) {
            abort(404, 'Audio file not found');
        }
        
        return response()->file($fullPath, [
            'Content-Type' => 'audio/mpeg',
            'Cache-Control' => 'public, max-age=31536000',
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
        $cacheManager = new \App\Services\EdgeTTS\TTSCacheManager(
            \App\Providers\PathMapper::getLaravelDataDir() . '/tts_data/json_db'
        );
        
        $stats = $cacheManager->getAllStats();
        
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
        
        $cacheManager = new \App\Services\EdgeTTS\TTSCacheManager(
            \App\Providers\PathMapper::getLaravelDataDir() . '/tts_data/json_db'
        );
        
        $cleared = $cacheManager->clearCache(
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
