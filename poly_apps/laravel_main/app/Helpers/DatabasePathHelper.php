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


namespace App\Helpers;

class DatabasePathHelper
{
    public static function getWwwRoot(): string
    {
        $wwwRoot = PHP_OS_FAMILY === 'Windows' 
            ? 'D:\wwwroot' 
            : '/www/wwwroot';
        return $wwwRoot;
    }

    public static function getLaravelPublicPath(): string
    {
        $wwwRoot = self::getWwwRoot();
        return $wwwRoot . '/laravel_main';
    }

    public static function getLaravelDatabaseDir(): string
    {
        $laravelPublicPath = self::getLaravelPublicPath();
        return $laravelPublicPath . '/laravel_db';
    }

    public static function getDefaultDatabasePath($databaseName = 'database.sqlite'): string
    {
        $defaultDatabasePath = env('DB_DATABASE');
        $laravelDatabaseDir = self::getLaravelDatabaseDir();
        if ($defaultDatabasePath == "" || $defaultDatabasePath == null) {
            $defaultDatabasePath = $laravelDatabaseDir;
        }
        if (!file_exists($defaultDatabasePath)) {
            mkdir($defaultDatabasePath, 0755, true);
        }
        return $defaultDatabasePath . '/' . $databaseName;
    }
} 