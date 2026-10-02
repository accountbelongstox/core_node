<?php

use App\Support\ServiceContract;

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['*', 'api/*', 'api/health', 'api_info', 'sanctum/csrf-cookie',"avatar/*"],

    'allowed_methods' => ['*'],

    'allowed_origins' => ServiceContract::webAccessStringList('corsOrigins'),

    'allowed_origins_patterns' => ServiceContract::tailnetCorsOriginPatterns(),

    'allowed_headers' => ['*'],

    'exposed_headers' => ["*"],

    'max_age' => 86400,

    'supports_credentials' =>  true,

];
