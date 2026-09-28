<?php

namespace App\Apps\ItToolsV1\ItToolsV1Controllers;

use App\Http\Controllers\Controller;
use App\Apps\ItToolsV1\ItToolsV1Utils\CryptoService;
use App\Apps\ItToolsV1\ItToolsV1Utils\ConverterService;
use App\Apps\ItToolsV1\ItToolsV1Utils\ItToolsV1CommonUtil;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ItToolsMainCtl extends Controller
{
    /**
     * Get all tools metadata
     */
    public function getAllTools(): JsonResponse
    {
        $tools = [
            [
                'id' => 'hash_text',
                'name' => 'Hash Text',
                'description' => 'Generate MD5, SHA1, SHA256, SHA512 hashes',
                'category' => 'crypto',
                'endpoint' => '/api/ittools/crypto/hash',
                'method' => 'POST'
            ],
            [
                'id' => 'uuid_generator',
                'name' => 'UUID Generator',
                'description' => 'Generate v4 UUIDs',
                'category' => 'crypto',
                'endpoint' => '/api/ittools/crypto/uuid/generate',
                'method' => 'POST'
            ],
            [
                'id' => 'token_generator',
                'name' => 'Token Generator',
                'description' => 'Generate random tokens',
                'category' => 'crypto',
                'endpoint' => '/api/ittools/crypto/token/generate',
                'method' => 'POST'
            ],
            [
                'id' => 'base64_encode',
                'name' => 'Base64 Encode',
                'description' => 'Encode text to Base64',
                'category' => 'converter',
                'endpoint' => '/api/ittools/converter/base64/encode',
                'method' => 'POST'
            ],
            [
                'id' => 'base64_decode',
                'name' => 'Base64 Decode',
                'description' => 'Decode Base64 to text',
                'category' => 'converter',
                'endpoint' => '/api/ittools/converter/base64/decode',
                'method' => 'POST'
            ],
            [
                'id' => 'url_encode',
                'name' => 'URL Encode',
                'description' => 'Encode text for URL',
                'category' => 'converter',
                'endpoint' => '/api/ittools/converter/url/encode',
                'method' => 'POST'
            ]
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'tools' => $tools,
                'total' => count($tools),
                'categories' => array_unique(array_column($tools, 'category'))
            ]
        ]);
    }

    /**
     * Get tools by category
     */
    public function getToolsByCategory(string $category): JsonResponse
    {
        // Simple implementation - would be extended with actual tool list
        return response()->json([
            'success' => true,
            'data' => [
                'category' => $category,
                'tools' => [],
                'total' => 0
            ]
        ]);
    }

    /**
     * Search tools
     */
    public function searchTools(Request $request): JsonResponse
    {
        $query = $request->query('q', '');

        return response()->json([
            'success' => true,
            'data' => [
                'query' => $query,
                'tools' => [],
                'total' => 0
            ]
        ]);
    }

    // Crypto endpoints
    public function hashText(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'text' => 'required|string',
                'algorithm' => 'required|in:md5,sha1,sha256,sha512'
            ]);

            $result = CryptoService::hashText($validated['text'], $validated['algorithm']);

            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 400);
        }
    }

    public function generateUUID(Request $request): JsonResponse
    {
        try {
            $count = (int)$request->input('count', 1);
            $uppercase = (bool)$request->input('uppercase', false);

            $result = CryptoService::generateUUID($count, $uppercase);

            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 400);
        }
    }

    public function generateToken(Request $request): JsonResponse
    {
        try {
            $length = (int)$request->input('length', 32);
            $charset = $request->input('charset', 'alphanumeric');

            $length = max(1, min($length, 256));
            $result = [
                'token' => ItToolsV1CommonUtil::generateToken($length, $charset),
                'length' => $length,
                'charset' => $charset
            ];

            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 400);
        }
    }

    public function bcryptHash(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'password' => 'required|string',
                'rounds' => 'integer|min:4|max:31'
            ]);

            $rounds = $validated['rounds'] ?? 10;
            $result = CryptoService::bcryptHash($validated['password'], $rounds);

            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 400);
        }
    }

    public function bcryptVerify(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'password' => 'required|string',
                'hash' => 'required|string'
            ]);

            $result = CryptoService::bcryptVerify($validated['password'], $validated['hash']);

            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 400);
        }
    }

    public function hmac(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'message' => 'required|string',
                'key' => 'required|string',
                'algorithm' => 'in:sha256,sha512,sha1,md5'
            ]);

            $algorithm = $validated['algorithm'] ?? 'sha256';
            $result = CryptoService::hmac($validated['message'], $validated['key'], $algorithm);

            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 400);
        }
    }

    public function analyzePassword(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'password' => 'required|string'
            ]);

            $result = CryptoService::analyzePassword($validated['password']);

            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 400);
        }
    }

    // Converter endpoints
    public function base64Encode(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'text' => 'required|string'
            ]);

            $result = ConverterService::base64Encode($validated['text']);

            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 400);
        }
    }

    public function base64Decode(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'text' => 'required|string'
            ]);

            $result = ConverterService::base64Decode($validated['text']);

            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 400);
        }
    }

    public function urlEncode(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'text' => 'required|string'
            ]);

            $result = ConverterService::urlEncode($validated['text']);

            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 400);
        }
    }

    public function urlDecode(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'text' => 'required|string'
            ]);

            $result = ConverterService::urlDecode($validated['text']);

            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 400);
        }
    }
}
