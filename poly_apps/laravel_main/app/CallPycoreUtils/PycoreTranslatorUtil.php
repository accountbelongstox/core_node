<?php

namespace App\CallPycoreUtils;

/**
 * Google translator facade over pycore's translator routes. Success payloads
 * are pycore's own; failures are PycoreRpcException::payload() arrays.
 */
class PycoreTranslatorUtil
{
    private const AUTO_LANGUAGE = 'auto';

    public static function translateSingle(
        string $text,
        string $sourceLanguage,
        string $targetLanguage,
        bool $useCache = true
    ): array {
        try {
            return PycoreHttpClient::call('translatorTranslateSingle', [
                'text' => $text,
                'src' => $sourceLanguage !== '' ? $sourceLanguage : self::AUTO_LANGUAGE,
                'dest' => $targetLanguage,
                'use_cache' => $useCache,
            ]);
        } catch (PycoreRpcException $e) {
            return $e->payload();
        }
    }

    /**
     * One translator/translate_batch call per target language.
     *
     * @return array<int, array<int, array>> [text index][target index] => pycore result item or failure payload
     */
    public static function translateBatch(
        array $texts,
        string $sourceLanguage,
        array $targetLanguages,
        bool $useCache = true
    ): array {
        $texts = array_values($texts);
        $targetLanguages = array_values($targetLanguages);
        $results = array_fill(0, count($texts), []);
        $response = null;
        $items = [];

        foreach ($targetLanguages as $targetIndex => $targetLanguage) {
            try {
                $response = PycoreHttpClient::call('translatorTranslateBatch', [
                    'texts' => $texts,
                    'src' => $sourceLanguage !== '' ? $sourceLanguage : self::AUTO_LANGUAGE,
                    'dest' => $targetLanguage,
                    'use_cache' => $useCache,
                ]);
            } catch (PycoreRpcException $e) {
                $response = $e->payload();
            }
            $items = is_array($response['results'] ?? null) ? array_values($response['results']) : [];
            foreach ($texts as $textIndex => $text) {
                $results[$textIndex][$targetIndex] = is_array($items[$textIndex] ?? null)
                    ? $items[$textIndex]
                    : [
                        'error' => (string) ($response['error'] ?? __('pycore.invalid_response', ['route' => 'translator/translate_batch', 'status' => 200])),
                        'original_text' => $text,
                        'src_lang' => $sourceLanguage,
                        'dest_lang' => $targetLanguage,
                    ];
            }
        }

        return $results;
    }

    public static function detectLanguage(string $text): array
    {
        try {
            return PycoreHttpClient::call('translatorDetectLanguage', ['text' => $text]);
        } catch (PycoreRpcException $e) {
            return $e->payload();
        }
    }
}
