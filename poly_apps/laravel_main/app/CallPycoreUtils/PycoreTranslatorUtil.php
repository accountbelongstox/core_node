<?php

namespace App\CallPycoreUtils;

use Illuminate\Support\Facades\Log;

class PycoreTranslatorUtil
{
    public static function translateBatch(
        array $texts,
        string $sourceLanguage,
        array $targetLanguages,
        bool $useCache = true
    ): ?array {
        $allResults = [];
        
        foreach ($texts as $textIndex => $text) {
            $textResults = [];
            
            foreach ($targetLanguages as $targetLang) {
                $response = PycoreHttpClient::callDirect(
                    '/translator/translate_single',
                    [
                        'text' => $text,
                        'src' => $sourceLanguage === 'auto' ? 'auto' : $sourceLanguage,
                        'dest' => $targetLang,
                        'use_cache' => $useCache,
                    ],
                    60
                );
                
                if (isset($response['error'])) {
                    Log::error('[PycoreTranslatorUtil] Translation failed', [
                        'text' => $text,
                        'src' => $sourceLanguage,
                        'dest' => $targetLang,
                        'error' => $response,
                    ]);
                    
                    $textResults[] = [
                        'error' => $response['error'],
                        'details' => $response,
                        'text' => $text,
                        'src' => $sourceLanguage,
                        'dest' => $targetLang,
                    ];
                    continue;
                }
                
                if (!isset($response['success']) || !$response['success']) {
                    $textResults[] = [
                        'error' => 'Translation failed',
                        'response' => $response,
                        'text' => $text,
                        'src' => $sourceLanguage,
                        'dest' => $targetLang,
                    ];
                    continue;
                }
                
                $textResults[] = $response['result'];
            }
            
            $allResults[] = $textResults;
        }
        
        if (count($texts) === 1 && count($targetLanguages) > 1) {
            return $allResults[0];
        }
        
        return $allResults;
    }
    
    public static function translateSingle(
        string $text,
        string $sourceLanguage,
        string $targetLanguage,
        bool $useCache = true
    ): ?array {
        $response = PycoreHttpClient::callDirect(
            '/translator/translate_single',
            [
                'text' => $text,
                'src' => $sourceLanguage === 'auto' ? 'auto' : $sourceLanguage,
                'dest' => $targetLanguage,
                'use_cache' => $useCache,
            ],
            60
        );
        
        if (isset($response['error'])) {
            return [
                'error' => $response['error'],
                'details' => $response,
            ];
        }
        
        if (!isset($response['success']) || !$response['success']) {
            return [
                'error' => 'Translation failed',
                'response' => $response,
            ];
        }
        
        return $response['result'];
    }
    
    public static function detectLanguage(string $text): ?array
    {
        $response = PycoreHttpClient::callDirect(
            '/translator/detect_language',
            ['text' => $text],
            10
        );
        
        if (isset($response['error'])) {
            return [
                'error' => $response['error'],
                'details' => $response,
            ];
        }
        
        if (!isset($response['success']) || !$response['success']) {
            return [
                'error' => 'Language detection failed',
                'response' => $response,
            ];
        }
        
        return $response['result'];
    }
}
