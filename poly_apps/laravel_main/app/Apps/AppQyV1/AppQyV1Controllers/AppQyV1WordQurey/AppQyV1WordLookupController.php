<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordQurey;

use App\Http\Controllers\Controller;
use App\Services\EdgeTTS\EdgeTTSService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Traits\ApiResponse;

class AppQyV1WordLookupController extends Controller
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
    
    public function lookup(Request $request)
    {
        $request->validate([
            'word' => 'required|string',
            'language' => 'nullable|string',
            'generate_audio' => 'nullable|boolean',
        ]);
        
        $word = trim($request->input('word'));
        $language = $request->input('language', 'english');
        $generateAudio = $request->input('generate_audio', true);
        
        $connection = 'AppQyV1';
        $tableName = "app_qy_v1_words_{$language}";
        
        $wordData = DB::connection($connection)
            ->table($tableName)
            ->where('word', $word)
            ->first();
        
        if (!$wordData) {
            return response()->json([
                'success' => false,
                'message' => 'Word not found',
                'word' => $word,
                'language' => $language
            ], 404);
        }
        
        $result = [
            'success' => true,
            'word' => $word,
            'language' => $language,
            'data' => []
        ];
        
        if ($language === 'english') {
            $result['data'] = [
                'word_id' => $wordData->word_id,
                'us_phonetic' => $wordData->us_phonetic,
                'uk_phonetic' => $wordData->uk_phonetic,
                'translation' => $wordData->translation ? json_decode($wordData->translation, true) : null,
                'sample_images' => $wordData->sample_images ? json_decode($wordData->sample_images, true) : [],
                'ai_reviewed' => (bool)$wordData->ai_reviewed,
            ];
        } else {
            $result['data'] = [
                'word_id' => $wordData->word_id,
                'pronunciation' => $wordData->pronunciation,
                'meaning_en' => $wordData->meaning_en,
                'meaning_zh' => $wordData->meaning_zh,
                'ai_reviewed' => (bool)$wordData->ai_reviewed,
            ];
        }
        
        if ($generateAudio) {
            $langCode = $this->getLanguageCode($language);
            
            if ($langCode) {
                $audioResult = $this->ttsService->generateAudio($word, $langCode, 'word');
                $audioResult = $this->fixAudioUrl($audioResult);

                if ($audioResult['success']) {
                    $result['data']['audio'] = [
                        'url' => $audioResult['audio_url'],
                        'path' => $audioResult['audio_path'],
                        'cached' => $audioResult['cached'],
                    ];
                    
                    if (!$wordData->tts_generated) {
                        DB::connection($connection)
                            ->table($tableName)
                            ->where('word', $word)
                            ->update(['tts_generated' => 1]);
                    }
                } else {
                    $result['data']['audio'] = [
                        'error' => $audioResult['error'] ?? 'Audio generation failed'
                    ];
                }
            }
        }
        
        return response()->json($result);
    }
    
    public function batchLookup(Request $request)
    {
        $request->validate([
            'words' => 'required|array',
            'words.*' => 'required|string',
            'language' => 'nullable|string',
            'generate_audio' => 'nullable|boolean',
        ]);
        
        $words = $request->input('words');
        $language = $request->input('language', 'english');
        $generateAudio = $request->input('generate_audio', false);
        
        $results = [];
        
        foreach ($words as $word) {
            $lookupRequest = new Request([
                'word' => $word,
                'language' => $language,
                'generate_audio' => $generateAudio,
            ]);
            
            $response = $this->lookup($lookupRequest);
            $results[] = json_decode($response->getContent(), true);
        }
        
        return response()->json([
            'success' => true,
            'count' => count($results),
            'results' => $results
        ]);
    }
    
    private function getLanguageCode(string $language): ?string
    {
        $map = [
            'english' => 'en',
            'lao' => 'lo',
            'japanese' => 'ja',
            'vietnamese' => 'vi',
        ];
        
        return $map[$language] ?? null;
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
