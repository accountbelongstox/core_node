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
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleWordModel as AppQyV1ArticleWord;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UploadedDocumentModel;
use App\Providers\PathMapper;
use App\Utils\FileSystemManager;
use RuntimeException;

class AppQyV1ArticleManagementService
{
    public function list(int $limit = 50, int $offset = 0, ?string $category = null): array
    {
        $query = null;
        $rows = null;
        $categoryRows = null;
        $items = [];
        $categories = [];
        $statistics = [];
        $total = 0;
        $rawTotal = 0;

        $limit = max(1, min($limit, 100));
        $offset = max(0, $offset);
        $category = $category !== null ? trim($category) : null;
        $page = AppQyV1Article::managementPage($category, $offset, $limit);
        $total = $page['total'];
        $rawTotal = $page['raw_total'];
        $statistics = $page['statistics'];
        $rows = $page['rows'];
        foreach ($rows as $row) {
            $items[] = $this->mapArticle($row);
        }

        $categoryRows = AppQyV1Article::managementCategoryRows();

        foreach ($categoryRows as $row) {
            $rowCategory = $this->categoryFromValues(
                $row->article_type,
                $row->source,
                (bool) $row->is_daily_reading
            );
            $categories[$rowCategory] = ($categories[$rowCategory] ?? 0) + (int) $row->aggregate;
        }
        ksort($categories);
        if ($category === 'daily') {
            $categories['daily'] = $total;
        }

        return [
            'items' => $items,
            'total' => $total,
            'raw_total' => $rawTotal,
            'limit' => $limit,
            'offset' => $offset,
            'categories' => $categories,
            'statistics' => $statistics,
        ];
    }

    public function mapArticle(AppQyV1Article $article): array
    {
        $metadata = [];
        $category = '';
        $audioUrl = null;
        $audioReady = false;
        $audioStatus = 'queued';
        $ttsChunked = false;
        $audioGenerationType = 'legacy';
        $sourceIdentity = null;
        $audioRebuiltAt = null;

        $metadata = is_array($article->metadata) ? $article->metadata : [];
        $category = $this->categoryFromValues(
            $article->article_type,
            $article->source,
            (bool) $article->is_daily_reading
        );
        $audioUrl = isset($metadata['audio_url']) && is_string($metadata['audio_url'])
            ? $metadata['audio_url']
            : null;
        $audioReady = $this->articleAudioExists($audioUrl);
        $audioStatus = $audioReady
            ? 'ready'
            : (is_string($metadata['audio_status'] ?? null) ? $metadata['audio_status'] : 'queued');
        $ttsChunked = ($metadata['tts_chunked'] ?? false) === true;
        $audioGenerationType = $ttsChunked ? 'multi_sentence' : 'legacy';
        $sourceIdentity = is_string($metadata['idempotency_key_hash'] ?? null)
            ? $metadata['idempotency_key_hash']
            : null;
        $audioRebuiltAt = is_string($metadata['audio_rebuilt_at'] ?? null)
            ? $metadata['audio_rebuilt_at']
            : null;

        return [
            'id' => $article->article_id,
            'article_id' => $article->article_id,
            'source_key' => $article->article_id,
            'category' => $category,
            'source' => $article->source,
            'source_identity' => $sourceIdentity,
            'article_type' => $article->article_type,
            'title' => $article->title,
            'title_en' => $metadata['title_en'] ?? $article->title,
            'title_cn' => $metadata['title_cn'] ?? null,
            'article_en' => $article->content,
            'reference_cn' => $metadata['reference_cn'] ?? null,
            'language' => $article->language,
            'difficulty_level' => $article->difficulty_level,
            'word_count' => (int) $article->word_count,
            'unique_word_count' => (int) $article->unique_word_count,
            'sentence_count' => (int) $article->sentence_count,
            'is_daily_reading' => (bool) $article->is_daily_reading,
            'tts_generated' => $audioReady,
            'task_id' => $article->task_id,
            'audio_url' => $audioUrl,
            'audio_ready' => $audioReady,
            'audio_status' => $audioStatus,
            'tts_engine' => is_string($metadata['tts_engine'] ?? null) ? $metadata['tts_engine'] : null,
            'tts_model' => is_string($metadata['tts_model'] ?? null) ? $metadata['tts_model'] : null,
            'tts_chunked' => $ttsChunked,
            'audio_generation_type' => $audioGenerationType,
            'audio_rebuilt_at' => $audioRebuiltAt,
            'document_id' => $metadata['document_id'] ?? null,
            'reading_date' => $article->reading_date ? $article->reading_date->toDateString() : null,
            'created_at' => $article->created_at ? $article->created_at->toIso8601String() : null,
        ];
    }

