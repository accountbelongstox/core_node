<?php

namespace App\Services\Realtime;

class RealtimeConnectionService
{
    public function connection(string $channel, array $extra = []): array
    {
        $options = config('broadcasting.connections.reverb.options', []);

        return array_merge([
            'transport' => 'websocket',
            'app_key' => (string) config('broadcasting.connections.reverb.key', ''),
            'host' => '',
            'port' => (int) ($options['port'] ?? 8080),
            'scheme' => (string) ($options['scheme'] ?? 'http'),
            'channel' => $channel,
        ], $extra);
    }
}
