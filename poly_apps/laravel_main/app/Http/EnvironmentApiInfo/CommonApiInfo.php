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

/**
 * CommonApiInfo Class
 * 
 * Provides API information for common routes (auth.php and system.php)
 * These are shared Laravel authentication and system management APIs
 * 
 * STANDARD FEATURE FORMAT SPECIFICATION - MUST BE FOLLOWED BY ALL FILES
 * 
 * Format: auth_type/method|description|controller|params:param_list|headers:header_list|response:response_list|tags:tag_list
 * 
 * MANDATORY COMPONENTS (must be present in all feature strings):
 * 1. auth_type/method - Authentication requirement and HTTP method
 * 2. description - Human readable API description
 * 3. controller - Controller class handling the request
 * 
 * OPTIONAL COMPONENTS (use only when applicable):
 * 4. params:param_list - Request parameters
 * 5. headers:header_list - Required headers
 * 6. response:response_list - Expected response fields
 * 7. tags:tag_list - API categorization tags
 * 
 * DETAILED SPECIFICATION:
 * 
 * auth_type:
 * - no_auth_required: No authentication needed
 * - auth_required: Standard authentication required
 * - auth_required:middleware_name: Specific middleware authentication
 * 
 * method:
 * - GET, POST, PUT, DELETE, PATCH, ANY
 * 
 * params format: param_name(type,requirement,example)
 * - type: string, int, boolean, array, file, email, date, float, object
 * - requirement: required, optional
 * - example: sample value for testing (optional)
 * 
 * headers format: header_name(type,requirement,example)
 * - Same format as params
 * 
 * response format: field_name(type,description)
 * - type: string, int, boolean, array, object
 * - description: brief field description (optional)
 * 
 * tags format: tag1,tag2,tag3
 * - Categories: auth, user, admin, system, dict, chat, device, friend
 * 
 * EXAMPLES:
 * Standard auth: "auth_required/POST|Create user group|DictV1GroupController|params:name(string,required,My Group),description(string,optional,Group desc)|headers:Auth-Token(string,required,user-token-123)|response:group_id(int),success(boolean)|tags:dict,user"
 * 
 * No auth: "no_auth_required/POST|User registration|RegisterController|params:email(string,required,user@example.com),password(string,required,password123)|response:user(object),token(string)|tags:auth"
 * 
 * Simple: "auth_required/GET|Get user profile|UserController|headers:Authorization(string,required)|response:user(object)|tags:user"
 * 
 * ALL ApiInfo CLASSES MUST FOLLOW THIS SPECIFICATION EXACTLY
 */
class CommonApiInfo
{
    /**
     * Get common API information for auth and system routes
     * 
     * Returns structured API information including endpoints with detailed feature strings
     * that can be parsed by the API Testing Dashboard for automatic parameter generation
     *
     * @return array Structured API information with endpoints, headers, and authentication details
     */
    public function getDetails(): array
    {
        return [
            'section_name' => 'Common APIs',
            'description' => 'Shared authentication and system management APIs',
            'base_url' => url('/api'),
            'endpoints' => $this->getCommonEndpoints(),
            'supported_headers' => $this->getSupportedHeaders(),
            'authentication' => [
                'type' => 'sanctum_based',
                'description' => 'Uses Laravel Sanctum for authentication'
            ]
        ];
    }

