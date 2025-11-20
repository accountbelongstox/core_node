<?php
namespace App\Apps\AppQyV1;

/**
 * AppQyV1ApiInfo Class
 * API information for app_qy vocabulary learning application
 */
class AppQyV1ApiInfo
{
    /**
     * Get API information for AppQyV1 app
     */
    public static function getApiInfo(): array
    {
        return [
            "app_name" => "AppQyV1",
            "api_version" => "v1",
            "app_description" => "app_qy vocabulary learning system",
            "base_url" => url("/api"),
            "api_prefix" => url("/api"),
            "endpoints" => self::getEndpoints(),
            "supported_headers" => self::getSupportedHeaders(),
            "authentication" => [
                "type" => "JWT Bearer Token",
                "methods" => ["Phone SMS", "WeChat OAuth"],
                "token_expiry" => 86400
            ]
        ];
    }

    private static function getEndpoints(): array
    {
        return [
            // Authentication endpoints
            [
                "path" => url("/api/auth/phone/send-code"),
                "method" => "POST",
                "description" => "Send SMS verification code",
                "auth_required" => false
            ],
            [
                "path" => url("/api/auth/phone/verify"),
                "method" => "POST",
                "description" => "Verify SMS code and login",
                "auth_required" => false
            ],
            [
                "path" => url("/api/auth/wechat"),
                "method" => "POST",
                "description" => "WeChat OAuth login",
                "auth_required" => false
            ],
            [
                "path" => url("/api/auth/refresh"),
                "method" => "POST",
                "description" => "Refresh access token",
                "auth_required" => true
            ],
            [
                "path" => url("/api/auth/logout"),
                "method" => "POST",
                "description" => "User logout",
                "auth_required" => true
            ],
            // Additional endpoints will be added here
        ];
    }

    private static function getSupportedHeaders(): array
    {
        return [
            "Authorization" => "Bearer {access_token}",
            "Content-Type" => "application/json",
            "Accept" => "application/json"
        ];
    }

    public function getDetails(): array
    {
        return self::getApiInfo();
    }
}
