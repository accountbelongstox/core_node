<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1ClientAuth;

use App\Http\Controllers\Controller;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Config;
use App\Traits\ApiResponse;

class AppQyV1ResourceAccessController extends Controller
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    /**
     * Validate resource access key
     */
    public function validateAccess(Request $request): JsonResponse
    {
        $isDebugMode = (bool) config('app.debug');

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
                'message' => __('app_qy_v1.messages.debug_token_required')
            ], 401);
        }

        $validTokens = Config::get('auth.debug_tokens', []);
        $isValid = in_array($token, $validTokens);

        return response()->json([
            'valid' => $isValid,
            'mode' => 'debug',
            'message' => $isValid ? __('app_qy_v1.messages.debug_token_valid') : __('app_qy_v1.messages.debug_token_invalid')
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
                'message' => __('app_qy_v1.messages.resource_access_key_required')
            ], 401);
        }

        $validKeys = Config::get('auth.resource_access_keys', []);
        $isValid = in_array($resourceKey, $validKeys);

        return response()->json([
            'valid' => $isValid,
            'mode' => 'production',
            'message' => $isValid ? __('app_qy_v1.messages.resource_access_key_valid') : __('app_qy_v1.messages.resource_access_key_invalid')
        ]);
    }

    /**
     * Get available resource access information
     */
    public function getAccessInfo(Request $request): JsonResponse
    {
        $isDebugMode = (bool) config('app.debug');

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
