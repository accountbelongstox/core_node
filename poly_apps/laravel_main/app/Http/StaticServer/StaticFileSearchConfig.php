<?php

namespace App\Http\StaticServer;

final class StaticFileSearchConfig
{
    public const EXCLUDED_DIRECTORIES = [
        '.git',
        'node_modules',
        'vendor',
        'storage',
        'tests',
        '.idea',
        '.vscode',
    ];

    public const EXCLUDED_EXTENSIONS = [
        '.exe',
        '.dll',
        '.so',
        '.dylib',
        '.zip',
        '.db',
        '.sqlite',
    ];

    public const SEARCH_RULES = [
        'skipDirectories' => [
            'node_modules',
            'vendor',
            '.git',
            'storage',
            'public/build',
            'public/hot',
            'bootstrap/cache',
            '.idea',
            '.vscode',
            '__pycache__',
            'dist',
            'build',
            'coverage',
            '.backup',
            '.cache',
            '.out',
            '.log',
            '.tmp',
            '.pid',
        ],
        'skipFiles' => [
            '.DS_Store',
            'Thumbs.db',
            '.gitignore',
            '.env',
            '*.log',
            '*.lock',
            '*.cache',
            '*.pid',
            '*.out',
            '*.tmp',
            '*.backup',
            '*.jpg',
            '*.jpeg',
            '*.png',
            '*.gif',
            '*.bmp',
            '*.svg',
            '*.webp',
            '*.tiff',
            '*.ico',
            '*.mp4',
            '*.mkv',
            '*.avi',
            '*.mov',
            '*.flv',
            '*.wmv',
            '*.webm',
            '*.mpg',
            '*.mpeg',
            '*.3gp',
            '*.mp3',
            '*.wav',
            '*.aac',
            '*.flac',
            '*.ogg',
            '*.m4a',
            '*.wma',
            '*.alac',
            '*.aiff',
        ],
        'supportedExtensions' => ['txt', 'md', 'markdown'],
    ];

    public const MAX_EDITABLE_FILE_SIZE = 10 * 1024 * 1024;
    public const MAX_SEARCHABLE_FILE_SIZE = 5 * 1024 * 1024;
    public const SEARCH_TIMEOUT_SECONDS = 30;
}
