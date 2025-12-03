<?php

return [
    'default' => env('SMS_DRIVER', 'tencent'),

    'code_expiry_minutes' => env('SMS_CODE_EXPIRY_MINUTES', 30),

    'code_length' => env('SMS_CODE_LENGTH', 6),

    'max_daily_sends_per_phone' => env('SMS_MAX_DAILY_SENDS', 10),

    'rate_limit_seconds' => env('SMS_RATE_LIMIT_SECONDS', 60),

    'drivers' => [
        'tencent' => [
            'secret_id' => env('TENCENT_SMS_SECRET_ID'),
            'secret_key' => env('TENCENT_SMS_SECRET_KEY'),
            'sdk_app_id' => env('TENCENT_SMS_SDK_APP_ID'),
            'sign_name' => env('TENCENT_SMS_SIGN_NAME', '腾讯云'),
            'template_id' => env('TENCENT_SMS_TEMPLATE_ID'),
            'region' => env('TENCENT_SMS_REGION', 'ap-guangzhou'),
            'endpoint' => env('TENCENT_SMS_ENDPOINT', 'sms.tencentcloudapi.com'),
        ],

        'aliyun' => [
            'access_key_id' => env('ALIYUN_SMS_ACCESS_KEY_ID'),
            'access_key_secret' => env('ALIYUN_SMS_ACCESS_KEY_SECRET'),
            'sign_name' => env('ALIYUN_SMS_SIGN_NAME'),
            'template_code' => env('ALIYUN_SMS_TEMPLATE_CODE'),
            'region_id' => env('ALIYUN_SMS_REGION_ID', 'cn-hangzhou'),
        ],

        'log' => [
        ],
    ],

    'templates' => [
        'verification_code' => [
            'tencent' => env('TENCENT_SMS_TEMPLATE_ID'),
            'aliyun' => env('ALIYUN_SMS_TEMPLATE_CODE'),
        ],
    ],

    'enabled' => env('SMS_ENABLED', true),
];
