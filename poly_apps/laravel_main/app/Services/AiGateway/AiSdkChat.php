<?php

namespace App\Services\AiGateway;

use App\Ai\Agents\GatewayChatAgent;
use App\Providers\PathMapper;
use App\Services\AI\AiConfiguration;
use App\Utils\SecretStore;
use Illuminate\Support\Str;
use Laravel\Ai\Contracts\ConversationStore;
use Laravel\Ai\Files\Image as AiImageFile;
use Laravel\Ai\Models\Conversation;
use Laravel\Ai\Models\ConversationMessage;

/**
 * AiSdkChat — the official Laravel AI SDK chat surface of the AI gateway.
 *
 * Where the custom gateway (AiGateway/AiChat) dispatches single turns across
 * ~25 providers with tier/key rotation, this service is the SDK-native
 * counterpart for the chat interface:
 *
 *   - multi-turn conversations persisted by the SDK itself
 *     (RemembersConversations → agent_conversations tables);
 *   - image attachments (vision) through the SDK's Files\Image contract —
 *     uploaded bytes are persisted to the attachment dir and attached as
 *     LocalImage, so the messages table stores a tiny path reference instead
 *     of raw base64;
 *   - provider failover via the SDK's own `provider: [...]` array dispatch;
 *   - the gateway-local prompt cache (AiPromptCache) plus Anthropic's
 *     provider-side cache_control (see GatewayChatAgent).
 *
 * Provider credentials always come from AiConfiguration (SecretStore) and are
 * refreshed into the runtime config before every dispatch, so keys set via
 * the UI apply immediately under long-lived Octane workers.
 */
class AiSdkChat
{
    private const MAX_IMAGES = 4;
    private const MAX_IMAGE_BYTES = 8388608; // 8 MB decoded per image
    private const MESSAGE_MAX = 8000;
    private const TIMEOUT_S = 120;
    private const CONVERSATION_LIMIT_MAX = 200;

    /**
     * Drivers whose chat endpoint accepts image attachments (per the official
     * AI SDK provider-support table: openai-compatible explicitly supports
     * image attachments; deepseek/cohere are text-only here).
     */
    private const IMAGE_INPUT_DRIVERS = [
        'anthropic', 'openai', 'openai-compatible', 'gemini', 'openrouter',
        'azure', 'bedrock', 'groq', 'xai', 'mistral', 'ollama',
    ];

    /** Allowed attachment mime ↔ stored extension. */
    private const IMAGE_MIME_EXT = [
        'image/png' => 'png',
        'image/jpeg' => 'jpg',
        'image/jpg' => 'jpg',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ];

    /**
     * Official AI SDK feature matrix (feature → supporting drivers), from the
     * provider-support table of the AI SDK documentation. Used to advertise
     * Laravel's AI capabilities regardless of key configuration.
     */
    private const FEATURE_DRIVERS = [
        'text' => ['openai', 'openai-compatible', 'anthropic', 'gemini', 'azure', 'bedrock', 'groq', 'xai', 'deepseek', 'mistral', 'ollama', 'openrouter'],
        'images' => ['openai', 'gemini', 'xai', 'azure', 'bedrock', 'openrouter'],
        'audio' => ['openai', 'eleven', 'gemini'],
        'transcription' => ['openai', 'eleven', 'mistral', 'gemini'],
        'embeddings' => ['openai', 'openai-compatible', 'gemini', 'azure', 'bedrock', 'cohere', 'mistral', 'jina', 'voyageai', 'ollama', 'openrouter'],
        'reranking' => ['cohere', 'jina', 'voyageai'],
        'files' => ['openai', 'anthropic', 'gemini', 'azure'],
    ];

    private const FEATURE_LABELS = [
        'text' => 'Text / Chat',
        'images' => 'Image generation',
        'audio' => 'Audio (TTS)',
        'transcription' => 'Transcription (STT)',
        'embeddings' => 'Embeddings',
        'reranking' => 'Reranking',
        'files' => 'Files',
    ];

    // --- capability matrix ------------------------------------------------- //

