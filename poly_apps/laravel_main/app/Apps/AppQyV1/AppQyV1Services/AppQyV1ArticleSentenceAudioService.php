<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleModel as AppQyV1Article;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TranslationEventModel;
use App\Providers\PathMapper;
use App\Services\QueueCenter\QueueCenterService;
use App\Utils\FileSystemManager;

class AppQyV1ArticleSentenceAudioService
{
    public const TARGET_DAILY_ARTICLE = 'daily_article';
    public const TARGET_ARTICLE_LIBRARY = 'article_library';

    private QueueCenterService $queueCenter;

    public function __construct(?QueueCenterService $queueCenter = null)
    {
        $this->queueCenter = $queueCenter ?: app(QueueCenterService::class);
    }

    public function enqueueArticle(
        AppQyV1Article $article,
        bool $moveToHead = false,
        string $scope = 'agent_history',
        bool $forceMissing = false
    ): array
    {
        $metadata = is_array($article->metadata) ? $article->metadata : [];
        $language = $this->normalizeLanguage((string) $article->language);
        $scope = $this->normalizeScope($scope);
        $articleId = trim((string) $article->article_id);
        $text = trim((string) $article->content);
        $audioUrl = $this->articleAudioUrl($scope, $language, $articleId);
        $relativePath = $this->articleAudioRelativePath($scope, $language, $articleId);

        if ($articleId === '' || $text === '') {
            return ['ok' => false, 'created' => false, 'audio_url' => null];
        }
        if ($article->isAgentHistoryDaily()) {
            return [
                'ok' => false,
                'created' => false,
                'audio_url' => $metadata['audio_url'] ?? null,
                'audio_status' => !empty($metadata['audio_url']) ? 'ready' : 'missing',
                'reason' => 'agent_history_audio_is_uploaded_with_article',
            ];
        }
        if (!$forceMissing && (bool) $article->tts_generated && !empty($metadata['audio_url'])) {
            return [
                'ok' => true,
                'created' => false,
                'audio_url' => (string) $metadata['audio_url'],
                'audio_status' => 'ready',
            ];
        }

        $payload = [
            'text' => $text,
            'language' => $language,
            'content_id' => 'article:' . $articleId,
            'target_kind' => self::TARGET_DAILY_ARTICLE,
            'article_id' => $articleId,
            'audio_relative_path' => $relativePath,
            'source' => (string) ($article->source ?: 'article'),
            'engine_profile' => 'sentence',
            'preferred_engine' => 'qwen3tts',
        ];
        $dedupKey = QueueCenterService::dedupKeyFor(
            QueueCenterService::QUEUE_SENTENCE_AUDIO,
            $language,
            'article:' . $articleId
        );
        $result = $this->queueCenter->schedule(
            QueueCenterService::QUEUE_SENTENCE_AUDIO,
            $payload,
            $dedupKey,
            $moveToHead,
            true,
            [],
            300
        );
        $taskId = $result['task_id'] ?? null;

        $metadata['audio_url'] = $audioUrl;
        $metadata['audio_status'] = 'queued';
        $metadata['audio_task_id'] = $taskId;
        $article->metadata = $metadata;
        $article->tts_generated = false;
        $article->saveRecord();

        return [
            'ok' => true,
            'created' => (bool) ($result['created'] ?? false),
            'task_id' => $taskId,
            'audio_url' => $audioUrl,
            'audio_status' => 'queued',
        ];
    }

