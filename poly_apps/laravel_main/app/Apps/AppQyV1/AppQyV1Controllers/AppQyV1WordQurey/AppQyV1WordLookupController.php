<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordQurey;

use App\Http\Controllers\Controller;
use App\Services\EdgeTTS\EdgeTTSService;
use Illuminate\Http\Request;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TtsUrl;
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
        
        $langCode = $this->getLanguageCode($language);
        if (!$langCode) {
            $langCode = $language;
        }

        $wordData = AppQyV1LangDictionaryModel::findByMd5($langCode, md5($word));

        if (!$wordData) {
            return $this->notFound('Word not found', [
                'word' => $word,
                'language' => $language
            ]);
        }

        $result = [
            'success' => true,
            'word' => $word,
            'language' => $language,
            'data' => []
        ];

        // Unified schema (tts_cache_{lang}); translations/image_files are
        // json-cast on the model so they are already arrays.
        $result['data'] = [
            'content' => $wordData->content,
            'us_phonetic' => $wordData->us_phonetic,
            'uk_phonetic' => $wordData->uk_phonetic,
            'phonetic' => $wordData->phonetic,
            'translations' => $wordData->translations,
            'image_files' => $wordData->image_files,
            'has_translation' => (bool) $wordData->has_translation,
        ];
        
        if ($generateAudio) {
            $langCode = $this->getLanguageCode($language);
            
            if ($langCode) {
                $audioResult = $this->ttsService->generateAudio($word, $langCode, 'word');

                if ($audioResult['success']) {
                    $result['data']['audio'] = [
                        'url' => AppQyV1TtsUrl::forPath($audioResult['audio_path']),
                        'path' => $audioResult['audio_path'],
                        'cached' => $audioResult['cached'],
                    ];
                    
                    if (!$wordData->has_audio) {
                        $wordData->has_audio = true;
                        $wordData->save();
                    }
                } else {
                    $result['data']['audio'] = [
                        'error' => $audioResult['error'] ?? 'Audio generation failed'
                    ];
                }
            }
        }
        
        return $this->success($result, 'Word lookup completed successfully');
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
        
        return $this->success([
            'count' => count($results),
            'results' => $results
        ], 'Batch lookup completed successfully');
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
}
