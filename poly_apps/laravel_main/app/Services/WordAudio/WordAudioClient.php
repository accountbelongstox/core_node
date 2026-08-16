<?php

namespace App\Services\WordAudio;

use App\Utils\SecretStore;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Real-pronunciation word audio client (PHP twin of pycore's word_audio_client).
 *
 * Tries REAL dictionary / native-speaker pronunciation sources, in priority
 * order, before the caller falls back to TTS synthesis:
 *
 *   1. Free Dictionary API (https://api.dictionaryapi.dev) — free, keyless,
 *      official public API. English only.
 *   2. Forvo — OFFICIAL PAID API ONLY (https://apifree.forvo.com), gated
 *      behind a FORVO_API_KEY secret. Multi-language. Silently skipped when
 *      no key is configured — there is intentionally NO scraping/anti-bot
 *      fallback for Forvo's free web tier.
 *
 * Cambridge Dictionary (HTML-page fetch + parse) is NOT implemented here —
 * that technique is reserved for pycore only; this PHP client stays a clean
 * REST-API-only chain. YouGlish is excluded everywhere (no downloadable
 * audio by design, ToS forbids it).
 *
 * NEVER throws — every failure path returns null and logs. Persistent queue
 * processors may use this client; interactive word-media resolve never waits
 * for this external chain.
 */
class WordAudioClient
{
    private const FREE_DICTIONARY_API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
    private const FORVO_API_BASE = 'https://apifree.forvo.com';

    /** Per-HTTP-call timeout (metadata lookup or binary download) for one source. */
    private const SOURCE_TIMEOUT = 2.5;

    /** Total wall-clock budget across the whole chain, so the endpoint stays responsive. */
    private const TOTAL_BUDGET_SECONDS = 6.0;

    public const PROVIDER_FREE_DICTIONARY = 'free_dictionary_api';
    public const PROVIDER_FORVO = 'forvo';

    /**
     * Circuit breaker for a bad/exhausted Forvo key: latched on the first
     * 401/403 so the rest of THIS request's chain (a batch of words can call
     * findPronunciation() repeatedly) never burns further Forvo calls.
     * Laravel requests are short-lived, so a simple static property is
     * sufficient and prevents repeated failed provider probes.
     */
    private static ?string $forvoDisabledReason = null;

    private float $deadline;

    /**
     * Find a real pronunciation for a word, trying each source in priority
     * order and stopping at the first success or once the total time budget
     * is exhausted.
     *
     * @return array{provider:string,mime:string,binary:string,meta:array}|null
     */
    public function findPronunciation(string $word, string $langCode): ?array
    {
        $word = trim($word);
        $langCode = strtolower(trim($langCode));
        if ($word === '') {
            return null;
        }

        $this->deadline = microtime(true) + self::TOTAL_BUDGET_SECONDS;

        if ($langCode === 'en') {
            $result = $this->fetchFromFreeDictionary($word);
            if ($result !== null) {
                return $result;
            }
        }

        if ($this->budgetExhausted()) {
            return null;
        }

        $result = $this->fetchFromForvo($word, $langCode);
        if ($result !== null) {
            return $result;
        }

        return null;
    }

    /**
     * Free Dictionary API: GET /api/v2/entries/en/{word} -> first non-empty
     * phonetics[].audio URL (across all returned entries) -> download bytes.
     */
    private function fetchFromFreeDictionary(string $word): ?array
    {
        if ($this->budgetExhausted()) {
            return null;
        }

        $url = self::FREE_DICTIONARY_API_BASE . rawurlencode($word);

        try {
            $response = Http::timeout(self::SOURCE_TIMEOUT)->acceptJson()->get($url);
        } catch (\Throwable $e) {
            Log::warning('[WordAudio] Free Dictionary API lookup failed', ['word' => $word, 'error' => $e->getMessage()]);
            return null;
        }

        if (!$response->successful()) {
            // 404 = no entry for this word; not an error worth a warning.
            return null;
        }

        $entries = $response->json();
        if (!is_array($entries)) {
            return null;
        }

        foreach ($entries as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $phonetics = $entry['phonetics'] ?? null;
            if (!is_array($phonetics)) {
                continue;
            }
            foreach ($phonetics as $phonetic) {
                if (!is_array($phonetic)) {
                    continue;
                }
                $audioUrl = trim((string) ($phonetic['audio'] ?? ''));
                if ($audioUrl === '') {
                    continue;
                }
                if ($this->budgetExhausted()) {
                    return null;
                }
                $binary = $this->downloadBytes($audioUrl);
                if ($binary === null) {
                    continue;
                }
                return [
                    'provider' => self::PROVIDER_FREE_DICTIONARY,
                    'mime' => $this->mimeFromBytes($binary, 'audio/mpeg'),
                    'binary' => $binary,
                    'meta' => [
                        'audio_url' => $audioUrl,
                        'text' => (string) ($phonetic['text'] ?? ''),
                        'word' => (string) ($entry['word'] ?? $word),
                    ],
                ];
            }
        }

        return null;
    }

    /**
     * Forvo official paid API: GET /key/{key}/format/json/action/word-pronunciations/word/{word}/language/{lang}
     * -> items[] sorted by rate desc -> first item with a usable pathmp3
     * -> download bytes. Skipped cleanly when FORVO_API_KEY is not configured.
     */
    private function fetchFromForvo(string $word, string $langCode): ?array
    {
        if (self::$forvoDisabledReason !== null) {
            return null;
        }

        $apiKey = trim(SecretStore::getIndexed('FORVO_API_KEY'));
        if ($apiKey === '') {
            return null;
        }

        if ($this->budgetExhausted()) {
            return null;
        }

        $url = sprintf(
            '%s/key/%s/format/json/action/word-pronunciations/word/%s/language/%s',
            self::FORVO_API_BASE,
            rawurlencode($apiKey),
            rawurlencode($word),
            rawurlencode($langCode)
        );

        try {
            $response = Http::timeout(self::SOURCE_TIMEOUT)->acceptJson()->get($url);
        } catch (\Throwable $e) {
            Log::warning('[WordAudio] Forvo lookup failed', ['word' => $word, 'error' => $e->getMessage()]);
            return null;
        }

        if ($response->status() === 401 || $response->status() === 403) {
            $detail = (string) ($response->json('message') ?? $response->status());
            self::$forvoDisabledReason = $detail;
            Log::warning('[WordAudio] Forvo key rejected, disabling Forvo for the rest of this request', [
                'status' => $response->status(),
                'detail' => $detail,
            ]);
            return null;
        }

        if (!$response->successful()) {
            Log::info('[WordAudio] Forvo lookup non-200', ['word' => $word, 'status' => $response->status()]);
            return null;
        }

        $data = $response->json();
        $items = is_array($data) ? ($data['items'] ?? null) : null;
        if (!is_array($items) || empty($items)) {
            return null;
        }

        usort($items, fn ($a, $b) => (int) (is_array($b) ? ($b['rate'] ?? 0) : 0) <=> (int) (is_array($a) ? ($a['rate'] ?? 0) : 0));

        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            // Only pathmp3 is usable: the shared storage layer
            // (AppQyV1DictionaryTTSCoordinator::storeWordAudioBytes) hard-validates
            // MP3 magic bytes and always persists under a .mp3 path, so an
            // ogg-only item would just be silently rejected downstream.
            $audioUrl = trim((string) ($item['pathmp3'] ?? ''));
            if ($audioUrl === '') {
                continue;
            }
            if ($this->budgetExhausted()) {
                return null;
            }
            $binary = $this->downloadBytes($audioUrl);
            if ($binary === null) {
                continue;
            }
            return [
                'provider' => self::PROVIDER_FORVO,
                'mime' => $this->mimeFromBytes($binary, 'audio/mpeg'),
                'binary' => $binary,
                'meta' => [
                    'audio_url' => $audioUrl,
                    'username' => (string) ($item['username'] ?? ''),
                    'country' => (string) ($item['country'] ?? ''),
                    'rate' => (int) ($item['rate'] ?? 0),
                ],
            ];
        }

        return null;
    }

    /**
     * Download audio bytes. Returns null on any failure / empty body.
     */
    private function downloadBytes(string $url): ?string
    {
        try {
            $response = Http::timeout(self::SOURCE_TIMEOUT)->get($url);
        } catch (\Throwable $e) {
            Log::warning('[WordAudio] Audio download failed', ['url' => $url, 'error' => $e->getMessage()]);
            return null;
        }

        if (!$response->successful()) {
            return null;
        }

        $body = $response->body();
        if ($body === '' || strlen($body) < 100) {
            return null;
        }

        return $body;
    }

    /** True once the total chain time budget has elapsed. */
    private function budgetExhausted(): bool
    {
        return microtime(true) >= $this->deadline;
    }

    /**
     * Resolve a MIME type from audio magic bytes. Falls back to $default.
     */
    private function mimeFromBytes(string $bytes, string $default): string
    {
        if (str_starts_with($bytes, 'ID3')) {
            return 'audio/mpeg';
        }
        if (strlen($bytes) >= 2 && ord($bytes[0]) === 0xFF && (ord($bytes[1]) & 0xE0) === 0xE0) {
            return 'audio/mpeg';
        }
        if (str_starts_with($bytes, 'OggS')) {
            return 'audio/ogg';
        }
        return $default;
    }
}
