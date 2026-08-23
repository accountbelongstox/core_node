<?php

namespace App\Services\Realtime;

use App\Services\Relay\RelayHubJwt;
use Illuminate\Support\Facades\Http;

final class MercurePublisher
{
    private const PUBLISHER_CACHE_SECONDS = 240;
    private const MAX_UPDATE_BYTES = 65536;

    private static ?array $cachedPublisher = null;

    public static function publish(
        string|array $topics,
        string $data,
        bool $private = false,
        ?string $type = null,
        ?string $id = null,
        ?string $hubUrl = null
    ): ?string {
        $updateId = null;

        if (strlen($data) > self::MAX_UPDATE_BYTES) {
            throw new \InvalidArgumentException(__('relay.control_frame_too_large'));
        }
        if ($hubUrl === null && function_exists('mercure_publish')) {
            $updateId = mercure_publish($topics, $data, $private, $id, $type);

            return is_string($updateId) && $updateId !== '' ? $updateId : null;
        }

        return self::postToHub(
            is_array($topics) ? $topics : [$topics],
            $data,
            $private,
            $type,
            $id,
            $hubUrl
        );
    }

    private static function postToHub(
        array $topics,
        string $data,
        bool $private,
        ?string $type,
        ?string $id,
        ?string $hubUrl
    ): ?string {
        $resolvedHubUrl = $hubUrl ?? RelayHubJwt::hubUrl();
        $form = ['data' => $data];
        $parts = [];
        $response = null;
        $updateId = '';

        if ($private) {
            $form['private'] = '1';
        }
        if ($type !== null && $type !== '') {
            $form['type'] = $type;
        }
        if ($id !== null && $id !== '') {
            $form['id'] = $id;
        }
        $parts[] = http_build_query($form, '', '&', PHP_QUERY_RFC3986);
        foreach (array_values(array_unique($topics)) as $topic) {
            $parts[] = 'topic='.rawurlencode((string) $topic);
        }
        $response = Http::withToken(self::publisherJwt($resolvedHubUrl))
            ->withBody(implode('&', $parts), 'application/x-www-form-urlencoded')
            ->timeout(5)
            ->post($resolvedHubUrl);
        if (!$response->successful()) {
            return null;
        }
        $updateId = trim((string) $response->body());

        return $updateId !== '' ? $updateId : null;
    }

    private static function publisherJwt(string $hubUrl): string
    {
        if (self::$cachedPublisher !== null
            && self::$cachedPublisher['hub_url'] === $hubUrl
            && time() < self::$cachedPublisher['expires_at']) {
            return self::$cachedPublisher['token'];
        }
        self::$cachedPublisher = [
            'token' => RelayHubJwt::publisherToken($hubUrl),
            'expires_at' => time() + self::PUBLISHER_CACHE_SECONDS,
            'hub_url' => $hubUrl,
        ];

        return self::$cachedPublisher['token'];
    }
}
