<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
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
        // Use actual Laravel base path instead of hardcoded path
        $laravelBasePath = base_path();
        return $laravelBasePath . '/laravel_db';
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