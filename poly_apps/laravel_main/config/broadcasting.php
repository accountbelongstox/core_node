<?php

use App\Constants\LaravelConfig;

return [

    'default' => 'reverb',

    'connections' => [

        'reverb' => [
            'driver' => 'reverb',
            'key' => env('REVERB_APP_KEY'),
            'secret' => env('REVERB_APP_SECRET'),
            'app_id' => LaravelConfig::REVERB_APP_ID,
            'options' => [
                'host' => LaravelConfig::REVERB_CLIENT_HOST,
                'port' => LaravelConfig::REVERB_PORT,
                'scheme' => LaravelConfig::REVERB_SCHEME,
                'useTLS' => false,
            ],
            'client_options' => [
                'connect_timeout' => 0.25,
                'timeout' => 1.0,
            ],
        ],

        'log' => [
            'driver' => 'log',
        ],

        'null' => [
            'driver' => 'null',
        ],

    ],

];
