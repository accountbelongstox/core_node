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
    private AppQyV1DailyReadingService $dailyReadingService;

    public function __construct(AppQyV1DailyReadingService $dailyReadingService)
    {
        $this->dailyReadingService = $dailyReadingService;
    }

    public function submit(array $input): array
    {
        $articleText = (string) $input['article_text'];
        $identityHashes = [];
        $sourceArticle = null;
        $contentArticle = null;
        $existingArticle = null;
        $language = AppQyV1TableMaps::normalizeLangCode((string) ($input['language'] ?? 'en'));
        $language = $language !== '' ? $language : 'en';
        $titleEn = trim((string) ($input['title_en'] ?? $input['title'] ?? ''));
        $titleEn = $titleEn !== '' ? $titleEn : __('article.default_daily_title', [], 'en');
        $idempotencyKey = trim((string) ($input['idempotency_key'] ?? ''));
        $identityHashes = AppQyV1Article::identityHashes($titleEn, $articleText);
        $sourceArticle = $idempotencyKey !== ''
            ? AppQyV1Article::findAgentHistoryBySourceRecordId($idempotencyKey)
            : null;
        $contentArticle = AppQyV1Article::findCanonicalByIdentityHashes(
            0,
            $identityHashes['title_md5'],
            $identityHashes['content_md5']
        );
        if ($sourceArticle !== null
            && $contentArticle !== null
            && $sourceArticle->article_id !== $contentArticle->article_id) {
            $contentArticle = AppQyV1Article::aliasArticleToCanonical($sourceArticle, $contentArticle);
        }
        $existingArticle = $contentArticle ?? $sourceArticle;
        $articleId = $this->articleId(
            0,
            $identityHashes['title_md5'],
            $identityHashes['content_md5']
        );
        if ($existingArticle !== null) {
            $articleId = (string) $existingArticle->article_id;
        }
        $parsedResult = AppQyV1ArticleTextParser::parseArticle($articleText, $language);
        $submissionMetadata = $this->submissionMetadata(
            $input,
            $articleText,
            $language,
            $titleEn,
            $idempotencyKey
        );
        [$article, $inserted] = $this->ensureArticle(
            $articleId,
            $articleText,
            $language,
            $titleEn,
            $parsedResult,
            $submissionMetadata,
            $identityHashes
        );

        $syncResult = AppQyV1Article::replaceAgentHistorySubmission(
            $articleId,
            [
                'title' => $titleEn,
                'content' => $articleText,
                'title_md5' => $identityHashes['title_md5'],
                'content_md5' => $identityHashes['content_md5'],
                'canonical_article_id' => null,
                'language' => $language,
                'article_type' => AppQyV1Article::TYPE_DAILY,
                'source' => AppQyV1Article::SOURCE_AGENT_HISTORY,
                'word_count' => $parsedResult['total_words'],
                'unique_word_count' => $parsedResult['unique_words'],
                'sentence_count' => $parsedResult['total_sentences'],
                'is_daily_reading' => true,
                'tts_generated' => true,
            ],
            $submissionMetadata
        );
        $article = $syncResult['article'];
        $audioUrl = $this->dailyReadingService->replaceAudio(
            $article,
            (string) $input['audio_base64'],
            [
                'tts_engine' => $input['tts_engine'] ?? null,
                'tts_model' => $input['tts_model'] ?? null,
                'tts_chunked' => (bool) ($input['tts_chunked'] ?? false),
                'tts_accent' => $input['tts_accent'] ?? null,
                'source_record_id' => $idempotencyKey !== '' ? $idempotencyKey : null,
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

        $this->ensurePublicationEvent(
            $articleId,
            $audioUrl,
            $documentId,
            (string) $submissionMetadata['submission_fingerprint']
        );

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

    private function articleId(int $userId, string $titleMd5, string $contentMd5): string
    {
        $identity = $userId . ':' . $titleMd5 . ':' . $contentMd5;

        return self::ARTICLE_ID_PREFIX
            . substr(hash('sha256', $identity), 0, self::ARTICLE_ID_HASH_LENGTH);
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
            'source_record_id' => $idempotencyKey !== '' ? $idempotencyKey : null,
            'source_record_ids' => $idempotencyKey !== '' ? [$idempotencyKey] : [],
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
        array $metadata,
        array $identityHashes
    ): array {
        $now = now();
        $article = null;
        $inserted = 0;

        $inserted = AppQyV1Article::query()->insertOrIgnore([[
            'article_id' => $articleId,
            'user_id' => 0,
            'title' => $titleEn,
            'content' => $articleText,
            'title_md5' => $identityHashes['title_md5'],
            'content_md5' => $identityHashes['content_md5'],
            'canonical_article_id' => null,
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
        if (!$article->isManagedDaily()) {
            throw new ConflictHttpException(__('article.worker_identity_conflict'));
        }

        return [$article, $inserted > 0];
    }

    private function ensurePublicationEvent(
        string $articleId,
        string $audioUrl,
        int $documentId,
        string $submissionFingerprint
    ): void
    {
        AppQyV1Article::mutateMetadataByArticleId(
            $articleId,
            static function (array $metadata, AppQyV1Article $article) use (
                $articleId,
                $audioUrl,
                $documentId,
                $submissionFingerprint
            ): array {
                if (hash_equals(
                    (string) ($metadata['publication_event_fingerprint'] ?? ''),
                    $submissionFingerprint
                )) {
                    return $metadata;
                }

                AppQyV1TranslationEventModel::emitOnce(
                    AppQyV1TranslationEventModel::EVENT_ARTICLE_PUBLISHED,
                    $articleId . ':' . $submissionFingerprint,
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
                $metadata['publication_event_fingerprint'] = $submissionFingerprint;

                return $metadata;
            }
        );
    }
}