    /**
     * Get common API endpoints based on actual routes
     * 
     * Each endpoint contains a 'feature' string that follows this format:
     * auth_type/method|description|controller|params:param_name(type,required/optional)|headers:header_name(type,required/optional)|response:field1,field2
     * 
     * The feature string is parsed by the API Testing Dashboard JavaScript to:
     * 1. Extract authentication requirements
     * 2. Determine HTTP method  
     * 3. Generate automatic parameter JSON based on params section
     * 4. Show required headers
     * 5. Display expected response format
     * 
     * Parameter Types Supported:
     * - string: Text value
     * - int: Integer number
     * - boolean: true/false
     * - array: List of values
     * - file: File upload
     * - email: Email address format
     * 
     * @return array Array of endpoint definitions with path and feature strings
     */
    private function getCommonEndpoints(): array
    {
        $baseUrl = url('/api');
        
        return [
            // Authentication routes (from auth.php)
            [
                'path' => $baseUrl . '/register',
                'feature' => 'no_auth_required/POST|User registration|RegisteredUserController|params:name(string,required,John Doe),email(string,required,user@example.com),password(string,required,password123),password_confirmation(string,required,password123)|response:user(object,User data),token(string,Access token)|tags:auth'
            ],
            [
                'path' => $baseUrl . '/login',
                'feature' => 'no_auth_required/ANY|User login|LoginController|params:email(string,optional,user@example.com),password(string,optional,password123)|response:user(object,User data),token(string,Access token),token_type(string,Token type)|tags:auth'
            ],
            [
                'path' => $baseUrl . '/logout',
                'feature' => 'auth_required/ANY|User logout|LoginController|headers:Authorization(string,required,Bearer token123)|response:message(string,Success message)|tags:auth'
            ],
            [
                'path' => $baseUrl . '/user',
                'feature' => 'auth_required/ANY|Get authenticated user|inline_function|headers:Authorization(string,required,Bearer token123)|response:user(object,User profile data)|tags:auth,user'
            ],
            [
                'path' => $baseUrl . '/forgot-password',
                'feature' => 'no_auth_required/POST|Send password reset link|PasswordResetLinkController|params:email(string,required,user@example.com)|response:message(string,Reset link sent)|tags:auth'
            ],
            [
                'path' => $baseUrl . '/reset-password',
                'feature' => 'no_auth_required/POST|Reset password|NewPasswordController|params:email(string,required,user@example.com),token(string,required,reset-token-123),password(string,required,newpassword123),password_confirmation(string,required,newpassword123)|response:message(string,Password reset success)|tags:auth'
            ],
            [
                'path' => $baseUrl . '/verify-email/{id}/{hash}',
                'feature' => 'auth_required/GET|Verify email address|VerifyEmailController|headers:Authorization(string,required,Bearer token123)|params:id(int,required,123),hash(string,required,verification-hash)|response:message(string,Email verified)|tags:auth'
            ],
            [
                'path' => $baseUrl . '/email/verification-notification',
                'feature' => 'auth_required/POST|Resend email verification|EmailVerificationNotificationController|headers:Authorization(string,required,Bearer token123)|response:message(string,Verification sent)|tags:auth'
            ],

            // System routes (from system.php)
            [
                'path' => $baseUrl . '/get_system_status',
                'feature' => 'no_auth_required/ANY|Get system status|StatusController|response:status(string,System status),version(string,App version),environment(string,Environment),uptime(string,Server uptime)|tags:system'
            ],
            [
                'path' => $baseUrl . '/store_session',
                'feature' => 'no_auth_required/POST|Store session data|TokenSessionController|params:session_data(object,required,{"key":"value"}),token(string,optional,session-token-123)|response:session_id(string,Session ID),success(boolean,Operation success)|tags:system'
            ],
            [
                'path' => $baseUrl . '/retrieve_session',
                'feature' => 'no_auth_required/GET|Retrieve session data|TokenSessionController|params:session_id(string,required,session-123)|response:session_data(object,Session data)|tags:system'
            ],
            [
                'path' => $baseUrl . '/broadcast_session',
                'feature' => 'no_auth_required/POST|Broadcast session to clients|TokenSessionController|params:session_id(string,required,session-123),broadcast_data(object,required,{"message":"hello"})|response:broadcast_status(string,Broadcast status)|tags:system'
            ]
        ];
    }

    /**
     * Get supported headers for common APIs
     *
     * @return array
     */
    private function getSupportedHeaders(): array
    {
        return [
            'Authorization' => 'Bearer token for Sanctum authentication',
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
            'X-Requested-With' => 'XMLHttpRequest'
        ];
    }
}