    /**
     * Laravel AI SDK capabilities: every configured provider with its driver,
     * key state, default models and feature set — plus the full feature →
     * driver matrix. Listed whether or not a key is configured, so the UI can
     * show what Laravel can do and what only needs a key.
     */
    public static function capabilities(): array
    {
        AiConfiguration::refreshRuntime();

        $providers = [];
        foreach (AiConfiguration::providers() as $name => $cfg) {
            $driver = (string) ($cfg['driver'] ?? $name);
            $key = (string) ($cfg['key'] ?? '');
            $capabilities = array_values((array) ($cfg['capabilities'] ?? []));

            $models = [];
            foreach ((array) ($cfg['models'] ?? []) as $kind => $def) {
                $default = is_array($def) ? (string) ($def['default'] ?? '') : (string) $def;
                if ($default !== '') {
                    $models[$kind] = $default;
                }
            }

            $providers[] = [
                'name' => $name,
                'driver' => $driver,
                'configured' => $key !== '',
                'key_masked' => $key !== '' ? SecretStore::maskForDisplay($key) : null,
                'models' => $models,
                'capabilities' => $capabilities,
                'accepts_images' => in_array('text', $capabilities, true) && self::acceptsImages($driver),
                'chat_enabled' => $key !== '' && in_array('text', $capabilities, true),
            ];
        }

        $features = [];
        foreach (self::FEATURE_DRIVERS as $feature => $drivers) {
            $features[] = [
                'key' => $feature,
                'label' => self::FEATURE_LABELS[$feature] ?? $feature,
                'drivers' => $drivers,
            ];
        }

        return [
            'success' => true,
            'sdk' => 'laravel/ai',
            'defaults' => [
                'text' => (string) config('ai.default', ''),
                'images' => (string) config('ai.default_for_images', ''),
                'audio' => (string) config('ai.default_for_audio', ''),
                'transcription' => (string) config('ai.default_for_transcription', ''),
                'embeddings' => (string) config('ai.default_for_embeddings', ''),
                'reranking' => (string) config('ai.default_for_reranking', ''),
            ],
            'features' => $features,
            'providers' => $providers,
        ];
    }

    // --- chat -------------------------------------------------------------- //

