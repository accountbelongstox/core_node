<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Services\MediaIngestService;
use App\Support\AudioOrchestrationContract;

/**
 * Tolerant parser of one sentence_phrase_extraction answer
 * (docs_fix/DESIGN_PHRASE_PIPELINE.md §4). Shared by the Laravel gateway path
 * and the pycore phrase_extract result writeback.
 *
 * Output: ['ok' => bool, 'error' => ?string, 'salvaged' => bool, 'items' => [n => [['content_id', 'text', 'meaning'], ...]]].
 * `salvaged` = the answer was cut off (token limit) and only its complete items were read.
 * `items` holds only the sentence numbers the answer listed; a listed sentence
 * whose phrases all failed validation maps to an empty list.
 */
final class AppQyV1PhraseResponseParser
{
    public const ERROR_EMPTY = 'empty_answer';
    public const ERROR_NO_JSON = 'no_json';
    public const ERROR_NO_ITEMS = 'no_items';

    private const MIN_WORDS = 2;

    /**
     * @param array<int, array{n:int, content_id:string, text:string}> $sentences the batch, keyed or listed
     */
    public function parse(string $raw, array $sentences): array
    {
        $byNumber = [];
        $decoded = null;
        $items = [];
        $out = [];
        $salvaged = false;

        foreach ($sentences as $sentence) {
            $byNumber[(int) $sentence['n']] = (string) $sentence['text'];
        }
        if (trim($raw) === '') {
            return ['ok' => false, 'error' => self::ERROR_EMPTY, 'items' => [], 'salvaged' => false];
        }
        $decoded = $this->decode($raw);
        if ($decoded === null) {
            $decoded = $this->salvage($raw);
            $salvaged = $decoded !== null;
        }
        if ($decoded === null) {
            return ['ok' => false, 'error' => self::ERROR_NO_JSON, 'items' => [], 'salvaged' => false];
        }
        $items = $this->itemList($decoded);
        if ($items === null) {
            return ['ok' => false, 'error' => self::ERROR_NO_ITEMS, 'items' => [], 'salvaged' => false];
        }

        foreach (array_values($items) as $position => $item) {
            if (!is_array($item)) {
                continue;
            }
            $n = isset($item['n']) && is_numeric($item['n']) ? (int) $item['n'] : $position + 1;
            if (!isset($byNumber[$n])) {
                continue;
            }
            $phrases = $this->validPhrases($byNumber[$n], is_array($item['phrases'] ?? null) ? $item['phrases'] : []);
            $out[$n] = array_merge($out[$n] ?? [], $phrases);
            $out[$n] = $this->capPerSentence($out[$n]);
        }

        return ['ok' => true, 'error' => null, 'items' => $out, 'salvaged' => $salvaged];
    }

    /** JSON object/array from a raw answer that may carry code fences or prose around it. */
    private function decode(string $raw): ?array
    {
        $text = trim($raw);
        $candidates = [$text];
        $matches = [];

        if (preg_match('/```(?:json)?\s*(.*?)```/is', $text, $matches) === 1) {
            $candidates[] = trim($matches[1]);
        }
        foreach (['{' => '}', '[' => ']'] as $open => $close) {
            $start = strpos($text, $open);
            $end = strrpos($text, $close);
            if ($start !== false && $end !== false && $end > $start) {
                $candidates[] = substr($text, $start, $end - $start + 1);
            }
        }
        foreach ($candidates as $candidate) {
            $value = json_decode($candidate, true);
            if (is_array($value)) {
                return $value;
            }
        }

        return null;
    }

