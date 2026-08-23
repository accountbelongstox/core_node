<?php

namespace App\Apps\RelayV2;

use App\Apps\RelayV2\RelayV2Services\RelayV2Contract;

final class RelayV2ApiInfo
{
    public static function getApiInfo(): array
    {
        return [
            'app_name' => 'RelayV2',
            'api_version' => RelayV2Contract::protocolVersion(),
            'app_description' => __('relay_v2.api_description'),
            'base_url' => url('/api/relay/v2'),
            'api_prefix' => '/api/relay/v2',
            'authentication' => [
                'owner' => __('relay_v2.authentication_owner'),
                'device' => __('relay_v2.authentication_device'),
            ],
            'contract_digest' => RelayV2Contract::digest(),
            'endpoints' => RelayV2Contract::document()['endpoints'],
        ];
    }
}