    /**
     * Send one chat turn through the official SDK agent.
     *
     * @param array{
     *   conversation_id?: ?string, provider?: ?string, model?: ?string,
     *   message?: string, images?: array<int, array<string, mixed>>,
     *   cache?: bool, source?: string
     * } $params
     *
     * Returns the unified contract:
     *   { success, conversation_id, conversation_created, provider, model,
     *     text, usage, cached, latency_ms, error }
     */
    public static function send(array $params): array
    {
        $started = microtime(true);

        $message = trim((string) ($params['message'] ?? ''));
        $provider = strtolower(trim((string) ($params['provider'] ?? 'auto')));
        $model = trim((string) ($params['model'] ?? ''));
        $model = $model !== '' ? $model : null;
        $conversationId = trim((string) ($params['conversation_id'] ?? ''));
        $conversationId = $conversationId !== '' ? $conversationId : null;
        $useCache = (bool) ($params['cache'] ?? true);
        $source = trim((string) ($params['source'] ?? 'ai-chat'));
        $images = (array) ($params['images'] ?? []);

        if (mb_strlen($message) > self::MESSAGE_MAX) {
            return self::failure('message too long (max ' . self::MESSAGE_MAX . ' chars)', $started);
        }
        if ($message === '' && empty($images)) {
            return self::failure('A message or at least one image is required', $started);
        }

        // Live keys under Octane: SecretStore → runtime config, fresh instances.
        AiConfiguration::refreshRuntime();
        $all = AiConfiguration::providers();

        // Resolve the dispatch: a pinned provider, or 'auto' → the SDK's native
        // failover over every configured text provider (default first).
        if ($provider === '' || $provider === 'auto') {
            $chain = [];
            foreach ($all as $name => $cfg) {
                if (!in_array('text', (array) ($cfg['capabilities'] ?? []), true)) {
                    continue;
                }
                if ((string) ($cfg['key'] ?? '') === '') {
                    continue;
                }
                if (!empty($images) && !self::acceptsImages((string) ($cfg['driver'] ?? ''))) {
                    continue;
                }
                $chain[] = $name;
            }
            $default = (string) config('ai.default', '');
            if ($default !== '' && in_array($default, $chain, true)) {
                $chain = array_values(array_unique(array_merge([$default], $chain)));
            }
            if (empty($chain)) {
                return self::failure(
                    !empty($images)
                        ? 'No vision-capable AI provider is configured (set a key in AI Providers)'
                        : 'No AI provider is configured (set a key in AI Providers)',
                    $started
                );
            }
            $dispatch = $chain;
            $requestedProvider = 'auto';
        } else {
            if (!array_key_exists($provider, $all)) {
                return self::failure("Unknown SDK provider: '{$provider}'", $started);
            }
            $cfg = $all[$provider];
            if (!in_array('text', (array) ($cfg['capabilities'] ?? []), true)) {
                return self::failure("Provider '{$provider}' has no text/chat capability", $started);
            }
            if ((string) ($cfg['key'] ?? '') === '') {
                return self::failure("No API key configured for '{$provider}'", $started);
            }
            if (!empty($images) && !self::acceptsImages((string) ($cfg['driver'] ?? ''))) {
                return self::failure("Provider '{$provider}' does not accept image attachments", $started);
            }
            $dispatch = $provider;
            $requestedProvider = $provider;
        }

        // Persist attachments → LocalImage (keeps raw base64 out of the DB).
        [$attachments, $imageHashes, $attachmentError] = self::persistImages($images);
        if ($attachmentError !== null) {
            return self::failure($attachmentError, $started);
        }

        // The prompt sent to the model when only images are attached.
        $promptText = $message !== '' ? $message : 'Describe the attached image(s).';

        // Conversation: continue an existing one or open a new row up-front, so
        // the SDK's RememberConversation middleware persists every turn even
        // without an authenticated participant.
        /** @var ConversationStore $store */
        $store = resolve(ConversationStore::class);
        $created = false;
        if ($conversationId === null) {
            $conversationId = $store->storeConversation(null, null, Str::limit($promptText, 50, preserveWords: true));
            $created = true;
        } elseif (!Conversation::query()->where('id', $conversationId)->exists()) {
            return self::failure('Conversation not found', $started);
        }

        // Gateway-local prompt cache: a hit answers without spending quota, but
        // the turn is still written into the conversation so history stays whole.
        $cacheKey = null;
        if ($useCache) {
            // A first turn has no history, so identical opening prompts share one
            // key across conversations; continuing turns key on the conversation.
            $conversationKey = $created ? '@first-turn' : $conversationId;
            $cacheKey = AiPromptCache::makeKey($requestedProvider, $model, $conversationKey, $promptText, $imageHashes);
            $hit = AiPromptCache::lookup($cacheKey, $requestedProvider);
            if ($hit !== null) {
                $latency = round((microtime(true) - $started) * 1000, 1);
                self::persistCachedTurn($conversationId, $promptText, $attachments, $hit);
                return [
                    'success' => true,
                    'conversation_id' => $conversationId,
                    'conversation_created' => $created,
                    'provider' => (string) ($hit['resolved_provider'] ?? $requestedProvider),
                    'model' => (string) ($hit['model'] ?? ''),
                    'text' => (string) $hit['text'],
                    'usage' => (array) ($hit['usage'] ?? []),
                    'cached' => true,
                    'latency_ms' => $latency,
                    'error' => null,
                ];
            }
        }

        $kind = !empty($attachments) ? 'vision' : 'text';

        try {
            $response = (new GatewayChatAgent)
                ->continue($conversationId)
                ->prompt($promptText, $attachments, $dispatch, $model, self::TIMEOUT_S);
        } catch (\Throwable $e) {
            $latency = round((microtime(true) - $started) * 1000, 1);
            AiUsageLog::record($kind, $requestedProvider, $model ?? '', false, $latency, $source, $e->getMessage());
            $out = self::failure($e->getMessage(), $started);
            $out['conversation_id'] = $conversationId;
            $out['conversation_created'] = $created;
            return $out;
        }

        $latency = round((microtime(true) - $started) * 1000, 1);
        $resolvedProvider = (string) ($response->meta->provider ?? $requestedProvider);
        $resolvedModel = (string) ($response->meta->model ?? ($model ?? ''));
        $text = (string) $response->text;
        $usage = [
            'prompt_tokens' => $response->usage->promptTokens,
            'completion_tokens' => $response->usage->completionTokens,
            'cache_read_tokens' => $response->usage->cacheReadInputTokens,
            'cache_write_tokens' => $response->usage->cacheWriteInputTokens,
        ];

        AiUsageLog::record($kind, $resolvedProvider, $resolvedModel, true, $latency, $source);

        if ($cacheKey !== null && $text !== '') {
            AiPromptCache::store($cacheKey, $requestedProvider, $resolvedProvider, $resolvedModel, $promptText, $text, $usage);
        }

        return [
            'success' => true,
            'conversation_id' => $response->conversationId ?? $conversationId,
            'conversation_created' => $created,
            'provider' => $resolvedProvider,
            'model' => $resolvedModel,
            'text' => $text,
            'usage' => $usage,
            'cached' => false,
            'latency_ms' => $latency,
            'error' => null,
        ];
    }

