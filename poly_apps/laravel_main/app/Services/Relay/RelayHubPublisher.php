<?php

namespace App\Services\Relay;

use App\Support\QueueCenterContract;
use Illuminate\Support\Facades\Http;

/**
 * Mercure publish primitive: in-process first, hub POST fallback.
 *
 * On the frankenphp plane mercure_publish() exists inside the Octane worker
 * - zero network hop, no JWT handling. Every other runtime (queues, CLI,
 * the nginx compat plane) signs a short-lived publisher JWT with the
 * server-side key and POSTs the hub. The publisher key NEVER leaves this
 * process boundary.
 */
final class RelayHubPublisher
{
    private const PUBLISHER_CACHE_SECONDS = 240;

    /** @var array{token: string, expires_at: int}|null */
    private static ?array $cachedPublisher = null;

    /**
     * Publish an update; returns the update id, or null when the hub path is
     * unavailable (the relay data plane keeps working - poll fallback).
     */
    public static function publish(string|array $topics, string $data, bool $private = false, ?string $type = null, ?string $id = null): ?string
    {
        if (strlen($data) > QueueCenterContract::relayCap('control_frame_bytes')) {
            throw new \InvalidArgumentException('Relay control frame exceeds contract cap.');
        }

        if (function_exists('mercure_publish')) {
            $updateId = mercure_publish($topics, $data, $private, $id, $type);

            return is_string($updateId) && $updateId !== '' ? $updateId : null;
        }

        return self::postToHub(is_array($topics) ? $topics : [$topics], $data, $private, $type, $id);
    }

    private static function postToHub(array $topics, string $data, bool $private, ?string $type, ?string $id): ?string
    {
        $hubUrl = RelayHubJwt::hubUrl();
        $form = [
            'data' => $data,
        ];
        if ($private) {
            $form['private'] = '1';
        }
        if ($type !== null && $type !== '') {
            $form['type'] = $type;
        }
        if ($id !== null && $id !== '') {
            $form['id'] = $id;
        }
        foreach ($topics as $topic) {
            $form['topic'][] = $topic;
        }

        $response = Http::asForm()->withToken(self::publisherJwt())->timeout(5)->post($hubUrl, $form);
        if (!$response->successful()) {
            return null;
        }
        $updateId = trim((string) $response->body());

        return $updateId !== '' ? $updateId : null;
    }

    private static function publisherJwt(): string
    {
        if (self::$cachedPublisher !== null && time() < self::$cachedPublisher['expires_at']) {
            return self::$cachedPublisher['token'];
        }

        self::$cachedPublisher = [
            'token' => RelayHubJwt::publisherToken(),
            'expires_at' => time() + self::PUBLISHER_CACHE_SECONDS,
        ];

        return self::$cachedPublisher['token'];
    }
}
