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