    // --- conversations ----------------------------------------------------- //

    /** Newest-first conversation list for the chat sidebar. */
    public static function conversations(int $limit = 50): array
    {
        $limit = max(1, min($limit, self::CONVERSATION_LIMIT_MAX));

        $rows = Conversation::query()
            ->withCount('messages')
            ->orderByDesc('updated_at')
            ->limit($limit)
            ->get();

        return [
            'success' => true,
            'conversations' => $rows->map(static fn (Conversation $c): array => [
                'id' => (string) $c->getKey(),
                'title' => (string) $c->getAttribute('title'),
                'message_count' => (int) $c->getAttribute('messages_count'),
                'created_at' => optional($c->getAttribute('created_at'))->toIso8601String(),
                'updated_at' => optional($c->getAttribute('updated_at'))->toIso8601String(),
            ])->all(),
        ];
    }

    /** Full message list of one conversation (user/assistant turns only). */
    public static function messages(string $conversationId): array
    {
        if (!Conversation::query()->where('id', $conversationId)->exists()) {
            return ['success' => false, 'error' => 'Conversation not found', 'messages' => []];
        }

        $rows = ConversationMessage::query()
            ->where('conversation_id', $conversationId)
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        $messages = [];
        foreach ($rows as $row) {
            $role = (string) $row->getAttribute('role');
            if (!in_array($role, ['user', 'assistant'], true)) {
                continue;
            }
            $meta = (array) ($row->getAttribute('meta') ?? []);
            $messages[] = [
                'id' => (string) $row->getKey(),
                'role' => $role,
                'content' => (string) $row->getAttribute('content'),
                'attachments' => self::normalizeAttachments((array) ($row->getAttribute('attachments') ?? [])),
                'usage' => self::normalizeUsage((array) ($row->getAttribute('usage') ?? [])),
                'meta' => [
                    'provider' => $meta['provider'] ?? null,
                    'model' => $meta['model'] ?? null,
                    'cached' => (bool) ($meta['cached'] ?? false),
                ],
                'created_at' => optional($row->getAttribute('created_at'))->toIso8601String(),
            ];
        }

        return ['success' => true, 'conversation_id' => $conversationId, 'messages' => $messages];
    }

    /** Delete one conversation, its messages and its stored attachment files. */
    public static function deleteConversation(string $conversationId): array
    {
        $conversation = Conversation::query()->where('id', $conversationId)->first();
        if ($conversation === null) {
            return ['success' => false, 'error' => 'Conversation not found'];
        }

        $rows = ConversationMessage::query()->where('conversation_id', $conversationId)->get(['attachments']);
        foreach ($rows as $row) {
            foreach ((array) ($row->getAttribute('attachments') ?? []) as $attachment) {
                if (($attachment['type'] ?? '') === 'local-image') {
                    self::deleteAttachmentFile((string) ($attachment['path'] ?? ''));
                }
            }
        }

        ConversationMessage::query()->where('conversation_id', $conversationId)->delete();
        $conversation->delete();

        return ['success' => true];
    }