    /**
     * Complete item objects (those carrying a `phrases` list) of an answer that
     * is not valid JSON as a whole, typically cut off by the token limit.
     * Returns {"items": [...]} or null when no complete item was found.
     */
    private function salvage(string $raw): ?array
    {
        $length = strlen($raw);
        $stack = [];
        $items = [];
        $inString = false;
        $escaped = false;

        for ($i = 0; $i < $length; $i++) {
            $char = $raw[$i];
            if ($inString) {
                if ($escaped) {
                    $escaped = false;
                } elseif ($char === "\\") {
                    $escaped = true;
                } elseif ($char === '"') {
                    $inString = false;
                }
                continue;
            }
            if ($char === '"') {
                $inString = true;
            } elseif ($char === '{') {
                $stack[] = $i;
            } elseif ($char === '}' && $stack !== []) {
                $start = array_pop($stack);
                $object = json_decode(substr($raw, $start, $i - $start + 1), true);
                if (is_array($object) && isset($object['phrases']) && is_array($object['phrases'])) {
                    $items[] = $object;
                }
            }
        }

        return $items === [] ? null : ['items' => $items];
    }

    /** The item list of a decoded answer: {"items":[...]}, a bare list, or one item object. */
    private function itemList(array $decoded): ?array
    {
        if (isset($decoded['items']) && is_array($decoded['items'])) {
            return $decoded['items'];
        }
        if (array_is_list($decoded)) {
            return $decoded;
        }
        if (isset($decoded['phrases']) && is_array($decoded['phrases'])) {
            return [$decoded];
        }

        return null;
    }

    /** @return array<int, array{content_id:string, text:string, meaning:?string}> */
    private function validPhrases(string $sentence, array $phrases): array
    {
        $maxWords = (int) AudioOrchestrationContract::phrasePipeline('extraction.phrase_max_words');
        $maxChars = (int) AudioOrchestrationContract::phrasePipeline('extraction.phrase_max_chars');
        $haystack = ' ' . self::normalize($sentence) . ' ';
        $seen = [];
        $valid = [];

        foreach ($phrases as $phrase) {
            $text = is_array($phrase) ? ($phrase['text'] ?? null) : $phrase;
            $meaning = is_array($phrase) ? ($phrase['meaning'] ?? null) : null;
            if (!is_string($text)) {
                continue;
            }
            $text = $this->cleanText($text);
            $normalized = self::normalize($text);
            $words = $text === '' ? [] : preg_split('/\s+/u', $text);
            if ($normalized === ''
                || count($words) < self::MIN_WORDS
                || count(explode(' ', $normalized)) < self::MIN_WORDS
                || count($words) > $maxWords
                || mb_strlen($text) > $maxChars
                || !str_contains($haystack, ' ' . $normalized . ' ')) {
                continue;
            }
            $contentId = MediaIngestService::computeContentId($text);
            if (isset($seen[$contentId])) {
                continue;
            }
            $seen[$contentId] = true;
            $meaning = is_string($meaning) ? trim($meaning) : '';
            $valid[] = [
                'content_id' => $contentId,
                'text' => $text,
                'meaning' => $meaning !== '' ? $meaning : null,
            ];
        }

        return $valid;
    }

    /** Dedupe by content_id and keep at most max_phrases_per_sentence. */
    private function capPerSentence(array $phrases): array
    {
        $max = (int) AudioOrchestrationContract::phrasePipeline('extraction.max_phrases_per_sentence');
        $unique = [];

        foreach ($phrases as $phrase) {
            $unique[$phrase['content_id']] ??= $phrase;
        }

        return array_slice(array_values($unique), 0, max(0, $max));
    }

    /** Phrase as spoken: collapsed whitespace, no surrounding punctuation or quotes. */
    private function cleanText(string $text): string
    {
        $collapsed = preg_replace('/\s+/u', ' ', $text);
        $trimmed = preg_replace('/^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/u', '', is_string($collapsed) ? $collapsed : $text);

        return is_string($trimmed) ? $trimmed : trim($text);
    }

    /** Same normalization as the content id (case/punctuation-insensitive compare). */
    public static function normalize(string $text): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', mb_strtolower(MediaIngestService::stripPunctuation($text))));
    }
}
