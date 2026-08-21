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
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TranslationEventModel;
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
        $artifact = $this->writeAudioArtifact($articleId, $language, $audioBase64);

        return $artifact['url'] ?? null;
    }

    private function writeAudioArtifact(string $articleId, string $language, string $audioBase64): ?array
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

        return [
            'url' => '/static/app_qy_v1/audio/daily/'
                . rawurlencode($languageCode)
                . '/'
                . rawurlencode($filename),
            'sha256' => hash('sha256', $binary),
        ];
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
        $audioRebuiltAt = null;
        $eventIdentity = '';
        $article = AppQyV1Article::resolveCanonicalArticle($article);
        $artifact = $this->writeAudioArtifact(
            (string) $article->article_id,
            (string) $article->language,
            $audioBase64
        );
        if ($artifact === null) {
            return null;
        }

        AppQyV1Article::mutateMetadataByArticleId(
            (string) $article->article_id,
            static function (array $metadata, AppQyV1Article $lockedArticle) use (
                $artifact,
                $provenance,
                &$audioRebuiltAt
            ): array {
                $previousHash = (string) ($metadata['audio_sha256'] ?? '');
                $audioChanged = $previousHash === '' || !hash_equals($previousHash, $artifact['sha256']);
                $audioFiles = is_array($metadata['audio_files'] ?? null) ? $metadata['audio_files'] : [];
                $isRebuild = ($provenance['audio_rebuild'] ?? false) === true;

                $metadata['audio_url'] = $artifact['url'];
                $metadata['audio_status'] = 'ready';
                $metadata['audio_sha256'] = $artifact['sha256'];
                $metadata['tts_engine'] = $provenance['tts_engine'] ?? ($metadata['tts_engine'] ?? null);
                $metadata['tts_model'] = $provenance['tts_model'] ?? ($metadata['tts_model'] ?? null);
                $metadata['tts_chunked'] = (bool) ($provenance['tts_chunked'] ?? false);
                $metadata['tts_accent'] = $provenance['tts_accent'] ?? ($metadata['tts_accent'] ?? null);
                if (is_string($provenance['source_record_id'] ?? null)
                    && trim($provenance['source_record_id']) !== '') {
                    $metadata['source_record_id'] = trim($provenance['source_record_id']);
                    $metadata['idempotency_key_hash'] = hash('sha256', $metadata['source_record_id']);
                }

                if ($audioChanged || !isset($audioFiles[0]) || !is_array($audioFiles[0])) {
                    $metadata['audio_replaced_at'] = now()->toIso8601String();
                    $audioFiles[0] = [
                        'sentence' => (string) $lockedArticle->content,
                        'path' => $artifact['url'],
                        'created_at' => now()->toIso8601String(),
                    ];
                }
                if ($isRebuild) {
                    if ($audioChanged || trim((string) ($metadata['audio_rebuilt_at'] ?? '')) === '') {
                        $metadata['audio_rebuilt_at'] = now()->toIso8601String();
                    }
                    $audioRebuiltAt = (string) $metadata['audio_rebuilt_at'];
                }
                $metadata['audio_files'] = array_values($audioFiles);

                return $metadata;
            }
        );

        $eventIdentity = (string) $article->article_id
            . ':' . $artifact['sha256']
            . (($provenance['audio_rebuild'] ?? false) === true ? ':rebuild' : ':publish');
        AppQyV1TranslationEventModel::emitOnce(
            AppQyV1TranslationEventModel::EVENT_ARTICLE_AUDIO_READY,
            $eventIdentity,
            [
                'article_id' => (string) $article->article_id,
                'audio_url' => $artifact['url'],
                'tts_engine' => $provenance['tts_engine'] ?? null,
                'tts_model' => $provenance['tts_model'] ?? null,
                'tts_chunked' => (bool) ($provenance['tts_chunked'] ?? false),
                'audio_rebuilt_at' => $audioRebuiltAt,
            ]
        );

        return $artifact['url'];
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