    // --- attachments ------------------------------------------------------- //

    /** Absolute path of the chat attachment dir (via PathMapper, never raw). */
    public static function attachmentDir(): string
    {
        return PathMapper::getLaravelDataDir('ai_chat_attachments');
    }

    /**
     * Read one stored attachment by file name. Returns [bytes, mime] or null
     * when the name is invalid or the file is gone.
     *
     * @return array{0: string, 1: string}|null
     */
    public static function attachment(string $name): ?array
    {
        if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/', $name)) {
            return null;
        }
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        $mime = array_search($ext, self::IMAGE_MIME_EXT, true);
        if ($mime === false) {
            return null;
        }
        $path = self::attachmentDir() . DIRECTORY_SEPARATOR . $name;
        if (!is_file($path)) {
            return null;
        }
        $bytes = @file_get_contents($path);
        if (!is_string($bytes) || $bytes === '') {
            return null;
        }
        return [$bytes, $mime];
    }

    /**
     * Persist uploaded images to the attachment dir and build SDK LocalImage
     * attachments. Returns [attachments, sha256Hashes, errorOrNull].
     *
     * @param array<int, mixed> $images [{ name?, mime, data(base64) }]
     * @return array{0: array<int, \Laravel\Ai\Files\LocalImage>, 1: string[], 2: ?string}
     */
    private static function persistImages(array $images): array
    {
        if (count($images) > self::MAX_IMAGES) {
            return [[], [], 'Too many images (max ' . self::MAX_IMAGES . ')'];
        }

        $attachments = [];
        $hashes = [];
        $dir = self::attachmentDir();

        foreach ($images as $image) {
            if (!is_array($image)) {
                return [[], [], 'Invalid image payload'];
            }
            $mime = strtolower(trim((string) ($image['mime'] ?? '')));
            $ext = self::IMAGE_MIME_EXT[$mime] ?? null;
            if ($ext === null) {
                return [[], [], "Unsupported image type: '{$mime}' (png / jpeg / webp / gif only)"];
            }
            $bytes = base64_decode((string) ($image['data'] ?? ''), true);
            if ($bytes === false || $bytes === '') {
                return [[], [], 'Invalid image data (base64 decode failed)'];
            }
            if (strlen($bytes) > self::MAX_IMAGE_BYTES) {
                return [[], [], 'Image too large (max ' . (int) (self::MAX_IMAGE_BYTES / 1048576) . ' MB each)'];
            }

            if (!is_dir($dir)) {
                @mkdir($dir, 0775, true);
            }
            $fileName = (string) Str::uuid7() . '.' . $ext;
            if (@file_put_contents($dir . DIRECTORY_SEPARATOR . $fileName, $bytes) === false) {
                return [[], [], 'Failed to store an uploaded image'];
            }

            $file = AiImageFile::fromPath($dir . DIRECTORY_SEPARATOR . $fileName, $mime);
            $name = trim((string) ($image['name'] ?? ''));
            if ($name !== '') {
                $file->as(mb_substr($name, 0, 120));
            }
            $attachments[] = $file;
            $hashes[] = hash('sha256', $bytes);
        }

        return [$attachments, $hashes, null];
    }

    // --- internals --------------------------------------------------------- //

    private static function acceptsImages(string $driver): bool
    {
        return in_array(strtolower($driver), self::IMAGE_INPUT_DRIVERS, true);
    }

    /**
     * Write a cache-hit turn into the conversation (user + assistant rows in
     * the exact RememberConversation shape) so history stays complete even
     * though no provider call happened.
     *
     * @param array<int, \Laravel\Ai\Files\LocalImage> $attachments
     */
    private static function persistCachedTurn(string $conversationId, string $promptText, array $attachments, array $hit): void
    {
        $attachmentRows = array_map(static fn ($file): array => $file->toArray(), $attachments);
        $now = now();

        ConversationMessage::query()->create([
            'id' => (string) Str::uuid7(),
            'conversation_id' => $conversationId,
            'participant_type' => null,
            'participant_id' => null,
            'agent' => GatewayChatAgent::class,
            'role' => 'user',
            'content' => $promptText,
            'attachments' => $attachmentRows,
            'tool_calls' => [],
            'tool_results' => [],
            'usage' => [],
            'meta' => [],
            'approval_state' => null,
        ]);

        ConversationMessage::query()->create([
            'id' => (string) Str::uuid7(),
            'conversation_id' => $conversationId,
            'participant_type' => null,
            'participant_id' => null,
            'agent' => GatewayChatAgent::class,
            'role' => 'assistant',
            'content' => (string) $hit['text'],
            'attachments' => [],
            'tool_calls' => [],
            'tool_results' => [],
            'usage' => (array) ($hit['usage'] ?? []),
            'meta' => [
                'provider' => $hit['resolved_provider'] ?? null,
                'model' => $hit['model'] ?? null,
                'cached' => true,
            ],
            'approval_state' => null,
        ]);

        Conversation::query()->where('id', $conversationId)->update(['updated_at' => $now]);
    }

    /**
     * Map stored attachment rows to the UI shape. local-image files under the
     * attachment dir expose a relative URL the API layer can absolutize.
     *
     * @param array<int, mixed> $attachments
     */
    private static function normalizeAttachments(array $attachments): array
    {
        $dir = self::attachmentDir() . DIRECTORY_SEPARATOR;
        $out = [];

        foreach ($attachments as $attachment) {
            if (!is_array($attachment)) {
                continue;
            }
            $type = (string) ($attachment['type'] ?? '');
            if (!str_contains($type, 'image')) {
                $out[] = ['type' => $type !== '' ? $type : 'file'];
                continue;
            }

            $row = [
                'type' => 'image',
                'name' => $attachment['name'] ?? null,
                'mime' => $attachment['mime'] ?? null,
                'file' => null,
                'url' => null,
            ];

            if ($type === 'local-image') {
                $path = (string) ($attachment['path'] ?? '');
                if ($path !== '' && str_starts_with($path, $dir)) {
                    $row['file'] = basename($path);
                    $row['url'] = '/api/local/ai/chat/attachments/' . rawurlencode(basename($path));
                }
            } elseif ($type === 'remote-image') {
                $row['url'] = $attachment['url'] ?? null;
            }

            $out[] = $row;
        }

        return $out;
    }

    /**
     * Normalize a stored usage payload to snake_case (the SDK serializes its
     * Usage value object with camelCase keys; cache-hit rows store ours).
     *
     * @param array<string, mixed> $usage
     */
    private static function normalizeUsage(array $usage): ?array
    {
        if (empty($usage)) {
            return null;
        }
        return [
            'prompt_tokens' => $usage['prompt_tokens'] ?? $usage['promptTokens'] ?? null,
            'completion_tokens' => $usage['completion_tokens'] ?? $usage['completionTokens'] ?? null,
            'cache_read_tokens' => $usage['cache_read_tokens'] ?? $usage['cacheReadInputTokens'] ?? null,
            'cache_write_tokens' => $usage['cache_write_tokens'] ?? $usage['cacheWriteInputTokens'] ?? null,
        ];
    }

    /** Delete a stored attachment file, constrained to the attachment dir. */
    private static function deleteAttachmentFile(string $path): void
    {
        $dir = self::attachmentDir() . DIRECTORY_SEPARATOR;
        if ($path === '' || !str_starts_with($path, $dir)) {
            return;
        }
        if (is_file($path)) {
            @unlink($path);
        }
    }

    private static function failure(string $error, float $started): array
    {
        return [
            'success' => false,
            'conversation_id' => null,
            'conversation_created' => false,
            'provider' => '',
            'model' => '',
            'text' => '',
            'usage' => null,
            'cached' => false,
            'latency_ms' => round((microtime(true) - $started) * 1000, 1),
            'error' => $error,
        ];
    }
}
