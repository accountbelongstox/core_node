<?php

namespace App\Apps\BankV1\BankV1Gvar;

class BankV1Config
{
    // App Configuration
    public const APP_NAME = 'BankV1';
    public const APP_VERSION = '1.0.0';
    public const API_VERSION = 'v1';
    public const API_PREFIX = '/api/bank';

    // Security Configuration
    public const JWT_TTL = 3600; // 1 hour in seconds
    public const REFRESH_TOKEN_TTL = 604800; // 7 days in seconds
    public const MAX_LOGIN_ATTEMPTS = 5;
    public const LOGIN_LOCKOUT_DURATION = 900; // 15 minutes in seconds
    
    // Device Security
    public const DEVICE_LOCK_ENABLED = true;
    public const MAX_DEVICES_PER_USER = 3;
    public const DEVICE_REGISTRATION_REQUIRED = true;
    public const DEVICE_SIGNATURE_VALIDATION = true;
    
    // Session Management
    public const SESSION_TIMEOUT = 1800; // 30 minutes in seconds
    public const HEARTBEAT_INTERVAL = 300; // 5 minutes in seconds
    public const MAX_CONCURRENT_SESSIONS = 2;
    
    // Logging Configuration
    public const LOG_APP_LIFECYCLE = true;
    public const LOG_USER_ACTIONS = true;
    public const LOG_SECURITY_EVENTS = true;
    public const LOG_API_REQUESTS = true;
    public const LOG_RETENTION_DAYS = 90;
    
    // Transaction Limits
    public const MAX_DAILY_TRANSFER_AMOUNT = 10000.00;
    public const MAX_SINGLE_TRANSFER_AMOUNT = 5000.00;
    public const MIN_TRANSFER_AMOUNT = 1.00;
    public const TRANSFER_FEE_PERCENTAGE = 0.01; // 1%
    public const MIN_TRANSFER_FEE = 1.00;
    public const MAX_TRANSFER_FEE = 50.00;
    
    // Account Configuration
    public const DEFAULT_ACCOUNT_BALANCE = 0.00;
    public const MIN_ACCOUNT_BALANCE = -1000.00; // Overdraft limit
    public const ACCOUNT_CURRENCY = 'USD';
    public const BALANCE_DECIMAL_PLACES = 2;
    
    // API Rate Limiting
    public const RATE_LIMIT_PER_MINUTE = 60;
    public const RATE_LIMIT_PER_HOUR = 1000;
    public const RATE_LIMIT_PER_DAY = 10000;
    
    // Cache Configuration
    public const CACHE_USER_PROFILE_TTL = 300; // 5 minutes
    public const CACHE_ACCOUNT_BALANCE_TTL = 60; // 1 minute
    public const CACHE_TRANSACTION_HISTORY_TTL = 180; // 3 minutes
    public const CACHE_DEVICE_STATUS_TTL = 300; // 5 minutes
    
    // Validation Rules
    public const USERNAME_MIN_LENGTH = 3;
    public const USERNAME_MAX_LENGTH = 50;
    public const PASSWORD_MIN_LENGTH = 8;
    public const PASSWORD_MAX_LENGTH = 128;
    public const FULL_NAME_MAX_LENGTH = 100;
    public const PHONE_MAX_LENGTH = 20;
    public const ADDRESS_MAX_LENGTH = 255;
    
    // Error Codes
    public const ERROR_CODES = [
        'INVALID_CREDENTIALS' => 'E001',
        'ACCOUNT_LOCKED' => 'E002',
        'DEVICE_NOT_REGISTERED' => 'E003',
        'DEVICE_LOCKED' => 'E004',
        'INSUFFICIENT_BALANCE' => 'E005',
        'TRANSFER_LIMIT_EXCEEDED' => 'E006',
        'INVALID_DEVICE_SIGNATURE' => 'E007',
        'SESSION_EXPIRED' => 'E008',
        'RATE_LIMIT_EXCEEDED' => 'E009',
        'INVALID_REGISTRATION_CODE' => 'E010',
        'USER_NOT_FOUND' => 'E011',
        'DUPLICATE_TRANSACTION' => 'E012',
        'INVALID_AMOUNT' => 'E013',
        'ACCOUNT_NOT_FOUND' => 'E014',
        'UNAUTHORIZED_ACCESS' => 'E015',
    ];
    
    // Success Messages
    public const SUCCESS_MESSAGES = [
        'LOGIN_SUCCESS' => 'Login successful',
        'LOGOUT_SUCCESS' => 'Logout successful',
        'REGISTRATION_SUCCESS' => 'Registration successful',
        'PROFILE_UPDATED' => 'Profile updated successfully',
        'BALANCE_UPDATED' => 'Balance updated successfully',
        'ADDRESS_UPDATED' => 'Address updated successfully',
        'TRANSFER_SUCCESS' => 'Transfer completed successfully',
        'PAYMENT_SUCCESS' => 'Payment completed successfully',
        'DEVICE_REGISTERED' => 'Device registered successfully',
        'CODE_APPLIED' => 'Registration code applied successfully',
    ];
    
