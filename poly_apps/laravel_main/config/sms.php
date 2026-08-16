<?php

return [
    'default' => 'tencent',

    'code_expiry_minutes' => 30,

    'code_length' => 6,

    'max_daily_sends_per_phone' => 10,

    'rate_limit_seconds' => 60,

    'drivers' => [
        'tencent' => [
            'secret_id' => null,
            'secret_key' => null,
            'sdk_app_id' => null,
            'sign_name' => null,
            'template_id' => null,
            'region' => 'ap-guangzhou',
            'endpoint' => 'sms.tencentcloudapi.com',
        ],

        'aliyun' => [
            'access_key_id' => null,
            'access_key_secret' => null,
            'sign_name' => null,
            'template_code' => null,
            'region_id' => 'cn-hangzhou',
        ],

        'log' => [
        ],
    ],

    'templates' => [
        'verification_code' => [
            'tencent' => null,
            'aliyun' => null,
        ],
    ],

    'enabled' => true,
];
