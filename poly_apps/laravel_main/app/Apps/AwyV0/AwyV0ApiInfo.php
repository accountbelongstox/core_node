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

namespace App\Apps\AwyV0;

use Illuminate\Support\Facades\File;
use App\Apps\AwyV0\AwyV0Gvar\AwyV0Gvar;
use App\Http\Common\CommonGvar;

/**
 * AwyV0ApiInfo Class
 * 
 * STANDARD FEATURE FORMAT SPECIFICATION - MUST FOLLOW CommonApiInfo.php
 * 
 * Format: auth_type/method|description|controller|params:param_list|headers:header_list|response:response_list|tags:tag_list
 * 
 * This class MUST use the same feature format as defined in CommonApiInfo.php
 * All feature strings must include examples in parameter definitions for automatic test generation
 * 
 * Parameter format: param_name(type,requirement,example)
 * Response format: field_name(type,description)
 * Tags: chat, user, friend, device, auth, social
 */
class AwyV0ApiInfo
{
    /**
     * Get API information for AwyV0 app
     *
     * @return array
     */
    public static function getApiInfo(): array
    {
        $apiVersion = 'v0';
        $appName = 'awy';
        $baseUrl = url('/api');
        $apiPrefix = $baseUrl . '/' . $appName;

        return [
            'app_name' => 'AwyV0',
            'api_version' => $apiVersion,
            'base_url' => $baseUrl,
            'api_prefix' => $apiPrefix,
            'endpoints' => self::getEndpoints($apiPrefix),
            'supported_headers' => self::getSupportedHeaders(),
            'authentication' => [
                'type' => 'token_based',
                'description' => 'Requires authentication token in header'
            ]
        ];
    }

