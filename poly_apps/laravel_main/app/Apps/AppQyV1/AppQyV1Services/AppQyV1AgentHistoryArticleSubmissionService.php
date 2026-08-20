<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleModel as AppQyV1Article;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleWordModel as AppQyV1ArticleWord;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TranslationEventModel;
use App\Apps\AppQyV1\Utils\AppQyV1ArticleTextParser;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

final class AppQyV1AgentHistoryArticleSubmissionService
{
    private const ARTICLE_ID_PREFIX = 'article_';
    private const ARTICLE_ID_HASH_LENGTH = 40;
    private const PUBLICATION_EVENT = 'article.published';

    private AppQyV1DailyReadingService $dailyReadingService;

    public function __construct(AppQyV1DailyReadingService $dailyReadingService)
    {
        $this->dailyReadingService = $dailyReadingService;
    }

    public function submit(array $input): array
    {
        $articleText = (string) $input['article_text'];
        $language = AppQyV1TableMaps::normalizeLangCode((string) ($input['language'] ?? 'en'));
        $language = $language !== '' ? $language : 'en';
        $titleEn = trim((string) ($input['title_en'] ?? $input['title'] ?? ''));
        $titleEn = $titleEn !== '' ? $titleEn : __('article.default_daily_title', [], 'en');
        $idempotencyKey = trim((string) ($input['idempotency_key'] ?? ''));
        $articleId = $this->articleId($idempotencyKey);
        $parsedResult = AppQyV1ArticleTextParser::parseArticle($articleText, $language);
        $submissionMetadata = $this->submissionMetadata(
            $input,
            $articleText,
            $language,
            $titleEn,
            $idempotencyKey
        );
        $article = $this->ensureArticle(
            $articleId,
            $articleText,
            $language,
            $titleEn,
            $parsedResult,
            $submissionMetadata
        );

        $article = $this->syncSubmissionMetadata($article, $submissionMetadata, $idempotencyKey !== '');
        $audioUrl = $this->dailyReadingService->replaceAudio(
            $article,
            (string) $input['audio_base64'],
            [
                'tts_engine' => $input['tts_engine'] ?? null,
                'tts_model' => $input['tts_model'] ?? null,
                'tts_chunked' => (bool) ($input['tts_chunked'] ?? false),
                'tts_accent' => $input['tts_accent'] ?? null,
            ]
        );
        if ($audioUrl === null) {
            throw new RuntimeException(__('article.worker_audio_store_failed'));
        }

        AppQyV1ArticleWord::createFromArticleWords(
            $articleId,
            $parsedResult['words'],
            $parsedResult['word_frequency'],
            $language
        );

        $documentId = $this->dailyReadingService->createDocument(
            $article,
            $articleText,
            isset($input['reference_cn']) ? (string) $input['reference_cn'] : null,
            $language
        );
        if ($documentId === null) {
            throw new RuntimeException(__('article.worker_document_store_failed'));
        }

        $this->ensurePublicationEvent($articleId, $audioUrl, $documentId);

        return [
            'article_id' => $articleId,
            'source_key' => $articleId,
            'audio_url' => $audioUrl,
            'document_id' => $documentId,
            'title' => $article->title,
            'article_type' => AppQyV1Article::TYPE_DAILY,
            'source' => AppQyV1Article::SOURCE_AGENT_HISTORY,
        ];
    }

    private function articleId(string $idempotencyKey): string
    {
        if ($idempotencyKey === '') {
            return self::ARTICLE_ID_PREFIX . Str::uuid();
        }

        return self::ARTICLE_ID_PREFIX
            . substr(hash('sha256', $idempotencyKey), 0, self::ARTICLE_ID_HASH_LENGTH);
    }

