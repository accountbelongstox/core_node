<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Vocabulary;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1WordValidityQueueService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1WordTranslationWriteback;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Http\Controllers\Controller;
use App\Support\QueueCenterContract;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Word-validity intake for a third-party verification client.
 *
 * Validity is externally asserted, never inferred: every dictionary row is
 * valid by default and becomes invalid only when this client (after checking
 * the word against the internet) reports it so. The client pulls unchecked
 * words via getPending() and posts results back via report().
 *
 * House style (matches AppQyV1VocabularyLibraryPublicController):
 *   NO try-catch  -  trust Laravel validation
 *   NO ?? or ||   -  use explicit if statements
 */
class AppQyV1VocabularyValidityController extends Controller
{
    use ApiResponse;

    private AppQyV1WordValidityQueueService $queueService;

    public function __construct(AppQyV1WordValidityQueueService $queueService)
    {
        $this->queueService = $queueService;
    }

    /**
     * GET /vocabulary/validity/pending
     *
     * Return words that no third-party check has touched yet, so the client can
     * verify them online and report back. Most-queried words come first.
     *
     * Query params: language/languages, start, limit, q, include_total.
     */
    public function getPending(Request $request): JsonResponse
    {
        $rawLanguages = trim((string) $request->query('languages', ''));
        $languageCode = $this->resolveLanguageCode($request->query('language'));
        $languages = $rawLanguages !== '' ? explode(',', $rawLanguages) : [$languageCode];
        $start = max(0, (int) $request->query('start', 0));
        $limit = (int) $request->query('limit', 100);
        $search = mb_substr(trim((string) $request->query('q', '')), 0, 120);
        $includeTotal = $request->boolean('include_total', false);

        if ($limit < 1) {
            $limit = 1;
        }
        if ($limit > 1000) {
            $limit = 1000;
        }

        return $this->success($this->queueService->pendingPage(
            $languages,
            $start,
            $limit,
            $search,
            $includeTotal
        ));
    }