    /**
     * Get enhanced API endpoints based on actual routes
     *
     * @param string $apiPrefix
     * @return array
     */
    private static function getEndpoints(string $apiPrefix): array
    {
        return [
            // Auth routes (from AwyV0Auth.php)
            [
                'path' => $apiPrefix . '-v0/auth/register',
                'feature' => 'no_auth_required/POST|User registration|AwyV0AuthCtl|params:username(string,required),email(string,required),password(string,required),name(string,optional)|response:user,token'
            ],
            [
                'path' => $apiPrefix . '-v0/auth/login',
                'feature' => 'no_auth_required/POST|User login|AwyV0AuthCtl|params:email(string,required),password(string,required)|response:user,token,token_type'
            ],
            [
                'path' => $apiPrefix . '-v0/auth/logout',
                'feature' => 'auth_required/POST|User logout|AwyV0AuthCtl|headers:Authorization(string,required)|response:message'
            ],
            [
                'path' => $apiPrefix . '-v0/auth/verify-email',
                'feature' => 'no_auth_required/POST|Verify email address|AwyV0AuthCtl|params:email(string,required),verification_code(string,required)|response:success(boolean),message'
            ],
            [
                'path' => $apiPrefix . '-v0/auth/forgot-password',
                'feature' => 'no_auth_required/POST|Send password reset email|AwyV0AuthCtl|params:email(string,required)|response:message'
            ],
            [
                'path' => $apiPrefix . '-v0/auth/reset-password',
                'feature' => 'no_auth_required/POST|Reset password|AwyV0AuthCtl|params:email(string,required),token(string,required),password(string,required)|response:message'
            ],

            // User routes (from AwyV0User.php)
            [
                'path' => $apiPrefix . '-v0/user/profile',
                'feature' => 'auth_required/GET|Get user profile|AwyV0UserCtl|headers:Authorization(string,required)|response:user'
            ],
            [
                'path' => $apiPrefix . '-v0/user/profile',
                'feature' => 'auth_required/PUT|Update user profile|AwyV0UserCtl|headers:Authorization(string,required)|params:name(string,optional),email(string,optional),bio(string,optional)|response:user'
            ],
            [
                'path' => $apiPrefix . '-v0/user/change-password',
                'feature' => 'auth_required/POST|Change user password|AwyV0UserCtl|headers:Authorization(string,required)|params:current_password(string,required),new_password(string,required)|response:success(boolean),message'
            ],
            [
                'path' => $apiPrefix . '-v0/user/bind-phone',
                'feature' => 'auth_required/POST|Bind phone number|AwyV0UserCtl|headers:Authorization(string,required)|params:phone(string,required),verification_code(string,required)|response:success(boolean)'
            ],
            [
                'path' => $apiPrefix . '-v0/user/bind-email',
                'feature' => 'auth_required/POST|Bind email address|AwyV0UserCtl|headers:Authorization(string,required)|params:email(string,required),verification_code(string,required)|response:success(boolean)'
            ],

            // Friend routes (from AwyV0Friend.php)
            [
                'path' => $apiPrefix . '-v0/friend/list',
                'feature' => 'auth_required/GET|Get friends list|AwyV0FriendCtl|headers:Authorization(string,required)|params:status(string,optional),limit(int,optional)|response:friends(array),total_count'
            ],
            [
                'path' => $apiPrefix . '-v0/friend/add',
                'feature' => 'auth_required/POST|Add friend|AwyV0FriendCtl|headers:Authorization(string,required)|params:friend_id(int,required),message(string,optional)|response:success(boolean),friendship_id'
            ],
            [
                'path' => $apiPrefix . '-v0/friend/remove',
                'feature' => 'auth_required/DELETE|Remove friend|AwyV0FriendCtl|headers:Authorization(string,required)|params:friend_id(int,required)|response:success(boolean)'
            ],
            [
                'path' => $apiPrefix . '-v0/friend/info',
                'feature' => 'auth_required/GET|Get friend information|AwyV0FriendCtl|headers:Authorization(string,required)|params:friend_id(int,required)|response:friend_info'
            ],
            [
                'path' => $apiPrefix . '-v0/friend/health',
                'feature' => 'auth_required/GET|Get friend health status|AwyV0FriendCtl|headers:Authorization(string,required)|params:friend_id(int,required)|response:health_status'
            ],

            // Device routes (from AwyV0Device.php)
            [
                'path' => $apiPrefix . '-v0/device/register',
                'feature' => 'auth_required/POST|Register new device|AwyV0DeviceCtl|headers:Authorization(string,required)|params:device_name(string,required),device_type(string,required),device_token(string,optional)|response:device_id,device_status'
            ],
            [
                'path' => $apiPrefix . '-v0/device/unregister',
                'feature' => 'auth_required/DELETE|Unregister device|AwyV0DeviceCtl|headers:Authorization(string,required)|params:device_id(int,required)|response:success(boolean)'
            ],
            [
                'path' => $apiPrefix . '-v0/device/list',
                'feature' => 'auth_required/GET|Get user devices|AwyV0DeviceCtl|headers:Authorization(string,required)|response:devices(array)'
            ],
            [
                'path' => $apiPrefix . '-v0/device/update',
                'feature' => 'auth_required/PUT|Update device information|AwyV0DeviceCtl|headers:Authorization(string,required)|params:device_id(int,required),device_name(string,optional),device_token(string,optional)|response:device'
            ],

            // Chat routes (from AwyV0Chat.php)
            [
                'path' => $apiPrefix . '-v0/chat/history/{friendId}',
                'feature' => 'auth_required/GET|Get chat history|AwyV0ChatCtl|headers:Authorization(string,required)|route_params:friendId(int,required)|params:limit(int,optional),offset(int,optional)|response:messages(array),pagination'
            ],
            [
                'path' => $apiPrefix . '-v0/chat/send',
                'feature' => 'auth_required/POST|Send chat message|AwyV0ChatCtl|headers:Authorization(string,required)|params:friend_id(int,required),message(string,required),message_type(string,optional)|response:message,message_id'
            ],
            [
                'path' => $apiPrefix . '-v0/chat/delete/{messageId}',
                'feature' => 'auth_required/DELETE|Delete chat message|AwyV0ChatCtl|headers:Authorization(string,required)|route_params:messageId(int,required)|response:success(boolean)'
            ],
            [
                'path' => $apiPrefix . '-v0/chat/read/{messageId}',
                'feature' => 'auth_required/PUT|Mark message as read|AwyV0ChatCtl|headers:Authorization(string,required)|route_params:messageId(int,required)|response:success(boolean)'
            ]
        ];
    }

    /**
     * Get supported headers using global constants
     *
     * @return array
     */
    private static function getSupportedHeaders(): array
    {
        return [
            'Authorization' => 'Bearer token for authentication',
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
            CommonGvar::ClientToken => 'Client identification token',
            CommonGvar::AuthUserToken => 'User authentication token'
        ];
    }

    /**
     * Get details method for compatibility with Index.php scanner
     *
     * @return array
     */
    public function getDetails(): array
    {
        return self::getApiInfo();
    }
}