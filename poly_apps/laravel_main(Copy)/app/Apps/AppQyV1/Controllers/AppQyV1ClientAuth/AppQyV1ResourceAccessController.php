<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\Controllers\AppQyV1ClientAuth;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Config;

class AppQyV1ResourceAccessController
{
    /**
     * Validate resource access key
     */
    public function validateAccess(Request $request): JsonResponse
    {
        $isDebugMode = env('APP_DEBUG', false);

        if ($isDebugMode) {
            return $this->validateDebugToken($request);
        } else {
            return $this->validateResourceKey($request);
        }
    }

    /**
     * Validate debug token for development mode
     */
    private function validateDebugToken(Request $request): JsonResponse
    {
        $token = $request->header('Auth-Debug-Token');

        if (!$token) {
            return response()->json([
                'valid' => false,
                'message' => 'Debug token required in development mode'
            ], 401);
        }

        $validTokens = Config::get('auth.debug_tokens', []);
        $isValid = in_array($token, $validTokens);

        return response()->json([
            'valid' => $isValid,
            'mode' => 'debug',
            'message' => $isValid ? 'Debug token valid' : 'Invalid debug token'
        ]);
    }

    /**
     * Validate resource access key for production mode
     */
    private function validateResourceKey(Request $request): JsonResponse
    {
        $resourceKey = $request->header('Resource-Access-Key');

        if (!$resourceKey) {
            return response()->json([
                'valid' => false,
                'message' => 'Resource access key required'
            ], 401);
        }

        $validKeys = Config::get('auth.resource_access_keys', []);
        $isValid = in_array($resourceKey, $validKeys);

        return response()->json([
            'valid' => $isValid,
            'mode' => 'production',
            'message' => $isValid ? 'Resource access key valid' : 'Invalid resource access key'
        ]);
    }

    /**
     * Get available resource access information
     */
    public function getAccessInfo(Request $request): JsonResponse
    {
        $isDebugMode = env('APP_DEBUG', false);

        return response()->json([
            'mode' => $isDebugMode ? 'debug' : 'production',
            'required_header' => $isDebugMode ? 'Auth-Debug-Token' : 'Resource-Access-Key',
            'description' => $isDebugMode
                ? 'Development mode: Use debug token for resource access'
                : 'Production mode: Use resource access key for static content',
            'accessible_resources' => [
                'word_audio',
                'word_images',
                'basic_word_queries',
                'pronunciation_data'
            ]
        ]);
    }
}
