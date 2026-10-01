<?php

namespace App\Services\AiGateway;

use Illuminate\Support\Facades\Http;

/**
 * Generic OpenAI-compatible REST client (chat + list-models) built on Laravel's
 * Http facade — no SDK, no cURL handles. Most providers in the registry speak
 * the OpenAI dialect (POST {base}/chat/completions, GET {base}/models with a
 * Bearer token), so a single client covers them; bespoke providers (gemini,
 * anthropic, cloudflare, spark) are handled directly in AiChat / AiProbe.
 */
class OpenAiCompatClient
{
    /** Gateway sampling when the caller passes none (unchanged gateway behaviour). */
    public const DEFAULT_SAMPLING = ['temperature' => 0.7, 'max_tokens' => 2048];
    public const SAMPLING_KEYS = ['temperature', 'top_p', 'max_tokens'];
    /** Bound only the connect; the timeout bounds the wait for the (non-streamed) reply. */
    private const CONNECT_TIMEOUT_SECONDS = 15;

    private string $baseUrl;
    private string $apiKey;
    private array $extraHeaders;

    public function __construct(string $baseUrl, string $apiKey, array $extraHeaders = [])
    {
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->apiKey = $apiKey;
        $this->extraHeaders = $extraHeaders;
    }

    /** @return array<string, string> */
    private function headers(): array
    {
        return array_merge([
            'Authorization' => 'Bearer ' . $this->apiKey,
            'Content-Type' => 'application/json',
        ], $this->extraHeaders);
    }

    /**
     * One chat completion. Returns the unified shape:
     *   { success: bool, text: string, error: string|null }
     *
     * $extraBody merges provider-specific fields (e.g. OpenRouter `models`).
     *
     * @param array<int, array{role:string, content:string|array}> $messages
     */
    public function chatCompletion(
        array $messages,
        string $model,
        int $timeout = 90,
        ?array $sampling = null,
        array $extraBody = []
    ): array {
        $sampling = array_intersect_key($sampling ?? self::DEFAULT_SAMPLING, array_flip(self::SAMPLING_KEYS));

        try {
            $response = Http::withHeaders($this->headers())
                ->connectTimeout(self::CONNECT_TIMEOUT_SECONDS)
                ->timeout($timeout)
                ->post($this->baseUrl . '/chat/completions', [
                    'model' => $model,
                    'messages' => $messages,
                ] + $sampling + $extraBody);

            if ($response->status() !== 200) {
                $error = 'HTTP ' . $response->status() . ': ' . mb_substr($response->body(), 0, 300);
                $failure = AiRequestFailure::classify($error);
                return ['success' => false, 'text' => '', 'error' => $error, 'error_code' => $failure['code'], 'provider_reached' => true];
            }

            $data = $response->json();
            $text = self::messageText((array) ($data['choices'][0]['message'] ?? []));

            if ($text === '') {
                return ['success' => false, 'text' => '', 'error' => 'Empty response from provider', 'error_code' => 'empty_response', 'provider_reached' => true];
            }
            return ['success' => true, 'text' => $text, 'error' => null, 'error_code' => null, 'provider_reached' => true];
        } catch (\Throwable $e) {
            $failure = AiRequestFailure::classify($e->getMessage());
            return [
                'success' => false,
                'text' => '',
                'error' => $e->getMessage(),
                'error_code' => $failure['code'],
                'provider_reached' => $failure['provider_reached'],
            ];
        }
    }

    /**
     * Message text: content (string or parts), else the reasoning fields some
     * free reasoning models fill instead (`reasoning`, `reasoning_details[].text`).
     */
    private static function messageText(array $message): string
    {
        $content = $message['content'] ?? '';

        if (is_array($content)) {
            $content = implode('', array_map(static fn ($p) => is_array($p) ? ($p['text'] ?? '') : (string) $p, $content));
        }
        if ((string) $content === '') {
            $content = (string) ($message['reasoning'] ?? '');
        }
        if ($content === '' && is_array($message['reasoning_details'] ?? null)) {
            $content = implode('', array_map(static fn ($d) => is_array($d) ? (string) ($d['text'] ?? '') : '', $message['reasoning_details']));
        }

        return (string) $content;
    }

    /**
     * List model ids. Returns [models[], error|null].
     *
     * @return array{0: string[], 1: string|null}
     */
    public function listModels(?string $modelsUrl = null, int $timeout = 20): array
    {
        $url = $modelsUrl ?: ($this->baseUrl . '/models');
        try {
            $headers = $this->headers();
            unset($headers['Content-Type']);
            $response = Http::withHeaders($headers)->timeout($timeout)->get($url);

            if (in_array($response->status(), [401, 403], true)) {
                return [[], 'HTTP ' . $response->status() . ' — key invalid or forbidden'];
            }
            if ($response->status() !== 200) {
                return [[], 'HTTP ' . $response->status()];
            }

            $body = $response->json();
            // OpenAI shape: { data: [ {id}, ... ] }; GitHub catalog: [ {id}, ... ].
            $rows = $body['data'] ?? (is_array($body) ? $body : []);
            $ids = [];
            foreach ((array) $rows as $row) {
                if (is_array($row)) {
                    $id = $row['id'] ?? ($row['name'] ?? '');
                    if ($id !== '') {
                        $ids[] = (string) $id;
                    }
                }
            }
            return [$ids, null];
        } catch (\Throwable $e) {
            return [[], $e->getMessage()];
        }
    }
}
