<?php

namespace App\Apps\ItToolsV1\ItToolsV1Gvar;

/**
 * IT Tools V1 API Information
 *
 * Collects all API endpoints, parameters, and features
 * Used by the main API info endpoint at /api_info
 */
class ItToolsV1ApiInfo
{
    /**
     * Get complete API information
     */
    public static function getApiInfo(): array
    {
        return [
            'name' => 'IT Tools',
            'namespace' => 'ittools',
            'version' => 'v1',
            'description' => 'Collection of 88+ handy online tools for developers',
            'baseUrl' => '/api/ittools',
            'supportedHeaders' => [
                'X-App-Namespace' => 'ittools',
                'Content-Type' => 'application/json',
                'Accept' => 'application/json'
            ],
            'apis' => self::getApiEndpoints()
        ];
    }

    /**
     * Get all API endpoints organized by category
     */
    private static function getApiEndpoints(): array
    {
        return [
            // Crypto & Security Endpoints
            'crypto_hash' => [
                'path' => '/crypto/hash',
                'method' => 'POST',
                'description' => 'Generate MD5, SHA1, SHA256, SHA512 hashes',
                'requiresAuth' => false,
                'params' => [
                    'text' => ['type' => 'string', 'required' => true, 'description' => 'Text to hash'],
                    'algorithm' => ['type' => 'string', 'required' => true, 'enum' => ['md5', 'sha1', 'sha256', 'sha512']]
                ],
                'response' => [
                    'text' => 'string',
                    'algorithm' => 'string',
                    'hash' => 'string'
                ],
                'features' => ['hashing', 'crypto']
            ],

            'crypto_uuid_generate' => [
                'path' => '/crypto/uuid/generate',
                'method' => 'POST',
                'description' => 'Generate v4 UUIDs',
                'requiresAuth' => false,
                'params' => [
                    'count' => ['type' => 'integer', 'required' => false, 'default' => 1, 'min' => 1, 'max' => 100],
                    'uppercase' => ['type' => 'boolean', 'required' => false, 'default' => false]
                ],
                'response' => [
                    'uuids' => ['type' => 'array', 'items' => 'string'],
                    'count' => 'integer'
                ],
                'features' => ['generation', 'unique-id']
            ],

            'crypto_token_generate' => [
                'path' => '/crypto/token/generate',
                'method' => 'POST',
                'description' => 'Generate random tokens with custom length and charset',
                'requiresAuth' => false,
                'params' => [
                    'length' => ['type' => 'integer', 'required' => false, 'default' => 32, 'min' => 1, 'max' => 256],
                    'charset' => ['type' => 'string', 'required' => false, 'default' => 'alphanumeric', 'enum' => ['alphanumeric', 'numeric', 'alphabetic', 'special']]
                ],
                'response' => [
                    'token' => 'string',
                    'length' => 'integer',
                    'charset' => 'string'
                ],
                'features' => ['generation', 'random']
            ],

            'crypto_bcrypt_hash' => [
                'path' => '/crypto/bcrypt/hash',
                'method' => 'POST',
                'description' => 'Generate bcrypt hash for password',
                'requiresAuth' => false,
                'params' => [
                    'password' => ['type' => 'string', 'required' => true, 'description' => 'Password to hash'],
                    'rounds' => ['type' => 'integer', 'required' => false, 'default' => 10, 'min' => 4, 'max' => 31]
                ],
                'response' => [
                    'hash' => 'string',
                    'rounds' => 'integer',
                    'algorithm' => 'string'
                ],
                'features' => ['password-security', 'crypto']
            ],

            'crypto_bcrypt_verify' => [
                'path' => '/crypto/bcrypt/verify',
                'method' => 'POST',
                'description' => 'Verify password against bcrypt hash',
                'requiresAuth' => false,
                'params' => [
                    'password' => ['type' => 'string', 'required' => true],
                    'hash' => ['type' => 'string', 'required' => true]
                ],
                'response' => [
                    'verified' => 'boolean',
                    'password' => 'string',
                    'hash' => 'string'
                ],
                'features' => ['password-verification', 'crypto']
            ],

            'crypto_hmac' => [
                'path' => '/crypto/hmac',
                'method' => 'POST',
                'description' => 'Generate HMAC',
                'requiresAuth' => false,
                'params' => [
                    'message' => ['type' => 'string', 'required' => true],
                    'key' => ['type' => 'string', 'required' => true],
                    'algorithm' => ['type' => 'string', 'required' => false, 'default' => 'sha256', 'enum' => ['sha256', 'sha512', 'sha1', 'md5']]
                ],
                'response' => [
                    'message' => 'string',
                    'key' => 'string',
                    'algorithm' => 'string',
                    'hmac' => 'string'
                ],
                'features' => ['mac', 'crypto']
            ],

            'crypto_password_analyze' => [
                'path' => '/crypto/password/analyze',
                'method' => 'POST',
                'description' => 'Analyze password strength',
                'requiresAuth' => false,
                'params' => [
                    'password' => ['type' => 'string', 'required' => true]
                ],
                'response' => [
                    'password' => 'string',
                    'length' => 'integer',
                    'strength' => 'integer',
                    'level' => 'string',
                    'hasLowercase' => 'boolean',
                    'hasUppercase' => 'boolean',
                    'hasNumbers' => 'boolean',
                    'hasSpecial' => 'boolean',
                    'feedback' => ['type' => 'array', 'items' => 'string']
                ],
                'features' => ['password-analysis', 'security']
            ],

            // Converter Endpoints
            'converter_base64_encode' => [
                'path' => '/converter/base64/encode',
                'method' => 'POST',
                'description' => 'Encode text to Base64',
                'requiresAuth' => false,
                'params' => [
                    'text' => ['type' => 'string', 'required' => true]
                ],
                'response' => [
                    'original' => 'string',
                    'encoded' => 'string',
                    'length' => 'integer',
                    'encodedLength' => 'integer'
                ],
                'features' => ['encoding', 'conversion']
            ],

            'converter_base64_decode' => [
                'path' => '/converter/base64/decode',
                'method' => 'POST',
                'description' => 'Decode Base64 to text',
                'requiresAuth' => false,
                'params' => [
                    'text' => ['type' => 'string', 'required' => true]
                ],
                'response' => [
                    'original' => 'string',
                    'decoded' => 'string',
                    'length' => 'integer',
                    'decodedLength' => 'integer'
                ],
                'features' => ['decoding', 'conversion']
            ],

            'converter_url_encode' => [
                'path' => '/converter/url/encode',
                'method' => 'POST',
                'description' => 'Encode text for URL',
                'requiresAuth' => false,
                'params' => [
                    'text' => ['type' => 'string', 'required' => true]
                ],
                'response' => [
                    'original' => 'string',
                    'encoded' => 'string',
                    'encoded_rfc3986' => 'string',
                    'length' => 'integer'
                ],
                'features' => ['url-encoding', 'conversion']
            ],

            'converter_url_decode' => [
                'path' => '/converter/url/decode',
                'method' => 'POST',
                'description' => 'Decode URL encoded text',
                'requiresAuth' => false,
                'params' => [
                    'text' => ['type' => 'string', 'required' => true]
                ],
                'response' => [
                    'original' => 'string',
                    'decoded' => 'string',
                    'decoded_rfc3986' => 'string',
                    'length' => 'integer'
                ],
                'features' => ['url-decoding', 'conversion']
            ]
        ];
    }

