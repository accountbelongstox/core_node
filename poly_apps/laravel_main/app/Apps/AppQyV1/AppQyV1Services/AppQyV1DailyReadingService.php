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
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1Article;
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
