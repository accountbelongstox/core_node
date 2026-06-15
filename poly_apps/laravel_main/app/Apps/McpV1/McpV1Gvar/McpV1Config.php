<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

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

