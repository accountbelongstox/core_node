<?php

namespace App\Services\AiGateway;

use Illuminate\Support\Facades\Http;

/**
 * Unified AI chat — the PHP port of pycore's pyctl.ai.ai_chat.chat_once.
 *
 * Sends one real chat turn to a single provider and returns the unified
 * contract the UI depends on:
 *   { success, provider, model, nickname, text, latency_ms, error, retry_after_s }
 *
 * Keys are loaded with the SAME indexed precedence as the probe (AiSecretLoader
 * via AiProviderRegistry). Most providers go through the OpenAI-compatible
 * client; gemini / anthropic / cloudflare speak their own dialect and are built
 * directly here on the Http facade.
 */
class AiChat
{
    private const VALID_ROLES = ['system', 'user', 'assistant'];

    /**
     * @param array<int, array<string, mixed>> $messages
     */
    public static function chatOnce(string $provider, array $messages, ?string $model = null, string $source = ''): array
    {
        $provider = strtolower(trim($provider));
        $requestedModel = trim((string) $model) !== '' ? trim((string) $model) : null;
        $out = self::blankResult($provider, $requestedModel ?? '');

        if (!AiProviderRegistry::exists($provider)) {
            $out['error'] = "Unknown provider: '{$provider}'";
            return $out;
        }

        $msgs = self::normalizeMessages($messages);
        if (empty($msgs)) {
            $out['error'] = 'No message provided';
            return $out;
        }

        if (!AiProviderRegistry::isConfigured($provider)) {
            $out['error'] = 'No API key configured';
            return $out;
        }

        $useModel = $requestedModel ?: AiProviderRegistry::defaultModel($provider);

        $rate = AiRateLimiter::checkRateLimit($provider, $useModel);
        if (!$rate['allowed']) {
            $out['error'] = $rate['message'];
            $out['retry_after_s'] = $rate['retry_after_s'];
            $out['model'] = $useModel;
            $out['nickname'] = self::nickname($provider, $useModel);
            AiUsageLog::record('text', $provider, $useModel, false, null, $source, $rate['message']);
            return $out;
        }

        $key = AiProviderRegistry::firstSecret($provider);
        $start = microtime(true);
        try {
            self::dispatch($provider, $msgs, $requestedModel, $key, $out);
        } catch (\Throwable $e) {
            $out['error'] = $e->getMessage();
        }

        if (empty($out['model'])) {
            $out['model'] = AiProviderRegistry::defaultModel($provider);
        }
        $out['nickname'] = self::nickname($provider, (string) $out['model']);
        $out['latency_ms'] = round((microtime(true) - $start) * 1000, 1);

        if (!empty($out['success'])) {
            AiRateLimiter::recordRequest($provider);
        }
        AiUsageLog::record('text', $provider, (string) $out['model'], (bool) $out['success'],
            $out['latency_ms'], $source, $out['error'] ?? null);
        return $out;
    }

    /**
     * Route one turn to the matching provider dialect, filling $out by reference.
     *
     * @param array<int, array{role:string, content:string}> $messages
     */
    private static function dispatch(string $provider, array $messages, ?string $model, string $key, array &$out): void
    {
        switch (AiProviderRegistry::client($provider)) {
            case 'gemini':
                self::chatGemini($provider, $messages, $model, $key, $out);
                return;
            case 'anthropic':
                self::chatAnthropic($provider, $messages, $model, $key, $out);
                return;
            case 'cloudflare':
                self::chatCloudflare($provider, $messages, $model, $key, $out);
                return;
            default:
                // compat + spark (the modern Spark endpoint is OpenAI-compatible).
                self::chatCompat($provider, $messages, $model, $key, $out);
        }
    }

    private static function chatCompat(string $provider, array $messages, ?string $model, string $key, array &$out): void
    {
        $useModel = $model ?: AiProviderRegistry::defaultModel($provider);
        $out['model'] = $useModel;
        $client = new OpenAiCompatClient(
            AiProviderRegistry::baseUrl($provider),
            $key,
            AiProviderRegistry::extraHeaders($provider)
        );
        $res = $client->chatCompletion($messages, $useModel);
        $out['text'] = $res['text'];
        $out['success'] = $res['success'];
        if (!$res['success']) {
            $out['error'] = $res['error'] ?: 'Empty response from provider';
        }
    }

    private static function chatGemini(string $provider, array $messages, ?string $model, string $key, array &$out): void
    {
        $useModel = $model ?: AiProviderRegistry::defaultModel($provider);
        $out['model'] = $useModel;
        $base = AiProviderRegistry::baseUrl($provider);
        $url = $base . '/models/' . rawurlencode($useModel) . ':generateContent';
        $response = Http::withHeaders(['Content-Type' => 'application/json'])
            ->timeout(90)
            ->post($url . '?key=' . urlencode($key), [
                'contents' => [[
                    'parts' => [['text' => self::messagesToPrompt($messages)]],
                ]],
            ]);

        if ($response->status() !== 200) {
            $out['error'] = 'HTTP ' . $response->status() . ': ' . mb_substr($response->body(), 0, 300);
            return;
        }
        $data = $response->json();
        $text = '';
        foreach ($data['candidates'][0]['content']['parts'] ?? [] as $part) {
            $text .= $part['text'] ?? '';
        }
        $out['text'] = $text;
        $out['success'] = $text !== '';
        if ($text === '') {
            $out['error'] = 'Empty response from provider';
        }
    }

