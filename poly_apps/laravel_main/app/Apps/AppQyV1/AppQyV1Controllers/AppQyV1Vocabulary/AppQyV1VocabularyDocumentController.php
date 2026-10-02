<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Vocabulary;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UploadedDocumentModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\Utils\AppQyV1VocabularyImporter;
use App\Http\Controllers\Controller;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SourceSentenceModel as SourceSentence;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Services\MediaIngestService;
use App\Support\SentenceSegmenter;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Re-processing of previously uploaded plain-text documents:
 *   - extract-words: idempotently append the document's unique words to the
 *     vocabulary collection created at upload time (same importer path).
 *   - extract-sentences: idempotently ingest the document's sentences into the
 *     per-language sentence store (app_qy_v1_sentences_{lang}, content_id-keyed)
 *     with positional links in app_qy_v1_source_sentences, source_type='document'.
 */
class AppQyV1VocabularyDocumentController extends Controller
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    private const MIN_WORD_LENGTH = 2;
    private const MAX_WORD_LENGTH = 50;
    private const MAX_UNIQUE_WORDS = 20000;
    private const MIN_SENTENCE_LENGTH = 10;
    private const MAX_SENTENCES = 10000;
    private const SENTENCE_SOURCE_TYPE = 'document';
    private const SENTENCE_GRAIN = 'sentence';

    private AppQyV1VocabularyImporter $importer;

    public function __construct()
    {
        $this->importer = new AppQyV1VocabularyImporter();
    }

    public function extractWords(Request $request, int $id): JsonResponse
    {
        $user = Auth::user();

        $document = AppQyV1UploadedDocumentModel::findById($id);
        if (!$document) {
            return $this->notFound('Document not found');
        }
        if ((int) $document->user_id !== (int) $user->id) {
            return $this->forbidden('You do not have permission to access this document');
        }

        $words = $this->tokenizeUniqueWords((string) $document->content);
        $wordsTotal = count($words);

        if ($wordsTotal === 0) {
            return $this->success([
                'document_id' => (int) $document->id,
                'words_total' => 0,
                'added' => 0,
                'skipped' => 0,
            ], 'No words found in document');
        }

        // Wave A consolidation: documents.collection_id stores a
        // vocabulary_libraries id (legacy column name kept for compatibility).
        $collection = null;
        if ($document->collection_id !== null) {
            $collection = AppQyV1VocabularyLibraryModel::findById((int) $document->collection_id);
        }

        if (!$collection) {
            // The library created at upload time is gone (e.g. deleted via
            // DELETE /learning/libraries/{id}): recreate it through the same
            // importer path uploadDocument uses, then relink the document.
            $result = $this->importer->createVocabularyCollection(
                (string) $document->original_name,
                (string) $document->language,
                $words,
                'user_upload',
                (int) $document->user_id,
                false,
                null
            );

            if (!$result['success']) {
                return $this->error($result['error'], 500);
            }

            $document->collection_id = $result['collection_id'];
            $document->saveRecord();

            return $this->success([
                'document_id' => (int) $document->id,
                'words_total' => $wordsTotal,
                'added' => $wordsTotal,
                'skipped' => 0,
            ], 'Words extracted successfully');
        }

        $result = $this->importer->addWordsToCollection((int) $collection->id, (string) $document->language, $words);
        if (!$result['success']) {
            return $this->error($result['error'], 500);
        }

        return $this->success([
            'document_id' => (int) $document->id,
            'words_total' => $wordsTotal,
            'added' => (int) $result['added'],
            'skipped' => (int) $result['skipped'],
        ], 'Words extracted successfully');
    }

    public function extractSentences(Request $request, int $id): JsonResponse
    {
        $user = Auth::user();

        $document = AppQyV1UploadedDocumentModel::findById($id);
        if (!$document) {
            return $this->notFound('Document not found');
        }
        if ((int) $document->user_id !== (int) $user->id) {
            return $this->forbidden('You do not have permission to access this document');
        }

        $sentences = $this->splitSentences((string) $document->content);
        $sentencesTotal = count($sentences);

        if ($sentencesTotal === 0) {
            return $this->success([
                'document_id' => (int) $document->id,
                'sentences_total' => 0,
                'stored' => 0,
                'skipped' => 0,
            ], 'No sentences found in document');
        }

        // Books v3: sentences live in the per-language store
        // ({prefix}_sentences_{lang}) keyed by content_id. Resolve the language
        // CODE for the table; fall back to 'en'.
        $langCode = $this->resolveLangCodeForSentences((string) $document->language);

        $documentId = (int) $document->id;
        $documentName = (string) $document->original_name;
        $sourceKey = 'doc_' . $documentId;
        $linked = [];
        $slots = [];

        // Idempotent re-run: positions already linked are skipped entirely, so
        // repeated extraction never inflates counters.
        foreach (SourceSentence::slotsAt(self::SENTENCE_SOURCE_TYPE, $sourceKey, self::SENTENCE_GRAIN, array_keys($sentences)) as $link) {
            $linked[(int) $link->seq] = true;
        }
        foreach ($sentences as $idx => $text) {
            if (isset($linked[$idx])) {
                continue;
            }
            $slots[] = [
                'chapter_index' => 0,
                'grain' => self::SENTENCE_GRAIN,
                'seq' => $idx,
                'primary_language' => $langCode,
                'langs' => [$langCode => $text],
                'metadata' => ['source' => $documentName, 'document_id' => $documentId],
            ];
        }
        // The shared set-based write (MediaIngestService): content_id dedup with
        // book/subtitle sentences, origin=content (adopting an ad-hoc playback
        // row of the same text), and the document slot links.
        $result = $slots === [] ? null : app(MediaIngestService::class)->ingest([
            'source_type' => self::SENTENCE_SOURCE_TYPE,
            'model_version' => MediaIngestService::MODEL_VERSION,
            'source' => ['source_key' => $sourceKey, 'language' => $langCode, 'selected_languages' => [$langCode]],
            'chapters' => [],
            'slots' => $slots,
        ]);
        $stored = (int) ($result['source_sentences']['created'] ?? 0);
        $skipped = count($linked);

        return $this->success([
            'document_id' => $documentId,
            'sentences_total' => $sentencesTotal,
            'stored' => $stored,
            'skipped' => $skipped,
        ], 'Sentences extracted successfully');
    }

    /**
     * Resolve a document language (name or code) to the 2/3-letter code used by
     * the per-language sentence tables. Falls back to 'en'.
     */
    private function resolveLangCodeForSentences(string $language): string
    {
        $lang = strtolower(trim($language));
        $nameToCode = [
            'english' => 'en',
            'japanese' => 'ja',
            'korean' => 'ko',
            'vietnamese' => 'vi',
            'lao' => 'lo',
            'chinese' => 'zh',
        ];
        if (isset($nameToCode[$lang])) {
            $lang = $nameToCode[$lang];
        }
        if ($lang === '' || !AppQyV1TableMaps::isLanguageSupported($lang)) {
            return 'en';
        }
        return $lang;
    }

    /**
     * Unicode-aware tokenization: words are maximal runs of letters (\p{L}),
     * lowercased, length 2..50, deduplicated, capped at 20000 unique words.
     */
    private function tokenizeUniqueWords(string $content): array
    {
        $parts = preg_split('/\P{L}+/u', $content, -1, PREG_SPLIT_NO_EMPTY);
        if (!is_array($parts)) {
            return [];
        }

        $unique = [];
        foreach ($parts as $part) {
            $word = mb_strtolower(trim($part));
            $length = mb_strlen($word);
            if ($length < self::MIN_WORD_LENGTH) {
                continue;
            }
            if ($length > self::MAX_WORD_LENGTH) {
                continue;
            }
            if (isset($unique[$word])) {
                continue;
            }
            $unique[$word] = true;
            if (count($unique) >= self::MAX_UNIQUE_WORDS) {
                break;
            }
        }

        return array_keys($unique);
    }

    private function splitSentences(string $content): array
    {
        return SentenceSegmenter::split($content, false, self::MIN_SENTENCE_LENGTH, 0, self::MAX_SENTENCES);
    }
}
