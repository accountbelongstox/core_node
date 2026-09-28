<?php

namespace App\Apps\Relay;

use App\Apps\Relay\RelayServices\RelayContract;

final class RelayApiInfo
{
    public static function getApiInfo(): array
    {
        return [
            'app_name' => 'Relay',
            'api_version' => RelayContract::protocolVersion(),
            'app_description' => __('relay.api_description'),
            'base_url' => RelayContract::publicUrl('laravel_api_origin').'/api/relay',
            'api_prefix' => '/api/relay',
            'authentication' => [
                'owner' => __('relay.authentication_owner'),
                'device' => __('relay.authentication_device'),
            ],
            'contract_digest' => RelayContract::digest(),
            'public_urls' => RelayContract::document()['public_urls'],
            'endpoints' => RelayContract::document()['endpoints'],
        ];
    }
}
