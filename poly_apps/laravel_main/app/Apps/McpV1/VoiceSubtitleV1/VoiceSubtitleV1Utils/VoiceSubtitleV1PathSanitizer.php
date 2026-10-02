<?php

namespace App\Apps\McpV1\VoiceSubtitleV1\VoiceSubtitleV1Utils;

use App\Providers\PathMapper;

/** Rewrites absolute file paths in queue items to paths relative to the Laravel database dir. */
final class VoiceSubtitleV1PathSanitizer
{
    private string $databaseDir;

    public function __construct()
    {
        $this->databaseDir = rtrim(PathMapper::getLaravelDatabaseDir(), DIRECTORY_SEPARATOR);
    }

    public function databaseDir(): string
    {
        return $this->databaseDir;
    }

    public function queueItem(?array $item): ?array
    {
        if (!$item) {
            return $item;
        }

        if (isset($item['tts_files']) && is_array($item['tts_files'])) {
            $item['tts_files'] = $this->ttsFiles($item['tts_files']);
        }

        if (isset($item['voice_file'])) {
            $item['voice_file'] = $this->relative($item['voice_file']);
        }

        if (isset($item['file_path'])) {
            $item['file_path'] = $this->relative($item['file_path']);
        }

        return $item;
    }

    public function relative(?string $path): ?string
    {
        if (!$path) {
            return $path;
        }

        $normalizedPath = str_replace('\\', '/', $path);
        $normalizedBase = str_replace('\\', '/', $this->databaseDir);

        if ($normalizedBase !== '' && str_starts_with($normalizedPath, $normalizedBase)) {
            $relative = ltrim(substr($normalizedPath, strlen($normalizedBase)), '/');
            return $relative === '' ? null : $relative;
        }

        return basename($path);
    }

    private function ttsFiles(array $files): array
    {
        return array_map(function ($file) {
            if (isset($file['file_path'])) {
                $file['file_path'] = $this->relative($file['file_path']);
            }

            if (isset($file['source_path'])) {
                $file['source_path'] = $this->relative($file['source_path']);
            }

            return $file;
        }, $files);
    }
}
