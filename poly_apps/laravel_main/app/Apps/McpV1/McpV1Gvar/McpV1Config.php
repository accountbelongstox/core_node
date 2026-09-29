<?php

namespace App\Apps\McpV1\McpV1Gvar;

class McpV1Config
{
    public const SERVER_NAME = 'McpV1 Server';
    public const SERVER_VERSION = '1.0.0';
    public const SUPPORTED_IMAGE_FORMATS = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
    public const SUPPORTED_OPERATIONS = ['resize', 'crop', 'convert', 'quality', 'rotate', 'flip'];
    public const DEFAULT_QUALITY = 90;
    public const MAX_QUALITY = 100;
    public const MIN_QUALITY = 1;
}

