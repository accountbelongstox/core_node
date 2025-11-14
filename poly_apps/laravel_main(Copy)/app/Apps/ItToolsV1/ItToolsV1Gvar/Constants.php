<?php

namespace App\Apps\ItToolsV1\ItToolsV1Gvar;

class Constants
{
    public const API_VERSION = 'v1';
    public const APP_NAME = 'ItToolsV1';

    public const HASH_ALGORITHMS = ['md5', 'sha1', 'sha256', 'sha512'];
    public const ENCRYPTION_ALGORITHMS = ['aes-256-cbc', 'aes-192-cbc', 'aes-128-cbc'];

    public const CHARSET_ALPHANUMERIC = 'alphanumeric';
    public const CHARSET_ALPHABETIC = 'alphabetic';
    public const CHARSET_NUMERIC = 'numeric';
    public const CHARSET_LOWERCASE = 'lowercase';
    public const CHARSET_UPPERCASE = 'uppercase';
    public const CHARSET_HEX = 'hex';

    public const QR_ERROR_LEVEL_LOW = 'L';
    public const QR_ERROR_LEVEL_MEDIUM = 'M';
    public const QR_ERROR_LEVEL_QUARTILE = 'Q';
    public const QR_ERROR_LEVEL_HIGH = 'H';

    public const RATE_LIMIT_MAX = 100;
    public const RATE_LIMIT_WINDOW = 60;

    public const ERR_INVALID_INPUT = 'INVALID_INPUT';
    public const ERR_PROCESSING_ERROR = 'PROCESSING_ERROR';
    public const ERR_UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT';
    public const ERR_RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED';
}
