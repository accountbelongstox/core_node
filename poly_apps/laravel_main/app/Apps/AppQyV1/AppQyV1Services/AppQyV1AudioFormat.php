<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

class AppQyV1AudioFormat
{
    public static function extension(string $bytes, ?string $mime = null): ?string
    {
        if (AppQyV1DictionaryTTSCoordinator::looksLikeMp3($bytes)) {
            return 'mp3';
        }
        if (strlen($bytes) >= 12
            && substr($bytes, 0, 4) === 'RIFF'
            && substr($bytes, 8, 4) === 'WAVE') {
            return 'wav';
        }
        if (str_starts_with($bytes, 'OggS')) {
            return 'ogg';
        }
        if (str_starts_with($bytes, 'fLaC')) {
            return 'flac';
        }

        return null;
    }
}
