<?php

namespace App\Constants;

final class LaravelConfig
{
    public const APP_NAME = 'Core Node';
    public const APP_ENVIRONMENT = 'production';
    public const APP_DEBUG = false;
    public const APP_URL = 'http://127.0.0.1:9000';
    public const FRONTEND_URL = 'http://127.0.0.1';
    public const APP_TIMEZONE = 'UTC';
    public const APP_LOCALE = 'en';
    public const APP_FALLBACK_LOCALE = 'en';
    public const APP_FAKER_LOCALE = 'en_US';

    public const CACHE_STORE = 'database';
    public const CACHE_TABLE = 'cache';
    public const CACHE_LOCK_TABLE = 'cache_locks';
    public const CACHE_PREFIX = 'core-node-cache-';

    public const DATABASE_CONNECTION = 'main';
    public const DATABASE_HOST = '127.0.0.1';
    public const DATABASE_PORT = '5432';
    public const DATABASE_USERNAME = 'postgres';
    public const DATABASE_SEARCH_PATH = 'public';
    public const DATABASE_SSL_MODE = 'prefer';
    public const DATABASES = [
        'main' => 'core_node_main',
        'appqyv1' => 'app_qy_v1_database',
        'servermanagerv1' => 'server_manager_v1_database',
        'achatv1' => 'achat_v1_database',
        'codemartv1' => 'code_mart_v1_database',
        'mcpv1' => 'mcp_v1_database',
        'ittoolsv1' => 'it_tools_v1_database',
        'pddtoolv1' => 'pdd_tool_v1_database',
        'dingduoduov1' => 'ding_duo_duo_v1_database',
    ];

    public const REDIS_CLIENT = 'phpredis';
    public const REDIS_HOST = '127.0.0.1';
    public const REDIS_PORT = 6379;
    public const REDIS_PREFIX = 'core-node-database-';
    public const REDIS_DATABASE = 0;
    public const REDIS_CACHE_DATABASE = 1;
    public const REDIS_MAX_RETRIES = 3;
    public const REDIS_BACKOFF_ALGORITHM = 'decorrelated_jitter';
    public const REDIS_BACKOFF_BASE = 100;
    public const REDIS_BACKOFF_CAP = 1000;

    public const SESSION_DRIVER = 'database';
    public const SESSION_LIFETIME = 120;
    public const SESSION_COOKIE = 'core-node-session';
    public const SESSION_SERIALIZATION = 'json';

    public const QUEUE_CONNECTION = 'sync';

    private function __construct()
    {
    }
}
