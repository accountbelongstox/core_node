<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Vocabulary;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

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

    /**
     * GET /vocabulary/validity/pending
     *
     * Return words that no third-party check has touched yet, so the client can
     * verify them online and report back. Most-queried words come first.
     *
     * Query params: language (code or name, default en), limit (1..1000, default 100).
     */
    public function getPending(Request $request): JsonResponse
    {
        $languageCode = $this->resolveLanguageCode($request->query('language'));

        $limit = (int) $request->query('limit', 100);
        if ($limit < 1) {
            $limit = 1;
        }
        if ($limit > 1000) {
            $limit = 1000;
        }

        $dictModel = AppQyV1LangDictionaryModel::forLanguage($languageCode);
        $hasTable = Schema::connection($dictModel->getConnectionName())->hasTable($dictModel->getTable());

        if (!$hasTable) {
            return $this->success([
                'language' => $languageCode,
                'count' => 0,
                'words' => [],
            ]);
        }

        $words = $dictModel->validityUnchecked()
            ->orderByDesc('query_count')
            ->orderBy('id')
            ->limit($limit)
            ->get(['id', 'content', 'md5'])
            ->map(function ($row) {
                return [
                    'id' => (int) $row->id,
                    'word' => $row->content,
                    'md5' => $row->md5,
                ];
            })
            ->values()
            ->all();

        return $this->success([
            'language' => $languageCode,
            'count' => count($words),
            'words' => $words,
        ]);
    }

    /**
     * POST /vocabulary/validity/report
     *
     * Record verification results from the third-party client.
     *
     * Body:
     *   language: code or name (default en)
     *   source:   optional label identifying the checking client/source
     *   results:  array of { word|md5, is_valid:bool, note?:string, source?:string }
     */
    public function report(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'language' => 'nullable|string',
            'source' => 'nullable|string|max:100',
            'results' => 'required|array|min:1',
            'results.*.word' => 'nullable|string',
            'results.*.md5' => 'nullable|string|size:32',
            'results.*.is_valid' => 'required|boolean',
            'results.*.note' => 'nullable|string',
            'results.*.source' => 'nullable|string|max:100',
        ]);

        $languageCode = $this->resolveLanguageCode($request->input('language'));

        $defaultSource = null;
        if (isset($validated['source']) && $validated['source'] !== '') {
            $defaultSource = $validated['source'];
        }

        $dictModel = AppQyV1LangDictionaryModel::forLanguage($languageCode);
        $hasTable = Schema::connection($dictModel->getConnectionName())->hasTable($dictModel->getTable());

        if (!$hasTable) {
            return $this->error('Dictionary table not found for language: ' . $languageCode, 404);
        }

        $updated = 0;
        $notFound = 0;
        $invalidMarked = 0;
        $validMarked = 0;

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

            $didUpdate = AppQyV1LangDictionaryModel::markValidity($languageCode, $md5, $isValid, $source, $note);

            if ($didUpdate) {
                $updated++;
                if ($isValid) {
                    $validMarked++;
                } else {
                    $invalidMarked++;
                }
            } else {
                $notFound++;
            }
        }

        return $this->success([
            'language' => $languageCode,
            'updated' => $updated,
            'not_found' => $notFound,
            'marked_valid' => $validMarked,
            'marked_invalid' => $invalidMarked,
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
