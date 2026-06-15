<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Http\EnvironmentApiInfo;

use App\Http\Common\CommonGvar;

class GlobalApiConstants
{
    /**
     * Get global API constants and shared headers for debugging
     *
     * @return array
     */
    public function getDetails(): array
    {
        return [
            'global_headers' => self::getGlobalHeaders(),
            'common_constants' => self::getCommonConstants(),
            'parameter_types' => self::getParameterTypes(),
            'response_formats' => self::getResponseFormats()
        ];
    }

    /**
     * Get shared header constants that can be used across all apps
     *
     * @return array
     */
    private static function getGlobalHeaders(): array
    {
        return [
            'authentication' => [
                CommonGvar::ClientToken => [
                    'description' => 'Client token for API access',
                    'type' => 'string',
                    'required_for' => 'Client-specific endpoints',
                    'example' => 'client-token-12345'
                ],
                CommonGvar::AuthUsername => [
                    'description' => 'Username for authentication',
                    'type' => 'string',
                    'required_for' => 'Basic authentication',
                    'example' => 'user@example.com'
                ],
                CommonGvar::AuthPassword => [
                    'description' => 'Password for authentication',
                    'type' => 'string',
                    'required_for' => 'Basic authentication',
                    'example' => 'password123'
                ],
                CommonGvar::AuthUserToken => [
                    'description' => 'User authentication token',
                    'type' => 'string',
                    'required_for' => 'Authenticated endpoints',
                    'example' => 'user-token-abcdef123456'
                ],
                CommonGvar::AuthDebugToken => [
                    'description' => 'Debug token for development',
                    'type' => 'string',
                    'required_for' => 'Debug endpoints',
                    'example' => 'debug-token-xyz789'
                ]
            ],
            'standard' => [
                'Content-Type' => [
                    'description' => 'Request content type',
                    'type' => 'string',
                    'required_for' => 'All POST/PUT requests',
                    'example' => 'application/json'
                ],
                'Accept' => [
                    'description' => 'Response content type',
                    'type' => 'string', 
                    'required_for' => 'All requests',
                    'example' => 'application/json'
                ],
                'Authorization' => [
                    'description' => 'Bearer token authorization',
                    'type' => 'string',
                    'required_for' => 'Token-based auth endpoints',
                    'example' => 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...'
                ]
            ]
        ];
    }

    /**
     * Get common constants used across the API
     *
     * @return array
     */
    private static function getCommonConstants(): array
    {
        return [
            'auth_types' => [
                'no_auth_required' => 'Endpoint does not require authentication',
                'auth_required' => 'Standard authentication required',
                'auth_required:client.token' => 'Client token authentication required'
            ],
            'http_methods' => [
                'GET' => 'Retrieve data',
                'POST' => 'Create new resource',
                'PUT' => 'Update existing resource',
                'DELETE' => 'Remove resource',
                'ANY' => 'Accepts multiple HTTP methods'
            ],
            'feature_format' => 'auth_type/method|description|controller|params:param(type,required/optional)|headers:{{header}}(type,required/optional)|response:field1,field2'
        ];
    }

    /**
     * Get parameter types used in API documentation
     *
     * @return array
     */
    private static function getParameterTypes(): array
    {
        return [
            'string' => 'Text value',
            'int' => 'Integer number',
            'boolean' => 'True/false value',
            'array' => 'List of values',
            'file' => 'Uploaded file',
            'float' => 'Decimal number',
            'date' => 'Date string (YYYY-MM-DD)',
            'datetime' => 'Datetime string (ISO 8601)',
            'email' => 'Valid email address',
            'url' => 'Valid URL'
        ];
    }

    /**
     * Get common response formats
     *
     * @return array
     */
    private static function getResponseFormats(): array
    {
        return [
            'success' => [
                'status' => 200,
                'format' => [
                    'success' => true,
                    'data' => '...',
                    'message' => 'Operation successful'
                ]
            ],
            'error' => [
                'status' => '4xx/5xx',
                'format' => [
                    'success' => false,
                    'error' => '...',
                    'message' => 'Error description'
                ]
            ],
            'validation_error' => [
                'status' => 422,
                'format' => [
                    'message' => 'Validation failed',
                    'errors' => [
                        'field_name' => ['error message']
                    ]
                ]
            ]
        ];
    }
}