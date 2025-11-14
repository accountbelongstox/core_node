<?php

namespace App\Apps\AChatV1\AChatV1Gvar;

/**
 * AChatV1 Global Configuration
 * 
 * Central configuration for AChat API
 */
class AChatV1Config
{
    /**
     * API base path
     */
    public const BASE_PATH = '/achat/v1';

    /**
     * API version
     */
    public const VERSION = '1.0.0';

    /**
     * JWT token settings
     */
    public const JWT_EXPIRATION = 3600; // 1 hour
    public const JWT_REFRESH_EXPIRATION = 604800; // 7 days

    /**
     * Pagination defaults
     */
    public const DEFAULT_PAGE_SIZE = 20;
    public const MAX_PAGE_SIZE = 100;

    /**
     * File upload settings
     */
    public const MAX_FILE_SIZE = 10485760; // 10MB
    public const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];

    /**
     * Message settings
     */
    public const MAX_MESSAGE_LENGTH = 5000;
    public const MAX_ATTACHMENTS_PER_MESSAGE = 5;

    /**
     * Group settings
     */
    public const MAX_GROUP_MEMBERS = 100;
    public const MIN_GROUP_NAME_LENGTH = 3;
    public const MAX_GROUP_NAME_LENGTH = 50;

    /**
     * Rate limiting
     */
    public const RATE_LIMIT_REQUESTS = 60;
    public const RATE_LIMIT_MINUTES = 1;

    /**
     * Cache settings
     */
    public const CACHE_TTL_CONVERSATIONS = 300; // 5 minutes
    public const CACHE_TTL_MESSAGES = 600; // 10 minutes
    public const CACHE_TTL_USER_PROFILE = 300; // 5 minutes

    /**
     * Session settings
     */
    public const SESSION_TIMEOUT = 3600; // 1 hour
    public const HEARTBEAT_INTERVAL = 30; // 30 seconds

    /**
     * Get all configuration as array
     */
    public static function all(): array
    {
        return [
            'base_path' => self::BASE_PATH,
            'version' => self::VERSION,
            'jwt' => [
                'expiration' => self::JWT_EXPIRATION,
                'refresh_expiration' => self::JWT_REFRESH_EXPIRATION,
            ],
            'pagination' => [
                'default' => self::DEFAULT_PAGE_SIZE,
                'max' => self::MAX_PAGE_SIZE,
            ],
            'upload' => [
                'max_size' => self::MAX_FILE_SIZE,
                'allowed_types' => self::ALLOWED_FILE_TYPES,
            ],
            'message' => [
                'max_length' => self::MAX_MESSAGE_LENGTH,
                'max_attachments' => self::MAX_ATTACHMENTS_PER_MESSAGE,
            ],
            'group' => [
                'max_members' => self::MAX_GROUP_MEMBERS,
                'name_min_length' => self::MIN_GROUP_NAME_LENGTH,
                'name_max_length' => self::MAX_GROUP_NAME_LENGTH,
            ],
            'rate_limit' => [
                'requests' => self::RATE_LIMIT_REQUESTS,
                'minutes' => self::RATE_LIMIT_MINUTES,
            ],
            'cache_ttl' => [
                'conversations' => self::CACHE_TTL_CONVERSATIONS,
                'messages' => self::CACHE_TTL_MESSAGES,
                'user_profile' => self::CACHE_TTL_USER_PROFILE,
            ],
            'session' => [
                'timeout' => self::SESSION_TIMEOUT,
                'heartbeat_interval' => self::HEARTBEAT_INTERVAL,
            ],
        ];
    }
}

