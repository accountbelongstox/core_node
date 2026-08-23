<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

class AppQyV1BingTranslationIntakeService
{
    public function apply(array $payload): array
    {
        $language = (string) $payload['language'];
        $targetLanguage = $this->optionalString($payload, 'target_language', 'zh');
        $provider = $this->optionalString($payload, 'source', 'bing');
        $workerId = $this->optionalString($payload, 'worker_id', '');
        $rawTranslations = $payload['translations'] ?? [];
        $invalidWords = $payload['invalidWords'] ?? $payload['invalid_words'] ?? [];
        $regionRedirectWords = $payload['regionRedirectWords'] ?? $payload['region_redirect_words'] ?? [];
        $normalized = $this->normalizeTranslations($rawTranslations);
        $intakeId = 'chrome-assist:submit-bing';
        $result = [];

        if ($workerId !== '') {
            $intakeId .= ':' . $workerId;
        }

        $result = AppQyV1WordTranslationWriteback::apply(
            $intakeId,
            $language,
            $targetLanguage,
            $provider,
            $normalized['entries'],
            $invalidWords,
            $regionRedirectWords
        );

        return [
            'updated' => (int) ($result['processed'] ?? 0),
            'marked_invalid' => count($invalidWords),
            'marked_region' => count($regionRedirectWords),
            'invalidated_total' => (int) ($result['invalidated'] ?? 0),
            'failed' => (int) ($result['failed'] ?? 0),
            'skipped_no_word' => $normalized['skipped_no_word'],
        ];
    }

    private function normalizeTranslations(mixed $translations): array
    {
        $entries = [];
        $skippedNoWord = 0;

        if (!is_array($translations)) {
            return ['entries' => [], 'skipped_no_word' => 0];
        }

        foreach ($translations as $item) {
            $entry = [];
            $word = '';

            if (!is_array($item)) {
                continue;
            }

            $word = isset($item['word']) && is_string($item['word']) ? $item['word'] : '';
            if ($word === '') {
                $skippedNoWord++;
                continue;
            }

            $entry['word'] = $word;
            foreach (['translation', 'phonetic', 'us_phonetic', 'uk_phonetic'] as $key) {
                if (isset($item[$key])) {
                    $entry[$key] = $item[$key];
                }
            }

            if (isset($item['image_base64']) && $item['image_base64'] !== '' && $item['image_base64'] !== []) {
                $entry['image_base64'] = $item['image_base64'];
            }
            if (isset($item['audio_base64']) && is_string($item['audio_base64'])) {
                $entry['audio_base64'] = $item['audio_base64'];
            }

            $entries[] = $entry;
        }

        return [
            'entries' => $entries,
            'skipped_no_word' => $skippedNoWord,
        ];
    }

    private function optionalString(array $payload, string $key, string $default): string
    {
        return isset($payload[$key]) && $payload[$key] !== ''
            ? (string) $payload[$key]
            : $default;
    }
}
