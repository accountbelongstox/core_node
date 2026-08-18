<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleModel as AppQyV1Article;
use App\Providers\PathMapper;
use App\Utils\FileSystemManager;

class AppQyV1DailyReadingService
{
    private AppQyV1DailyReadingDocumentService $documentService;

    private AppQyV1ArticleManagementService $articleManagementService;

    public function __construct(
        AppQyV1DailyReadingDocumentService $documentService,
        AppQyV1ArticleManagementService $articleManagementService
    ) {
        $this->documentService = $documentService;
        $this->articleManagementService = $articleManagementService;
    }

    public function list(int $limit = 30, int $offset = 0): array
    {
        return $this->articleManagementService->list($limit, $offset, 'daily');
    }

    public function storeAudio(string $articleId, string $language, string $audioBase64): ?string
    {
        $binary = null;
        $languageCode = '';
        $safeId = '';
        $filename = '';
        $directory = '';
        $path = '';

        $binary = base64_decode($audioBase64, true);
        if ($binary === false || strlen($binary) < 128) {
            return null;
        }

        $languageCode = AppQyV1TableMaps::normalizeLangCode($language);
        $languageCode = $languageCode !== '' ? $languageCode : 'en';
        $safeId = preg_replace('/[^A-Za-z0-9._-]/', '_', $articleId) ?: 'article';
        $filename = $safeId . '.mp3';
        $directory = PathMapper::getAppQyV1AudioBaseDir('daily/' . $languageCode);
        $path = $directory . DIRECTORY_SEPARATOR . $filename;

        if (!FileSystemManager::writeFile($path, $binary)) {
            return null;
        }

        return '/static/app_qy_v1/audio/daily/'
            . rawurlencode($languageCode)
            . '/'
            . rawurlencode($filename);
    }

    /**
     * Replace the published audio of an existing agent-history article.
     *
     * The audio path is deterministic (<article_id>.mp3), so writing through
     * storeAudio() replaces the bytes in place and the public URL stays
     * stable; only the provenance metadata moves.
     */
    public function replaceAudio(AppQyV1Article $article, string $audioBase64, array $provenance = []): ?string
    {
        $audioUrl = $this->storeAudio($article->article_id, (string) $article->language, $audioBase64);
        if ($audioUrl === null) {
            return null;
        }

        $metadata = is_array($article->metadata) ? $article->metadata : [];
        $metadata['audio_url'] = $audioUrl;
        $metadata['audio_status'] = 'ready';
        $metadata['audio_replaced_at'] = now()->toDateTimeString();
        $metadata['tts_engine'] = $provenance['tts_engine'] ?? ($metadata['tts_engine'] ?? null);
        $metadata['tts_model'] = $provenance['tts_model'] ?? ($metadata['tts_model'] ?? null);
        $metadata['tts_chunked'] = (bool) ($provenance['tts_chunked'] ?? false);
        if (isset($metadata['audio_files'][0]) && is_array($metadata['audio_files'][0])) {
            $metadata['audio_files'][0]['path'] = $audioUrl;
            $metadata['audio_files'][0]['created_at'] = now()->toDateTimeString();
        }
        $article->metadata = $metadata;
        $article->save();

        return $audioUrl;
    }

    public function createDocument(
        AppQyV1Article $article,
        string $articleText,
        ?string $referenceCn,
        string $language
    ): ?int {
        return $this->documentService->createForWorkerArticle(
            $article,
            $articleText,
            $referenceCn,
            $language
        );
    }

}
