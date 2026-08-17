<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Broadcaster
    |--------------------------------------------------------------------------
    | The realtime plane is the Mercure hub (frankenphp) served through
    | App\Services\Relay - publishing bypasses the broadcasting system
    | entirely. The broadcasting container stays on the log driver: nothing
    | is delivered through it anymore.
    |
    */

    'default' => 'log',

    'connections' => [

        'log' => [
            'driver' => 'log',
        ],

        'null' => [
            'driver' => 'null',
        ],

    ],

];