    public function delete(string $articleId): ?array
    {
        $article = null;
        $metadata = [];
        $category = '';
        $documentId = null;
        $audioPaths = [];
        $audioExisted = false;
        $connection = '';
        $result = [];

        $article = AppQyV1Article::findByArticleId($articleId);
        if ($article === null) {
            return null;
        }

        $metadata = is_array($article->metadata) ? $article->metadata : [];
        $category = $this->categoryFromValues(
            $article->article_type,
            $article->source,
            (bool) $article->is_daily_reading
        );
        $documentId = isset($metadata['document_id']) ? (int) $metadata['document_id'] : null;

        if ($category === 'daily') {
            $audioPaths = $this->dailyAudioPaths($article->article_id, $article->language);
            foreach ($audioPaths as $audioPath) {
                $audioExisted = FileSystemManager::exists($audioPath) || $audioExisted;
                if (!FileSystemManager::delete($audioPath)) {
                    throw new RuntimeException('Article audio could not be deleted.');
                }
            }
        }

        $result = AppQyV1Article::runInTransaction(function () use ($article, $category, $documentId): array {
            $articleWordsDeleted = 0;
            $documentDeleted = 0;

            $articleWordsDeleted = AppQyV1ArticleWord::deleteForArticle((string) $article->article_id);

            if ($documentId !== null && $documentId > 0) {
                $documentDeleted = AppQyV1UploadedDocumentModel::deleteById($documentId);
            }

            $article->deleteRecord();

            return [
                'article_id' => $article->article_id,
                'category' => $category,
                'article_words_deleted' => $articleWordsDeleted,
                'document_deleted' => $documentDeleted > 0,
            ];
        });

        $result['audio_deleted'] = $audioExisted;
        return $result;
    }

    private function categoryFromValues(?string $articleType, ?string $source, bool $isDailyReading): string
    {
        if ($source === 'daily' || $articleType === 'daily' || $isDailyReading) {
            return 'daily';
        }

        return $articleType !== null && trim($articleType) !== '' ? trim($articleType) : 'general';
    }

    private function dailyAudioPaths(string $articleId, string $language): array
    {
        $languageCode = '';
        $safeId = '';
        $filename = '';
        $dailyDirectory = '';
        $legacyDirectory = '';

        $languageCode = AppQyV1TableMaps::normalizeLangCode($language);
        $languageCode = $languageCode !== '' ? $languageCode : 'en';
        $safeId = preg_replace('/[^A-Za-z0-9._-]/', '_', $articleId) ?: 'article';
        $filename = $safeId . '.mp3';
        $dailyDirectory = PathMapper::getAppQyV1AudioBaseDir('daily/' . $languageCode);
        $legacyDirectory = PathMapper::getAppQyV1AudioBaseDir('agent_history/' . $languageCode);

        return [
            $dailyDirectory . DIRECTORY_SEPARATOR . $filename,
            $legacyDirectory . DIRECTORY_SEPARATOR . $filename,
        ];
    }

    private function articleAudioExists(?string $audioUrl): bool
    {
        $urlPath = '';
        $prefix = '/static/app_qy_v1/audio/';
        $relativePath = '';
        $fullPath = '';

        if ($audioUrl === null || trim($audioUrl) === '') {
            return false;
        }

        $urlPath = parse_url($audioUrl, PHP_URL_PATH);
        if (!is_string($urlPath) || !str_starts_with($urlPath, $prefix)) {
            return false;
        }

        $relativePath = ltrim(substr($urlPath, strlen($prefix)), '/');
        if (!preg_match('#^(daily|agent_history)/[A-Za-z][A-Za-z0-9_-]*/[A-Za-z0-9._-]+\.mp3$#', $relativePath)) {
            return false;
        }

        $fullPath = PathMapper::getAppQyV1AudioBaseDir($relativePath);
        return FileSystemManager::exists($fullPath);
    }
}
