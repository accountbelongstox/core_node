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
     * @param array<int, array{role:string, content:string}> $messages
     */
    public function chatCompletion(array $messages, string $model, int $timeout = 90, int $maxTokens = 2048): array
    {
        try {
            $response = Http::withHeaders($this->headers())
                ->timeout($timeout)
                ->post($this->baseUrl . '/chat/completions', [
                    'model' => $model,
                    'messages' => $messages,
                    'temperature' => 0.7,
                    'max_tokens' => $maxTokens,
                ]);

            if ($response->status() !== 200) {
                $error = 'HTTP ' . $response->status() . ': ' . mb_substr($response->body(), 0, 300);
                $failure = AiRequestFailure::classify($error);
                return ['success' => false, 'text' => '', 'error' => $error, 'error_code' => $failure['code'], 'provider_reached' => true];
            }

            $data = $response->json();
            $text = $data['choices'][0]['message']['content'] ?? '';
            if (is_array($text)) {
                // Some providers return content as an array of parts.
                $text = implode('', array_map(static fn ($p) => is_array($p) ? ($p['text'] ?? '') : (string) $p, $text));
            }
            $text = (string) $text;

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