    private function submissionMetadata(
        array $input,
        string $articleText,
        string $language,
        string $titleEn,
        string $idempotencyKey
    ): array {
        $identityPayload = [
            'article_text' => $articleText,
            'language' => $language,
            'title_en' => $titleEn,
            'title_cn' => $input['title_cn'] ?? null,
            'reference_cn' => $input['reference_cn'] ?? null,
            'reference_lang' => $input['reference_lang'] ?? 'CN',
            'target_lang' => $input['target_lang'] ?? 'EN',
        ];
        $identityJson = json_encode(
            $identityPayload,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
        );

        return [
            'title_en' => $titleEn,
            'title_cn' => $input['title_cn'] ?? null,
            'reference_cn' => $input['reference_cn'] ?? null,
            'reference_lang' => $input['reference_lang'] ?? 'CN',
            'target_lang' => $input['target_lang'] ?? 'EN',
            'raw_preview' => $input['raw_preview'] ?? null,
            'raw_word_count' => (int) ($input['raw_word_count'] ?? 0),
            'openrouter_model' => $input['openrouter_model'] ?? null,
            'submission_source' => AppQyV1Article::SOURCE_AGENT_HISTORY,
            'idempotency_key_hash' => $idempotencyKey !== '' ? hash('sha256', $idempotencyKey) : null,
            'submission_fingerprint' => hash('sha256', $identityJson),
        ];
    }

    private function ensureArticle(
        string $articleId,
        string $articleText,
        string $language,
        string $titleEn,
        array $parsedResult,
        array $metadata
    ): AppQyV1Article {
        $now = now();
        $article = null;

        AppQyV1Article::query()->insertOrIgnore([[
            'article_id' => $articleId,
            'user_id' => 0,
            'title' => $titleEn,
            'content' => $articleText,
            'language' => $language,
            'article_type' => AppQyV1Article::TYPE_DAILY,
            'source' => AppQyV1Article::SOURCE_AGENT_HISTORY,
            'word_count' => $parsedResult['total_words'],
            'unique_word_count' => $parsedResult['unique_words'],
            'sentence_count' => $parsedResult['total_sentences'],
            'is_daily_reading' => true,
            'reading_date' => $now->toDateString(),
            'tts_generated' => true,
            'metadata' => json_encode(
                $metadata,
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
            ),
            'created_at' => $now,
            'updated_at' => $now,
        ]]);

        $article = AppQyV1Article::findByArticleId($articleId);
        if ($article === null) {
            throw new RuntimeException(__('article.worker_article_store_failed'));
        }
        if (!$article->isAgentHistoryDaily()) {
            throw new ConflictHttpException(__('article.worker_identity_conflict'));
        }

        return $article;
    }

    private function syncSubmissionMetadata(
        AppQyV1Article $article,
        array $submissionMetadata,
        bool $enforceFingerprint
    ): AppQyV1Article {
        return AppQyV1Article::mutateMetadataByArticleId(
            (string) $article->article_id,
            static function (array $metadata) use ($submissionMetadata, $enforceFingerprint): array {
                $storedFingerprint = (string) ($metadata['submission_fingerprint'] ?? '');
                $incomingFingerprint = (string) $submissionMetadata['submission_fingerprint'];

                if ($enforceFingerprint
                    && $storedFingerprint !== ''
                    && !hash_equals($storedFingerprint, $incomingFingerprint)) {
                    throw new ConflictHttpException(__('article.worker_idempotency_conflict'));
                }

                return array_replace($metadata, $submissionMetadata);
            }
        );
    }

    private function ensurePublicationEvent(string $articleId, string $audioUrl, int $documentId): void
    {
        AppQyV1Article::mutateMetadataByArticleId(
            $articleId,
            static function (array $metadata, AppQyV1Article $article) use (
                $articleId,
                $audioUrl,
                $documentId
            ): array {
                if (($metadata['publication_event_emitted'] ?? false) === true) {
                    return $metadata;
                }

                AppQyV1TranslationEventModel::emitOnce(
                    self::PUBLICATION_EVENT,
                    $articleId,
                    [
                        'article_id' => $articleId,
                        'source_key' => $articleId,
                        'title' => $article->title,
                        'language' => $article->language,
                        'article_type' => AppQyV1Article::TYPE_DAILY,
                        'source' => AppQyV1Article::SOURCE_AGENT_HISTORY,
                        'audio_url' => $audioUrl,
                        'document_id' => $documentId,
                    ]
                );

                $metadata['publication_event_emitted'] = true;
                $metadata['publication_event_emitted_at'] = now()->toIso8601String();

                return $metadata;
            }
        );
    }
}