    /**
     * Get API info formatted for web UI display
     */
    public static function getApiInfoForWebUI(): array
    {
        $apiInfo = self::getApiInfo();

        return [
            'app' => [
                'name' => $apiInfo['name'],
                'namespace' => $apiInfo['namespace'],
                'version' => $apiInfo['version'],
                'description' => $apiInfo['description'],
                'baseUrl' => $apiInfo['baseUrl']
            ],
            'apis' => array_map(function ($endpoint, $key) {
                return [
                    'id' => $key,
                    'path' => $endpoint['path'],
                    'method' => $endpoint['method'],
                    'description' => $endpoint['description'],
                    'requiresAuth' => $endpoint['requiresAuth'],
                    'params' => $endpoint['params'] ?? [],
                    'response' => $endpoint['response'] ?? [],
                    'features' => $endpoint['features'] ?? []
                ];
            }, $apiInfo['apis'], array_keys($apiInfo['apis']))
        ];
    }

    /**
     * Get API statistics
     */
    public static function getApiStats(): array
    {
        $apiEndpoints = self::getApiEndpoints();
        $categorized = [];

        foreach ($apiEndpoints as $key => $endpoint) {
            $category = explode('_', $key)[0];
            if (!isset($categorized[$category])) {
                $categorized[$category] = 0;
            }
            $categorized[$category]++;
        }

        return [
            'total' => count($apiEndpoints),
            'byCategory' => $categorized,
            'byMethod' => [
                'POST' => count(array_filter($apiEndpoints, fn($e) => $e['method'] === 'POST')),
                'GET' => count(array_filter($apiEndpoints, fn($e) => $e['method'] === 'GET'))
            ]
        ];
    }
}
