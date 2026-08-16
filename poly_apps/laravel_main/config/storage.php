<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

use App\Providers\PathMapper;

$wwwRoot = PathMapper::getWwwRoot();
$uploadsPath = PathMapper::getLaravelUploadsDir();
$staticPath = PathMapper::getLaravelStaticDir();
$backupPath = PathMapper::getLaravelDataDir('backups');
$cachePath = PathMapper::getLaravelCacheDir();
$updatesPath = PathMapper::getLaravelDataDir('updates');
$logsPath = PathMapper::getLaravelLogsDir();
$tempPath = PathMapper::getLaravelTmpDir();

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
            'windows' => $uploadsPath,
            'linux' => $uploadsPath,
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
            'windows' => $staticPath,
            'linux' => $staticPath,
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
            'windows' => $backupPath,
            'linux' => $backupPath,
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
            'windows' => $cachePath,
            'linux' => $cachePath,
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
            'windows' => $updatesPath,
            'linux' => $updatesPath,
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
            'windows' => $logsPath,
            'linux' => $logsPath,
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
            'windows' => $tempPath,
            'linux' => $tempPath,
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

    'auto_create' => true,

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