    /**
     * POST /vocabulary/validity/report
     *
     * Record verification results from the third-party client.
     *
     * Body:
     *   language:        source code or name (default en)
     *   target_language: target code for carried translations (e.g. zh)
     *   source:          optional label identifying the checking client/source
     *   results:  array of { word|md5, is_valid:bool, note?, source?, translation? }
     *             valid results MAY carry translation (target_language); invalid never do.
     */
    public function report(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'language' => 'nullable|string',
            'target_language' => 'nullable|string|max:10',
            'source' => 'nullable|string|max:100',
            'results' => 'required|array|min:1',
            'results.*.word' => 'nullable|string',
            'results.*.md5' => 'nullable|string|size:32',
            'results.*.is_valid' => 'required|boolean',
            'results.*.note' => 'nullable|string',
            'results.*.source' => 'nullable|string|max:100',
            'results.*.translation' => 'nullable|string',
        ]);

        $languageCode = $this->resolveLanguageCode($request->input('language'));

        // AI-verified rows carry the contract marker as their validity_source.
        $defaultSource = QueueCenterContract::wordValiditySourceMarker();
        if (isset($validated['source']) && $validated['source'] !== '') {
            $defaultSource = $validated['source'];
        }

        // Target language for any carried translations (NEW). When absent, the
        // report is validity-only and no translation write-back is attempted.
        $targetLanguage = null;
        if (isset($validated['target_language']) && $validated['target_language'] !== '') {
            $targetLanguage = $validated['target_language'];
        }

        // Provider label recorded on written translations (translation_provider).
        $provider = $defaultSource;

        // Valid results carrying a non-empty translation are collected here and
        // written in one batch AFTER the validity loop, via the canonical
        // AppQyV1WordTranslationWriteback::apply (dual-write: translations[target]
        // + word_translation pair + has_translation + translation_provider).
        $translationsToWrite = [];

        $hasTable = AppQyV1LangDictionaryModel::languageTableExists($languageCode);

        if (!$hasTable) {
            return $this->error('Dictionary table not found for language: ' . $languageCode, 404);
        }

        $updated = 0;
        $notFound = 0;
        $invalidMarked = 0;
        $validMarked = 0;
        $validityResults = [];

        foreach ($validated['results'] as $result) {
            $md5 = null;
            if (isset($result['md5']) && $result['md5'] !== '') {
                $md5 = strtolower($result['md5']);
            } elseif (isset($result['word']) && $result['word'] !== '') {
                $md5 = md5($result['word']);
            }

            if ($md5 === null) {
                $notFound++;
                continue;
            }

            $isValid = (bool) $result['is_valid'];

            $source = $defaultSource;
            if (isset($result['source']) && $result['source'] !== '') {
                $source = $result['source'];
            }

            $note = null;
            if (isset($result['note']) && $result['note'] !== '') {
                $note = $result['note'];
            }

            $validityResults[] = [
                'md5' => $md5,
                'is_valid' => $isValid,
                'source' => $source,
                'note' => $note,
            ];

            // Independent of validity write above: a VALID result may also carry a
            // translation. Collect it (needs the raw word — apply keys entries by
            // md5(word)); invalid results never carry one. Written once after the loop.
            if ($isValid
                && isset($result['word']) && $result['word'] !== ''
                && isset($result['translation']) && $result['translation'] !== '') {
                $translationsToWrite[] = [
                    'word' => $result['word'],
                    'translation' => $result['translation'],
                ];
            }

        }

        $validityOutcome = AppQyV1LangDictionaryModel::markValidities($languageCode, $validityResults);
        $updated = $validityOutcome['updated'];
        $validMarked = $validityOutcome['valid'];
        $invalidMarked = $validityOutcome['invalid'];
        $notFound += count($validityResults) - $updated;

        // Batch-write the collected translations through the CANONICAL writer so the
        // exact dual-write is reused (translations[targetCode] + word_translation
        // pair + has_translation + translation_provider). Only when a target language
        // was supplied and at least one valid result carried a translation.
        // AppQyV1WordTranslationWriteback is fill-missing per target language,
        // so a validity-only pass cannot overwrite an existing translation.
        $translated = 0;
        if ($targetLanguage !== null && !empty($translationsToWrite)) {
            $taskId = 'validity-report-' . uniqid('', true);
            $outcome = AppQyV1WordTranslationWriteback::apply(
                $taskId,
                $languageCode,
                $targetLanguage,
                $provider,
                $translationsToWrite
            );
            $translated = (int) $outcome['processed'];
        }

        $this->queueService->notifyChanged($languageCode);

        return $this->success([
            'language' => $languageCode,
            'updated' => $updated,
            'not_found' => $notFound,
            'marked_valid' => $validMarked,
            'marked_invalid' => $invalidMarked,
            'translated' => $translated,
        ]);
    }

    /**
     * Normalise an incoming language identifier (code or full name) to a
     * supported language code, defaulting to English.
     */
    private function resolveLanguageCode($language): string
    {
        if ($language === null || $language === '') {
            return 'en';
        }

        $normalized = strtolower((string) $language);

        $nameToCode = [
            'english' => 'en',
            'chinese' => 'zh',
            'japanese' => 'ja',
            'korean' => 'ko',
            'spanish' => 'es',
            'french' => 'fr',
            'german' => 'de',
            'russian' => 'ru',
            'arabic' => 'ar',
            'portuguese' => 'pt',
            'italian' => 'it',
            'dutch' => 'nl',
            'polish' => 'pl',
            'turkish' => 'tr',
            'vietnamese' => 'vi',
            'lao' => 'lo',
            'thai' => 'th',
            'indonesian' => 'id',
            'hindi' => 'hi',
            'bengali' => 'bn',
            'urdu' => 'ur',
        ];

        if (isset($nameToCode[$normalized])) {
            return $nameToCode[$normalized];
        }

        if (AppQyV1TableMaps::isLanguageSupported($normalized)) {
            return $normalized;
        }

        return $normalized;
    }
}
