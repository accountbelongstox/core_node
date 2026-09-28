<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleLibraryModel;
use App\Services\EdgeTTS\EdgeTTSService;
use App\Utils\FileSystemManager;

class AppQyV1ArticleAudioWriteback
{
    private EdgeTTSService $ttsService;

    public function __construct(?EdgeTTSService $ttsService = null)
    {
        $this->ttsService = $ttsService ?: new EdgeTTSService();
    }

    public function store(
        string $langCode,
        string $md5,
        string $bytes,
        string $providerLabel,
        ?string $mime = null
    ): bool {
        $article = AppQyV1ArticleLibraryModel::findByMd5($langCode, $md5);
        if (!$article) {
            return false;
        }
        if (!empty($article->has_audio) && !empty($article->audio_files)) {
            return true;
        }

        $extension = AppQyV1AudioFormat::extension($bytes, $mime);
        if (strlen($bytes) < 100 || $extension === null) {
            return false;
        }

        $relativePath = $this->ttsService->buildRelativePath(
            $article->content,
            $langCode,
            'article',
            '+0%',
            ''
        );
        if ($extension !== 'mp3') {
            $relativePath = preg_replace('/\.mp3$/i', '.' . $extension, $relativePath)
                ?: ($relativePath . '.' . $extension);
        }
        $fullPath = $this->ttsService->getAudioBaseDir() . '/' . $relativePath;
        FileSystemManager::ensureDirectoryExists(dirname($fullPath));
        if (@file_put_contents($fullPath, $bytes) === false) {
            return false;
        }
        clearstatcache(true, $fullPath);
        if (!file_exists($fullPath) || filesize($fullPath) !== strlen($bytes)) {
            @unlink($fullPath);
            return false;
        }

        $article->audio_files = [[
            'sentence' => (string) $article->content,
            'path' => $relativePath,
            'created_at' => now()->toDateTimeString(),
        ]];
        $article->has_audio = true;
        $article->tts_provider = $providerLabel;
        $article->tts_status = AppQyV1DictionaryTTSCoordinator::STATUS_COMPLETED;
        $article->tts_completed_at = now();
        $article->tts_error = null;
        $article->tts_locked_at = null;
        $article->tts_locked_by = null;
        $article->saveRecord();

        return true;
    }
}
