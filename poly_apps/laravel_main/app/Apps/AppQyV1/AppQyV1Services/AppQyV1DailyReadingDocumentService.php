<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleModel as AppQyV1Article;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UploadedDocumentModel;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1DailyReadingLibraryDefaults;

/**
 * Persists worker-submitted (agent-history) daily-reading articles as
 * uploaded-document rows — the same {prefix}_uploaded_documents table the
 * POST /learning/upload document feature uses — so the article text can be
 * re-processed later through the /vocabulary/document/{id}/extract-* endpoints.
 */
class AppQyV1DailyReadingDocumentService
{
    /**
     * Store the article body as one source-addressed uploaded document and
     * atomically link its identifier from article metadata.
     *
     * @return int|null The created document id, or null on failure.
     */
    public function createForWorkerArticle(
        AppQyV1Article $article,
        string $articleText,
        ?string $referenceCn,
        string $language
    ): ?int {
        $library = AppQyV1DailyReadingLibraryDefaults::ensureLibrary();
        $content = $articleText;
        $reference = trim((string) $referenceCn);
        $documentModel = new AppQyV1UploadedDocumentModel();
        $document = null;
        $documentId = null;
        $now = now();

        if ($reference !== '') {
            $content .= "\n\n" . $reference;
        }

        $documentId = $documentModel->getConnection()->transaction(
            static function () use ($article, $library, $content, $language, $now, &$document): int {
                AppQyV1UploadedDocumentModel::query()->insertOrIgnore([[
                    'user_id' => 0,
                    'collection_id' => (int) $library->id,
                    'original_name' => (string) $article->title,
                    'language' => $language,
                    'content' => $content,
                    'source_type' => AppQyV1UploadedDocumentModel::SOURCE_TYPE_ARTICLE,
                    'source_key' => (string) $article->article_id,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]]);

                $document = AppQyV1UploadedDocumentModel::query()
                    ->where('source_type', AppQyV1UploadedDocumentModel::SOURCE_TYPE_ARTICLE)
                    ->where('source_key', (string) $article->article_id)
                    ->firstOrFail();

                AppQyV1Article::mutateMetadataByArticleId(
                    (string) $article->article_id,
                    static function (array $metadata) use ($document): array {
                        $metadata['document_id'] = (int) $document->id;

                        return $metadata;
                    }
                );

                return (int) $document->id;
            },
            5
        );

        return $documentId;
    }
}