    private static function chatAnthropic(string $provider, array $messages, ?string $model, string $key, array &$out): void
    {
        $useModel = $model ?: AiProviderRegistry::defaultModel($provider);
        $out['model'] = $useModel;

        $system = [];
        $turns = [];
        foreach ($messages as $m) {
            if ($m['role'] === 'system') {
                $system[] = $m['content'];
            } elseif (in_array($m['role'], ['user', 'assistant'], true)) {
                $turns[] = ['role' => $m['role'], 'content' => $m['content']];
            }
        }
        if (empty($turns)) {
            $turns = [['role' => 'user', 'content' => self::messagesToPrompt($messages)]];
        }
        $body = ['model' => $useModel, 'max_tokens' => 1024, 'messages' => $turns];
        if (!empty($system)) {
            $body['system'] = implode("\n", $system);
        }

        $response = Http::withHeaders([
            'x-api-key' => $key,
            'anthropic-version' => '2023-06-01',
            'Content-Type' => 'application/json',
        ])->timeout(90)->post(AiProviderRegistry::baseUrl($provider) . '/messages', $body);

        if ($response->status() !== 200) {
            $out['error'] = 'HTTP ' . $response->status() . ': ' . mb_substr($response->body(), 0, 300);
            return;
        }
        $data = $response->json();
        $text = '';
        foreach ($data['content'] ?? [] as $block) {
            if (($block['type'] ?? '') === 'text') {
                $text .= $block['text'] ?? '';
            }
        }
        $out['text'] = $text;
        $out['success'] = $text !== '';
        if ($text === '') {
            $out['error'] = 'Empty response from provider';
        }
    }

    private static function chatCloudflare(string $provider, array $messages, ?string $model, string $key, array &$out): void
    {
        $useModel = $model ?: AiProviderRegistry::defaultModel($provider);
        $out['model'] = $useModel;
        $accountId = AiProviderRegistry::extraSecret($provider);
        if ($accountId === '') {
            $out['error'] = 'CLOUDFLARE_ACCOUNT_ID not configured';
            return;
        }
        $url = AiProviderRegistry::baseUrl($provider) . '/accounts/' . $accountId . '/ai/run/' . $useModel;
        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . $key,
            'Content-Type' => 'application/json',
        ])->timeout(90)->post($url, ['messages' => $messages]);

        if ($response->status() !== 200) {
            $out['error'] = 'HTTP ' . $response->status() . ': ' . mb_substr($response->body(), 0, 300);
            return;
        }
        $data = $response->json();
        $text = (string) ($data['result']['response'] ?? '');
        $out['text'] = $text;
        $out['success'] = $text !== '';
        if ($text === '') {
            $out['error'] = 'Empty response from provider';
        }
    }

    // --- helpers ----------------------------------------------------------- //

    public static function nickname(string $provider, string $model): string
    {
        $model = trim($model);
        return $model !== '' ? "{$provider}/{$model}" : $provider;
    }

    /**
     * @param array<int, array<string, mixed>> $messages
     * @return array<int, array{role:string, content:string}>
     */
    private static function normalizeMessages(array $messages): array
    {
        $out = [];
        foreach ($messages as $m) {
            if (!is_array($m) || !array_key_exists('content', $m) || $m['content'] === null) {
                continue;
            }
            $role = strtolower(trim((string) ($m['role'] ?? 'user')));
            if (!in_array($role, self::VALID_ROLES, true)) {
                $role = 'user';
            }
            $out[] = ['role' => $role, 'content' => (string) $m['content']];
        }
        return $out;
    }

    /** Flatten a message list into a transcript prompt (for Gemini). */
    private static function messagesToPrompt(array $messages): string
    {
        $parts = [];
        foreach ($messages as $m) {
            if ($m['role'] === 'system') {
                $parts[] = $m['content'];
            } elseif ($m['role'] === 'assistant') {
                $parts[] = 'Assistant: ' . $m['content'];
            } else {
                $parts[] = 'User: ' . $m['content'];
            }
        }
        return trim(implode("\n", $parts));
    }

    private static function blankResult(string $provider, string $model): array
    {
        return [
            'success' => false,
            'provider' => $provider,
            'model' => $model,
            'nickname' => self::nickname($provider, $model),
            'text' => '',
            'latency_ms' => null,
            'error' => null,
            'retry_after_s' => null,
        ];
    }
}
