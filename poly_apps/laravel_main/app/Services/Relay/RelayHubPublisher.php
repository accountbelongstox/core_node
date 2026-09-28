<?php

namespace App\Services\Relay;

use App\Services\Realtime\MercurePublisher;

/**
 * Mercure publish primitive: in-process first, hub POST fallback.
 *
 * On the frankenphp plane mercure_publish() exists inside the Octane worker
 * - zero network hop, no JWT handling. Every other runtime (queues, CLI,
 * the nginx compat plane) signs a short-lived publisher JWT with the
 * server-side key and POSTs the same hub. This is the native Mercure path
 * for queue and CLI contexts; the publisher key never leaves the process
 * boundary.
 */
final class RelayHubPublisher
{
    /**
     * Publish an update; returns the update id, or null when the hub path is
     * unavailable (the relay data plane keeps working through HTTP reads).
     */
    public static function publish(string|array $topics, string $data, bool $private = false, ?string $type = null, ?string $id = null): ?string
    {
        return MercurePublisher::publish($topics, $data, $private, $type, $id);
    }
}
