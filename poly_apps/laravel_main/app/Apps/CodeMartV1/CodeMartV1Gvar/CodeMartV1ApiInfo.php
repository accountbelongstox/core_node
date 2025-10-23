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

namespace App\Apps\CodeMartV1\CodeMartV1Gvar;

class CodeMartV1ApiInfo
{
    public static function getApiInfo(): array
    {
        return [
            'app_name' => 'CodeMartV1',
            'app_version' => '1.0.0',
            'description' => 'CodeMart Platform - Developer Project Marketplace',
            'supported_headers' => [
                'X-App-Namespace' => 'codemart',
                'Authorization' => 'Bearer {token}',
                'Content-Type' => 'application/json',
            ],
            'apis' => [
                'auth' => [
                    'register' => [
                        'method' => 'POST',
                        'path' => '/api/codemart/v1/auth/register',
                        'requires_auth' => false,
                        'description' => 'Register new user account',
                        'parameters' => [
                            'username' => 'string|required|unique',
                            'email' => 'string|required|email|unique',
                            'password' => 'string|required|min:8|confirmed',
                            'real_name' => 'string|required',
                            'role_type' => 'enum:developer,client|required',
                        ],
                        'response_format' => 'json',
                    ],
                    'verify_email' => [
                        'method' => 'POST',
                        'path' => '/api/codemart/v1/auth/verify-email',
                        'requires_auth' => false,
                        'description' => 'Verify email address with token',
                        'parameters' => [
                            'email' => 'string|required|email',
                            'token' => 'string|required',
                        ],
                        'response_format' => 'json',
                    ],
                    'request_phone_verification' => [
                        'method' => 'POST',
                        'path' => '/api/codemart/v1/auth/request-phone-verification',
                        'requires_auth' => true,
                        'description' => 'Request OTP code for phone verification',
                        'parameters' => [
                            'phone' => 'string|required|regex:/^[0-9]{10,15}$/',
                        ],
                        'response_format' => 'json',
                    ],
                    'verify_phone_otp' => [
                        'method' => 'POST',
                        'path' => '/api/codemart/v1/auth/verify-phone-otp',
                        'requires_auth' => true,
                        'description' => 'Verify phone number with OTP code',
                        'parameters' => [
                            'otp_code' => 'string|required|regex:/^[0-9]{6}$/',
                        ],
                        'response_format' => 'json',
                    ],
                    'upload_kyc_documents' => [
                        'method' => 'POST',
                        'path' => '/api/codemart/v1/auth/upload-kyc-documents',
                        'requires_auth' => true,
                        'description' => 'Upload KYC verification documents',
                        'parameters' => [
                            'identity_type' => 'enum:ID_CARD,PASSPORT,DRIVING_LICENSE|required',
                            'identity_number' => 'string|required|unique',
                            'real_name' => 'string|required',
                            'date_of_birth' => 'date|required',
                            'id_front_image' => 'file|image|required',
                            'id_back_image' => 'file|image|required_if:identity_type,ID_CARD',
                            'selfie_image' => 'file|image|required',
                        ],
                        'response_format' => 'json',
                    ],
                    'registration_status' => [
                        'method' => 'GET',
                        'path' => '/api/codemart/v1/auth/registration-status',
                        'requires_auth' => true,
                        'description' => 'Get current registration status',
                        'parameters' => [],
                        'response_format' => 'json',
                    ],
                ],
            ],
        ];
    }
}
