<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleModel as AppQyV1Article;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UploadedDocumentModel;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1DailyReadingLibraryDefaults;
use Illuminate\Support\Facades\Log;

/**
 * Persists worker-submitted (agent-history) daily-reading articles as
 * uploaded-document rows — the same {prefix}_uploaded_documents table the
 * POST /learning/upload document feature uses — so the article text can be
 * re-processed later through the /vocabulary/document/{id}/extract-* endpoints.
 */
class AppQyV1DailyReadingDocumentService
{
    /**
     * Best-effort: store the article body (English article + Chinese reference)
     * as an uploaded document linked to the code-owned 'Daily Reading' library,
     * then record metadata.document_id on the article. Never throws — a
     * document failure must not break article creation.
     *
     * @return int|null The created document id, or null on failure.
     */
    public function createForWorkerArticle(
        AppQyV1Article $article,
        string $articleText,
        ?string $referenceCn,
        string $language
    ): ?int {
        try {
            $library = AppQyV1DailyReadingLibraryDefaults::ensureLibrary();

            $content = $articleText;
            $reference = trim((string) $referenceCn);
            if ($reference !== '') {
                $content .= "\n\n" . $reference;
            }

            $document = new AppQyV1UploadedDocumentModel([
                'user_id' => 0,
                // Library id (legacy column name kept for compatibility).
                'collection_id' => (int) $library->id,
                'original_name' => (string) $article->title,
                'language' => $language,
                'content' => $content,
            ]);
            $document->saveRecord();

            $meta = is_array($article->metadata) ? $article->metadata : [];
            $meta['document_id'] = (int) $document->id;
            $article->metadata = $meta;
            $article->saveRecord();

            return (int) $document->id;
        } catch (\Throwable $e) {
            Log::warning('[AppQyV1Article] Daily reading document creation failed', [
                'article_id' => $article->article_id,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }
}
