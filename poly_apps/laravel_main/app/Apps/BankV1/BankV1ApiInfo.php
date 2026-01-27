<?php

namespace App\Apps\BankV1;

class BankV1ApiInfo
{
    public static function getApiInfo(): array
    {
        return [
            'app_name' => 'BankV1',
            'app_version' => '1.0.0',
            'description' => 'Banking Application API for Flutter Mobile App',
            'base_path' => '/api/bank',
            'supported_headers' => [
                'Authorization' => 'Bearer token for authenticated requests',
                'X-Device-ID' => 'Unique device identifier',
                'X-App-Signature' => 'Application signature for security',
                'X-Timestamp' => 'Request timestamp',
                'X-Nonce' => 'Random nonce for security',
                'X-Platform' => 'Platform information (android/ios/web)',
                'X-App-Version' => 'Application version',
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ],
            'apis' => [
                // Health Check API
                'health' => [
                    'method' => 'GET',
                    'feature' => 'health_check|endpoint_detection',
                    'requires_auth' => false,
                    'parameters' => [],
                    'response_format' => [
                        'status' => 'healthy|unhealthy',
                        'database' => 'string',
                        'timestamp' => 'string (ISO8601)',
                        'version' => 'string',
                    ],
                ],

                // Data Submission API
                'data/submit' => [
                    'method' => 'POST',
                    'feature' => 'data_submission|device_tracking|user_data_collection',
                    'requires_auth' => false,
                    'parameters' => [
                        'device_info' => 'array|required',
                        'device_info.device_name' => 'string|required',
                        'device_info.device_id' => 'string|required',
                        'device_info.app_signature' => 'string|required',
                        'device_info.machine_code' => 'string|required',
                        'device_info.platform' => 'string|required',
                        'device_info.platform_version' => 'string|required|max:255',
                        'device_info.ip_address' => 'ip|nullable',
                        'device_info.additional_info' => 'array|nullable',
                        'registration_info' => 'array|required',
                        'registration_info.registration_code' => 'string|nullable',
                        'registration_info.is_registered' => 'boolean|required',
                        'registration_info.is_super_user' => 'boolean|required',
                        'registration_info.registration_time' => 'date|nullable',
                        'registration_info.expiration_time' => 'date|nullable',
                        'user_data' => 'array|required',
                        'user_data.phone' => 'string|nullable',
                        'user_data.full_name' => 'string|nullable',
                        'user_data.location' => 'string|nullable',
                        'user_data.city' => 'string|nullable',
                        'user_data.total_balance' => 'numeric|nullable',
                        'user_data.cards' => 'array|required',
                        'user_data.cards.*.card_number' => 'string|required',
                        'user_data.cards.*.card_type' => 'string|required',
                        'user_data.cards.*.balance' => 'numeric|required',
                        'user_data.cards.*.currency' => 'string|required',
                        'user_data.cards.*.opened_at' => 'date|nullable',
                        'user_data.additional_data' => 'array|nullable',
                        'submit_time' => 'date|required',
                    ],
                    'response_format' => [
                        'success' => 'boolean',
                        'data' => [
                            'submission_id' => 'string',
                            'received_at' => 'string (ISO8601)',
                        ],
                        'message' => 'string',
                    ],
                ],

                // Authentication APIs
                'auth/login' => [
                    'method' => 'POST',
                    'feature' => 'authentication|login|device_tracking',
                    'requires_auth' => false,
                    'parameters' => [
                        'username' => 'string|required',
                        'password' => 'string|required',
                        'device_id' => 'string|optional',
                        'app_signature' => 'string|optional',
                    ],
                    'response_format' => [
                        'success' => 'boolean',
                        'data' => [
                            'token' => 'string',
                            'refresh_token' => 'string',
                            'expires_in' => 'integer',
                            'user' => 'UserData object',
                        ],
                        'message' => 'string',
                    ],
                ],
                'auth/register' => [
                    'method' => 'POST',
                    'feature' => 'authentication|registration|device_tracking',
                    'requires_auth' => false,
                    'parameters' => [
                        'username' => 'string|required|unique',
                        'email' => 'string|required|email|unique',
                        'password' => 'string|required|min:8',
                        'full_name' => 'string|required',
                        'phone' => 'string|optional',
                        'device_id' => 'string|optional',
                        'app_signature' => 'string|optional',
                    ],
                    'response_format' => [
                        'success' => 'boolean',
                        'data' => [
                            'user_id' => 'string',
                            'message' => 'string',
                        ],
                        'message' => 'string',
                    ],
                ],
                'auth/logout' => [
                    'method' => 'POST',
                    'feature' => 'authentication|logout|session_management',
                    'requires_auth' => true,
                    'parameters' => [],
                    'response_format' => [
                        'success' => 'boolean',
                        'message' => 'string',
                    ],
                ],
                'auth/refresh' => [
                    'method' => 'POST',
                    'feature' => 'authentication|token_refresh',
                    'requires_auth' => false,
                    'parameters' => [
                        'refresh_token' => 'string|required',
                    ],
                    'response_format' => [
                        'success' => 'boolean',
                        'data' => [
                            'token' => 'string',
                            'expires_in' => 'integer',
                        ],
                        'message' => 'string',
                    ],
                ],
                'auth/verify' => [
                    'method' => 'GET',
                    'feature' => 'authentication|token_verification',
                    'requires_auth' => true,
                    'parameters' => [],
                    'response_format' => [
                        'success' => 'boolean',
                        'data' => [
                            'valid' => 'boolean',
                            'user' => 'UserData object',
                        ],
                        'message' => 'string',
                    ],
                ],

                // App Lifecycle APIs
                'app/open' => [
                    'method' => 'POST',
                    'feature' => 'app_lifecycle|logging|device_tracking|security_check',
                    'requires_auth' => false,
                    'parameters' => [
                        'device_id' => 'string|required',
                        'app_signature' => 'string|required',
                        'timestamp' => 'integer|required',
                        'event_type' => 'string|required',
                        'app_version' => 'string|optional',
                        'platform' => 'string|optional',
                    ],
                    'response_format' => [
                        'success' => 'boolean',
                        'data' => [
                            'session_id' => 'string',
                            'server_config' => 'object|optional',
                            'device_locked' => 'boolean',
                            'lock_reason' => 'string|optional',
                        ],
                        'message' => 'string',
                    ],
                ],
                'app/close' => [
                    'method' => 'POST',
                    'feature' => 'app_lifecycle|logging|session_tracking',
                    'requires_auth' => false,
                    'parameters' => [
                        'device_id' => 'string|required',
                        'app_signature' => 'string|required',
                        'timestamp' => 'integer|required',
                        'event_type' => 'string|required',
                        'session_duration' => 'integer|optional',
                    ],
                    'response_format' => [
                        'success' => 'boolean',
                        'message' => 'string',
                    ],
                ],
                'app/heartbeat' => [
                    'method' => 'POST',
                    'feature' => 'app_lifecycle|session_monitoring',
                    'requires_auth' => true,
                    'parameters' => [
                        'timestamp' => 'integer|required',
                        'session_duration' => 'integer|optional',
                    ],
                    'response_format' => [
                        'success' => 'boolean',
                        'message' => 'string',
                    ],
                ],

                // User Management APIs
                'user/profile' => [
                    'method' => 'GET',
                    'feature' => 'user_management|profile_access',
                    'requires_auth' => true,
                    'parameters' => [],
                    'response_format' => [
                        'success' => 'boolean',
                        'data' => 'UserData object',
                        'message' => 'string',
                    ],
                ],
                'user/profile/update' => [
                    'method' => 'PUT',
                    'feature' => 'user_management|profile_update|logging',
                    'requires_auth' => true,
                    'parameters' => [
                        'full_name' => 'string|optional',
                        'email' => 'string|optional|email',
                        'phone' => 'string|optional',
                        'date_of_birth' => 'string|optional|date',
                        'gender' => 'string|optional',
                        'updated_at' => 'string|required',
                    ],
                    'response_format' => [
                        'success' => 'boolean',
                        'data' => 'UserData object',
                        'message' => 'string',
                    ],
                ],
                'user/balance/update' => [
                    'method' => 'PUT',
                    'feature' => 'user_management|balance_update|logging|security_check',
                    'requires_auth' => true,
                    'parameters' => [
                        'new_balance' => 'numeric|required',
                        'timestamp' => 'integer|required',
                        'reason' => 'string|optional',
                        'transaction_type' => 'string|optional',
                    ],
                    'response_format' => [
                        'success' => 'boolean',
                        'data' => [
                            'old_balance' => 'numeric',
                            'new_balance' => 'numeric',
                            'transaction_id' => 'string',
                        ],
                        'message' => 'string',
                    ],
                ],
                'user/address/update' => [
                    'method' => 'PUT',
                    'feature' => 'user_management|address_update|logging',
                    'requires_auth' => true,
                    'parameters' => [
                        'street' => 'string|optional',
                        'city' => 'string|optional',
                        'state' => 'string|optional',
                        'zip_code' => 'string|optional',
                        'country' => 'string|optional',
                        'updated_at' => 'string|required',
                    ],
                    'response_format' => [
                        'success' => 'boolean',
                        'data' => 'AddressData object',
                        'message' => 'string',
                    ],
                ],
                'user/register-code' => [
                    'method' => 'POST',
                    'feature' => 'user_management|registration_code|logging',
                    'requires_auth' => true,
                    'parameters' => [
                        'registration_code' => 'string|required',
                        'timestamp' => 'integer|required',
                        'referral_source' => 'string|optional',
                    ],
                    'response_format' => [
                        'success' => 'boolean',
                        'data' => [
                            'code_valid' => 'boolean',
                            'benefits' => 'array|optional',
                        ],
                        'message' => 'string',
                    ],
                ],

                // Security APIs
                'security/device/register' => [
                    'method' => 'POST',
                    'feature' => 'security|device_registration|logging',
                    'requires_auth' => false,
                    'parameters' => [
                        'device_id' => 'string|required',
                        'app_signature' => 'string|required',
                        'registration_timestamp' => 'integer|required',
                        'device_name' => 'string|optional',
                        'platform' => 'string|optional',
                        'app_version' => 'string|optional',
                    ],
                    'response_format' => [
                        'success' => 'boolean',
                        'data' => [
                            'device_registered' => 'boolean',
                            'device_status' => 'string',
                        ],
                        'message' => 'string',
                    ],
                ],
                'security/device/status' => [
                    'method' => 'GET',
                    'feature' => 'security|device_status_check',
                    'requires_auth' => false,
                    'parameters' => [
                        'device_id' => 'string|required|query',
                    ],
                    'response_format' => [
                        'success' => 'boolean',
                        'data' => [
                            'device_locked' => 'boolean',
                            'lock_reason' => 'string|optional',
                            'device_status' => 'string',
                        ],
                        'message' => 'string',
                    ],
                ],
                'security/check' => [
                    'method' => 'POST',
                    'feature' => 'security|security_check|device_validation',
                    'requires_auth' => false,
                    'parameters' => [
                        'device_id' => 'string|required',
                        'app_signature' => 'string|required',
                        'timestamp' => 'integer|required',
                        'check_type' => 'string|required',
                    ],
                    'response_format' => [
                        'success' => 'boolean',
                        'data' => [
                            'security_status' => 'string',
                            'device_lock' => 'boolean|optional',
                            'lock_reason' => 'string|optional',
                        ],
                        'message' => 'string',
                    ],
                ],
            ],
        ];
    }
}