    // Error Messages
    public const ERROR_MESSAGES = [
        'INVALID_CREDENTIALS' => 'Invalid username or password',
        'ACCOUNT_LOCKED' => 'Account is locked due to security reasons',
        'DEVICE_NOT_REGISTERED' => 'Device is not registered',
        'DEVICE_LOCKED' => 'Device is locked for security reasons',
        'INSUFFICIENT_BALANCE' => 'Insufficient account balance',
        'TRANSFER_LIMIT_EXCEEDED' => 'Transfer amount exceeds daily limit',
        'INVALID_DEVICE_SIGNATURE' => 'Invalid device signature',
        'SESSION_EXPIRED' => 'Session has expired',
        'RATE_LIMIT_EXCEEDED' => 'Rate limit exceeded, please try again later',
        'INVALID_REGISTRATION_CODE' => 'Invalid registration code',
        'USER_NOT_FOUND' => 'User not found',
        'DUPLICATE_TRANSACTION' => 'Duplicate transaction detected',
        'INVALID_AMOUNT' => 'Invalid transaction amount',
        'ACCOUNT_NOT_FOUND' => 'Account not found',
        'UNAUTHORIZED_ACCESS' => 'Unauthorized access',
        'VALIDATION_ERROR' => 'Validation error',
        'INTERNAL_ERROR' => 'Internal server error',
    ];
    
    // Device Status Types
    public const DEVICE_STATUS = [
        'ACTIVE' => 'active',
        'LOCKED' => 'locked',
        'SUSPENDED' => 'suspended',
        'PENDING' => 'pending',
        'REVOKED' => 'revoked',
    ];
    
    // Transaction Types
    public const TRANSACTION_TYPES = [
        'TRANSFER' => 'transfer',
        'PAYMENT' => 'payment',
        'DEPOSIT' => 'deposit',
        'WITHDRAWAL' => 'withdrawal',
        'FEE' => 'fee',
        'REFUND' => 'refund',
        'ADJUSTMENT' => 'adjustment',
    ];
    
    // Transaction Status
    public const TRANSACTION_STATUS = [
        'PENDING' => 'pending',
        'COMPLETED' => 'completed',
        'FAILED' => 'failed',
        'CANCELLED' => 'cancelled',
        'PROCESSING' => 'processing',
    ];
    
    // Log Event Types
    public const LOG_EVENT_TYPES = [
        'APP_OPEN' => 'app_open',
        'APP_CLOSE' => 'app_close',
        'LOGIN' => 'login',
        'LOGOUT' => 'logout',
        'PROFILE_UPDATE' => 'profile_update',
        'BALANCE_UPDATE' => 'balance_update',
        'ADDRESS_UPDATE' => 'address_update',
        'TRANSFER' => 'transfer',
        'PAYMENT' => 'payment',
        'DEVICE_REGISTER' => 'device_register',
        'DEVICE_LOCK' => 'device_lock',
        'SECURITY_CHECK' => 'security_check',
        'CODE_REGISTRATION' => 'code_registration',
    ];
    
    // Security Check Types
    public const SECURITY_CHECK_TYPES = [
        'ROUTINE' => 'routine_security_check',
        'LOGIN' => 'login_security_check',
        'TRANSACTION' => 'transaction_security_check',
        'DEVICE_VALIDATION' => 'device_validation_check',
        'SUSPICIOUS_ACTIVITY' => 'suspicious_activity_check',
    ];
    
    // Platform Types
    public const PLATFORM_TYPES = [
        'ANDROID' => 'android',
        'IOS' => 'ios',
        'WEB' => 'web',
        'WINDOWS' => 'windows',
        'MACOS' => 'macos',
        'LINUX' => 'linux',
    ];
    
    // Helper Methods
    public static function getErrorMessage(string $errorCode): string
    {
        return self::ERROR_MESSAGES[$errorCode] ?? self::ERROR_MESSAGES['INTERNAL_ERROR'];
    }
    
    public static function getSuccessMessage(string $successCode): string
    {
        return self::SUCCESS_MESSAGES[$successCode] ?? 'Operation completed successfully';
    }
    
    public static function getErrorCode(string $errorType): string
    {
        return self::ERROR_CODES[$errorType] ?? 'E999';
    }
    
    public static function isValidPlatform(string $platform): bool
    {
        return in_array($platform, array_values(self::PLATFORM_TYPES));
    }
    
    public static function isValidTransactionType(string $type): bool
    {
        return in_array($type, array_values(self::TRANSACTION_TYPES));
    }
    
    public static function isValidTransactionStatus(string $status): bool
    {
        return in_array($status, array_values(self::TRANSACTION_STATUS));
    }
    
    public static function isValidDeviceStatus(string $status): bool
    {
        return in_array($status, array_values(self::DEVICE_STATUS));
    }
    
    public static function calculateTransferFee(float $amount): float
    {
        $fee = $amount * self::TRANSFER_FEE_PERCENTAGE;
        $fee = max($fee, self::MIN_TRANSFER_FEE);
        $fee = min($fee, self::MAX_TRANSFER_FEE);
        return round($fee, self::BALANCE_DECIMAL_PLACES);
    }
    
    public static function formatAmount(float $amount): float
    {
        return round($amount, self::BALANCE_DECIMAL_PLACES);
    }
    
    public static function isValidAmount(float $amount): bool
    {
        return $amount >= self::MIN_TRANSFER_AMOUNT && 
               $amount <= self::MAX_SINGLE_TRANSFER_AMOUNT;
    }
}
