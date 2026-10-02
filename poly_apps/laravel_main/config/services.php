<?php

use App\Constants\LaravelConfig;

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'codemart_bank_transfer' => [
        'bank_name' => null,
        'account_name' => null,
        'account_number' => null,
        'branch' => null,
        'swift_code' => null,
    ],

    'codemart_seed_demo' => LaravelConfig::CODEMART_SEED_DEMO,

    'openrouter' => [
        // Cache lifetime of a failed or empty free-model catalog fetch.
        'catalog_failure_cache_seconds' => 600,
    ],

    'workos' => [
        'api_key' => null,
        'client_id' => null,
        'client_secret' => null,
        'redirect_url' => null,
    ],

];