    public function enqueueLibraryArticle(
        AppQyV1ArticleLibraryModel $article,
        string $language,
        bool $moveToHead = false
    ): array {
        $language = $this->normalizeLanguage($language);
        $content = trim((string) $article->content);
        $md5 = trim((string) $article->md5);
        if ($content === '' || $md5 === '' || ((bool) $article->has_audio && !empty($article->audio_files))) {
            return ['ok' => false, 'created' => false];
        }

        $payload = [
            'text' => $content,
            'language' => $language,
            'content_id' => 'article-library:' . $md5,
            'target_kind' => self::TARGET_ARTICLE_LIBRARY,
            'article_md5' => $md5,
            'source' => (string) ($article->source ?: 'article_library'),
            'engine_profile' => 'sentence',
            'preferred_engine' => 'qwen3tts',
        ];
        $dedupKey = QueueCenterService::dedupKeyFor(
            QueueCenterService::QUEUE_SENTENCE_AUDIO,
            $language,
            'article-library:' . $md5
        );
        $result = $this->queueCenter->schedule(
            QueueCenterService::QUEUE_SENTENCE_AUDIO,
            $payload,
            $dedupKey,
            $moveToHead,
            true,
            [],
            300
        );
        $article->tts_status = AppQyV1DictionaryTTSCoordinator::STATUS_PENDING;
        $article->tts_requested_at = $article->tts_requested_at ?: now();
        $article->tts_global_task_id = $result['task_id'] ?? null;
        $article->saveRecord();

        return ['ok' => true, 'created' => (bool) ($result['created'] ?? false)];
    }

    public function enqueueMissingPath(string $scope, string $language, string $filename): ?array
    {
        $scope = $this->normalizeScope($scope);
        $language = $this->normalizeLanguage($language);
        $articleId = preg_replace('/\.mp3$/i', '', basename($filename)) ?: '';
        if ($articleId === '' || !preg_match('/^[A-Za-z0-9._-]+$/', $articleId)) {
            return null;
        }

        $article = AppQyV1Article::findByArticleId($articleId);
        if (!$article) {
            return null;
        }

        return $this->enqueueArticle($article, true, $scope, true);
    }

    public function storeArticleAudio(array $payload, string $bytes, ?string $provider = null, ?string $mime = null): bool
    {
        $articleId = trim((string) ($payload['article_id'] ?? ''));
        $relativePath = trim((string) ($payload['audio_relative_path'] ?? ''));
        if ($articleId === '' || !$this->isSafeRelativePath($relativePath)) {
            return false;
        }
        if (AppQyV1AudioFormat::extension($bytes, $mime) !== 'mp3') {
            return false;
        }

        $article = AppQyV1Article::findByArticleId($articleId);
        if (!$article) {
            return false;
        }

        $fullPath = PathMapper::getAppQyV1AudioBaseDir($relativePath);
        if (!FileSystemManager::writeFile($fullPath, $bytes)) {
            return false;
        }

        $metadata = is_array($article->metadata) ? $article->metadata : [];
        $metadata['audio_url'] = '/static/app_qy_v1/audio/' . str_replace('\\', '/', $relativePath);
        $metadata['audio_status'] = 'ready';
        $metadata['tts_engine'] = $provider;
        $metadata['audio_bytes'] = strlen($bytes);
        $article->metadata = $metadata;
        $article->tts_generated = true;
        $article->saveRecord();

        AppQyV1TranslationEventModel::emit('article.audio.ready', [
            'article_id' => $articleId,
            'audio_url' => $metadata['audio_url'],
            'provider' => $provider,
        ]);

        return true;
    }

    private function articleAudioUrl(string $scope, string $language, string $articleId): string
    {
        return '/static/app_qy_v1/audio/' . $this->articleAudioRelativePath($scope, $language, $articleId);
    }

    private function articleAudioRelativePath(string $scope, string $language, string $articleId): string
    {
        $safeId = preg_replace('/[^A-Za-z0-9._-]/', '_', $articleId) ?: 'article';
        return $scope . '/' . $language . '/' . $safeId . '.mp3';
    }

    private function normalizeLanguage(string $language): string
    {
        $normalized = AppQyV1TableMaps::normalizeLangCode($language);
        return $normalized !== '' ? $normalized : 'en';
    }

    private function normalizeScope(string $scope): string
    {
        return $scope === 'daily' ? 'daily' : 'agent_history';
    }

    private function isSafeRelativePath(string $relativePath): bool
    {
        return (bool) preg_match(
            '#^(agent_history|daily)/[A-Za-z][A-Za-z0-9_-]*/[A-Za-z0-9._-]+\.mp3$#',
            $relativePath
        );
    }
}
