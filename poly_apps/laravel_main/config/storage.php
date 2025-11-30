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

$wwwRoot = str_starts_with(PHP_OS, 'WIN') ? 'D:\www\wwwroot' : '/www/wwwroot';
$laravelPublicPath = $wwwRoot . '/laravel_main';

return [

    /*
    |--------------------------------------------------------------------------
    | Global External Storage Configuration
    |--------------------------------------------------------------------------
    |
    | This configuration allows you to define external storage paths that
    | are outside of the Laravel application directory. This is useful
    | for storing large files that should not be included in code
    | deployments or version control.
    |
    */

    'external' => [

        /*
        |--------------------------------------------------------------------------
        | Base Path Configuration
        |--------------------------------------------------------------------------
        |
        | Base path for all external storage directories.
        | Set to null to use hardcoded defaults.
        |
        */

        'base_path' => [
            'windows' => $wwwRoot,
            'linux' => $wwwRoot,
        ],

        /*
        |--------------------------------------------------------------------------
        | Upload Directory
        |--------------------------------------------------------------------------
        |
        | Path for storing uploaded files outside the application directory.
        | This prevents large files from being included in deployments.
        |
        */

        'upload' => [
            'windows' => $laravelPublicPath . '\uploads',
            'linux' => $laravelPublicPath . '/uploads',
        ],

        /*
        |--------------------------------------------------------------------------
        | Static Files Directory
        |--------------------------------------------------------------------------
        |
        | Path for storing static files (images, documents, etc.) outside
        | the application directory.
        |
        */

        'static' => [
            'windows' => $laravelPublicPath . '\static',
            'linux' => $laravelPublicPath . '/static',
        ],

        /*
        |--------------------------------------------------------------------------
        | Backup Directory
        |--------------------------------------------------------------------------
        |
        | Path for storing backup files outside the application directory.
        |
        */

        'backup' => [
            'windows' => $laravelPublicPath . '\backups',
            'linux' => $laravelPublicPath . '/backups',
        ],

        /*
        |--------------------------------------------------------------------------
        | Cache Directory
        |--------------------------------------------------------------------------
        |
        | Path for storing cache files outside the application directory.
        |
        */

        'cache' => [
            'windows' => $laravelPublicPath . '\cache',
            'linux' => $laravelPublicPath . '/cache',
        ],

        /*
        |--------------------------------------------------------------------------
        | Updates Directory
        |--------------------------------------------------------------------------
        |
        | Path for storing update files outside the application directory.
        |
        */

        'updates' => [
            'windows' => $laravelPublicPath . '\updates',
            'linux' => $laravelPublicPath . '/updates',
        ],

        /*
        |--------------------------------------------------------------------------
        | Logs Directory
        |--------------------------------------------------------------------------
        |
        | Path for storing log files outside the application directory.
        |
        */

        'logs' => [
            'windows' => $laravelPublicPath . '\logs',
            'linux' => $laravelPublicPath . '/logs',
        ],

        /*
        |--------------------------------------------------------------------------
        | Temp Directory
        |--------------------------------------------------------------------------
        |
        | Path for storing temporary files outside the application directory.
        |
        */

        'temp' => [
            'windows' => $laravelPublicPath . '\temp',
            'linux' => $laravelPublicPath . '/temp',
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Auto Create Directories
    |--------------------------------------------------------------------------
    |
    | Whether to automatically create external directories if they don't exist.
    |
    */

    'auto_create' => env('EXTERNAL_STORAGE_AUTO_CREATE', true),

    /*
    |--------------------------------------------------------------------------
    | Directory Permissions
    |--------------------------------------------------------------------------
    |
    | Default permissions for created directories.
    |
    */

    'permissions' => [
        'directory' => 0755,
        'file' => 0644,
    ],

]; 