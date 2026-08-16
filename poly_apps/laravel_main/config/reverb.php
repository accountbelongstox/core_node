<?php

use App\Constants\LaravelConfig;

$allowedOrigins = ['*'];

return [

    'default' => 'reverb',

    'servers' => [

        'reverb' => [
            'host' => LaravelConfig::REVERB_SERVER_HOST,
            'port' => LaravelConfig::REVERB_PORT,
            'path' => '',
            'hostname' => LaravelConfig::REVERB_CLIENT_HOST,
            'options' => [
                'tls' => [],
            ],
            'max_request_size' => 10_000,
            'scaling' => [
                'enabled' => false,
                'channel' => 'reverb',
                'server' => [
                    'url' => null,
                    'host' => LaravelConfig::REDIS_HOST,
                    'port' => LaravelConfig::REDIS_PORT,
                    'username' => null,
                    'password' => null,
                    'database' => LaravelConfig::REDIS_DATABASE,
                    'timeout' => 60,
                ],
            ],
            'pulse_ingest_interval' => 15,
            'telescope_ingest_interval' => 15,
        ],

    ],

    'apps' => [

        'provider' => 'config',

        'apps' => [
            [
                'key' => env('REVERB_APP_KEY'),
                'secret' => env('REVERB_APP_SECRET'),
                'app_id' => LaravelConfig::REVERB_APP_ID,
                'options' => [
                    'host' => LaravelConfig::REVERB_CLIENT_HOST,
                    'port' => LaravelConfig::REVERB_PORT,
                    'scheme' => LaravelConfig::REVERB_SCHEME,
                    'useTLS' => false,
                ],
                'allowed_origins' => $allowedOrigins ?: ['*'],
                'ping_interval' => 60,
                'activity_timeout' => 30,
                'max_connections' => null,
                'max_message_size' => 10_000,
            ],
        ],

    ],

];
