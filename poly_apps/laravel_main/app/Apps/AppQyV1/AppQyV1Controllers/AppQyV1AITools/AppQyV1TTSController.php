<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools;

use App\Http\Controllers\Controller;
use App\Services\EdgeTTS\EdgeTTSService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class AppQyV1TTSController extends Controller
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
            'type' => 'nullable|string',
            'options' => 'nullable|array',
        ]);
        
        $result = $this->ttsService->generateAudio(
            $request->input('text'),
            $request->input('language'),
            $request->input('type', 'sentence'),
            $request->input('options', [])
        );
        
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
            $results[] = $this->ttsService->generateAudio(
                $item['text'],
                $item['language'],
                $item['type'] ?? 'sentence',
                $item['options'] ?? []
            );
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
    
    public function getVoices(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'voices' => $this->ttsService->getAvailableVoices(),
        ]);
    }
}
