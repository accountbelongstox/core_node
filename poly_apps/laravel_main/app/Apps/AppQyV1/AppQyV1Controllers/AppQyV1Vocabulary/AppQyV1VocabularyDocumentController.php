<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Vocabulary;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UploadedDocumentModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\Utils\AppQyV1VocabularyImporter;
use App\Constants\AppKeys;
use App\Http\Controllers\Controller;
use App\Models\Sentence;
use App\Models\SourceSentence;
use App\Providers\AppTablePrefixServiceProvider;
use App\Services\MediaIngestService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Re-processing of previously uploaded plain-text documents:
 *   - extract-words: idempotently append the document's unique words to the
 *     vocabulary collection created at upload time (same importer path).
 *   - extract-sentences: idempotently ingest the document's sentences into
 *     the SHARED sentence library (app_qy_v1_sentences) with positional
 *     links in app_qy_v1_source_sentences, source_type = 'document'.
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

        $document = AppQyV1UploadedDocumentModel::find($id);
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
            $collection = AppQyV1VocabularyLibraryModel::find($document->collection_id);
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
            $document->save();

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

        $document = AppQyV1UploadedDocumentModel::find($id);
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

        // The shared sentence library stores full language NAMES (media
        // pipeline default 'english'), so dedupe keys line up across sources.
        $languageName = AppQyV1VocabularyLibraryPublicController::getLanguageName((string) $document->language);
        if ($languageName === '') {
            $languageName = 'english';
        }

        $documentId = (int) $document->id;
        $documentName = (string) $document->original_name;
        $sourceKey = 'doc_' . $documentId;

        $stored = 0;
        $skipped = 0;

        // One transaction for the whole document (same rationale as
        // MediaIngestService::ingest): thousands of row-by-row writes would
        // otherwise auto-commit individually.
        DB::connection(AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1))->transaction(function () use ($sentences, $languageName, $sourceKey, $documentId, $documentName, &$stored, &$skipped) {
            foreach ($sentences as $idx => $text) {
                // Same dedup key the media ingest uses, so document sentences
                // merge with subtitle/book sentences in the shared library.
                $sentenceId = MediaIngestService::computeSentenceId($text, $languageName);

                $existingLink = SourceSentence::where('source_type', self::SENTENCE_SOURCE_TYPE)
                    ->where('source_key', $sourceKey)
                    ->where('grain', self::SENTENCE_GRAIN)
                    ->where('seq', $idx)
                    ->first();

                if ($existingLink) {
                    // Idempotent re-run: this position was already ingested.
                    // Skip entirely (no occurrence_count bump) so repeated
                    // extraction calls never inflate counters.
                    $skipped++;
                    continue;
                }

                $sentenceRow = Sentence::where('sentence_id', $sentenceId)->first();
                if (!$sentenceRow) {
                    Sentence::create([
                        'sentence_id' => $sentenceId,
                        'text' => $text,
                        'language' => $languageName,
                        'occurrence_count' => 1,
                        'metadata' => [
                            'source' => 'vocabulary_document',
                            'document_id' => $documentId,
                            'document_name' => $documentName,
                        ],
                    ]);
                } else {
                    // Shared-library dedupe semantics: never rewrite text or
                    // AI enrichment fields, only bump the occurrence count.
                    $sentenceRow->occurrence_count = (int) $sentenceRow->occurrence_count + 1;
                    $sentenceRow->save();
                }

                SourceSentence::create([
                    'source_type' => self::SENTENCE_SOURCE_TYPE,
                    'source_key' => $sourceKey,
                    'sentence_id' => $sentenceId,
                    'grain' => self::SENTENCE_GRAIN,
                    'seq' => $idx,
                    'metadata' => [
                        'source' => $documentName,
                        'document_id' => $documentId,
                    ],
                ]);

                $stored++;
            }
        });

        return $this->success([
            'document_id' => $documentId,
            'sentences_total' => $sentencesTotal,
            'stored' => $stored,
            'skipped' => $skipped,
        ], 'Sentences extracted successfully');
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

    /**
     * Split into sentences on terminal punctuation (western + CJK) and line
     * breaks, collapse internal whitespace, keep sentences of at least 10
     * characters, capped at 10000 sentences.
     */
    private function splitSentences(string $content): array
    {
        $parts = preg_split('/[.!?\x{3002}\x{FF01}\x{FF1F}\n]+/u', $content, -1, PREG_SPLIT_NO_EMPTY);
        if (!is_array($parts)) {
            return [];
        }

        $sentences = [];
        foreach ($parts as $part) {
            $sentence = trim(preg_replace('/\s+/u', ' ', $part));
            if (mb_strlen($sentence) < self::MIN_SENTENCE_LENGTH) {
                continue;
            }
            $sentences[] = $sentence;
            if (count($sentences) >= self::MAX_SENTENCES) {
                break;
            }
        }

        return $sentences;
    }
}
