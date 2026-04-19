<?php

namespace App\Constants;

/**
 * Auth API error codes for login/register.
 * Used by LoginController and frontend for consistent, localizable messages.
 */
final class AuthErrorCodes
{
    public const AUTH_USER_NOT_FOUND = 'AUTH_USER_NOT_FOUND';
    public const AUTH_INVALID_PASSWORD = 'AUTH_INVALID_PASSWORD';
    public const AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS';
    public const AUTH_VALIDATION_FAILED = 'AUTH_VALIDATION_FAILED';

    /**
     * Default English message for each code (backend fallback; frontend uses i18n).
     */
    public static function getMessage(string $code): string
    {
        $messages = [
            self::AUTH_USER_NOT_FOUND => 'Account does not exist. Please check your username or email.',
            self::AUTH_INVALID_PASSWORD => 'Incorrect password. Please try again.',
            self::AUTH_INVALID_CREDENTIALS => 'Invalid credentials. Please check and try again.',
            self::AUTH_VALIDATION_FAILED => 'Invalid request. Username and password are required.',
        ];

        return $messages[$code] ?? 'Authentication failed';
    }
}
