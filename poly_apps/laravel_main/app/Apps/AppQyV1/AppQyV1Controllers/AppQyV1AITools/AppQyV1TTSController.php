<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools;

use App\Http\Controllers\Controller;
use App\Services\EdgeTTS\EdgeTTSService;
use App\Traits\ApiResponse;
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
}
