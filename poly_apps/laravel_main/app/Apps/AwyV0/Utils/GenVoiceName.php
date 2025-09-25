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


namespace App\Apps\AwyV0\Utils;


class GenVoiceName
{
    /**
     * Generate consistent MD5 hash (matches Node.js behavior)
     */
    protected static function generateMd5(string $content): string
    {
        return md5($content);
    }

    /**
     * Generate GB English normal audio filename
     */
    public static function generateGbNormalName(string $content, ?string $md5 = null): string
    {
        $md5 = $md5 ?? static::generateMd5($content);
        $content = strtoupper($content);
        return "gb_{$md5}_{$content}_normal.mp3";
    }

    /**
     * Generate US English normal audio filename
     */
    public static function generateUsNormalName(string $content, ?string $md5 = null): string
    {
        $md5 = $md5 ?? static::generateMd5($content);
        $content = strtoupper($content);
        return "us_{$md5}_{$content}_normal.mp3";
    }

    /**
     * Generate UK English audio filename
     */
    public static function generateUkName(string $content, ?string $md5 = null): string
    {
        $md5 = $md5 ?? static::generateMd5($content);
        return "{$content}_{$md5}_UK.mp3";
    }

    /**
     * Generate US English audio filename
     */
    public static function generateUsName(string $content, ?string $md5 = null): string
    {
        $md5 = $md5 ?? static::generateMd5($content);
        return "{$content}_{$md5}_US.mp3";
    }

    /**
     * Generate TTS audio filename
     */
    public static function generateTtsName(string $content, ?string $md5 = null): string
    {
        $md5 = $md5 ?? static::generateMd5($content);
        return "{$content}_tts_{$md5}.mp3";
    }
}