<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Learning;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Http\Controllers\Controller;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserSelectedLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\Services\AppQyV1VocabularyCoverService;
use App\Traits\ApiResponse;

class AppQyV1VocabularyRecommendationController extends Controller
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     *
     * Recommendations are sourced from the real vocabulary_libraries table
     * (AppQyV1VocabularyLibraryModel) — ids returned here ARE library ids and
     * match /vocabulary/libraries/* and user_selected_libraries.collection_id.
     */

    /** Library language name (as stored on vocabulary_libraries) -> 2-letter code. */
    private const LANGUAGE_CODES = [
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

    /** difficulty_level -> CEFR-style level label (same string style the FE already consumes). */
    private const DIFFICULTY_LEVELS = [
        'beginner' => 'A2-B1',
        'intermediate' => 'B1-B2',
        'advanced' => 'B2-C1',
    ];

    /** difficulty_level -> 1-5 numeric difficulty (consistent with the previous level parsing). */
    private const DIFFICULTY_SCORES = [
        'beginner' => 2,
        'intermediate' => 3,
        'advanced' => 4,
    ];

    private const WORDS_PER_DAY = 20;
    private const MAX_ESTIMATED_DAYS = 365;

    private AppQyV1VocabularyCoverService $coverService;

    public function __construct(AppQyV1VocabularyCoverService $coverService)
    {
        $this->coverService = $coverService;
    }

    public function getRecommendations(Request $request): JsonResponse
    {
        // Resolve via sanctum guard explicitly: route is public, but a valid
        // bearer token still yields the real user (for is_selected flags).
        $userId = $request->user('sanctum')?->id;
        $level = $request->input('level', 'all');
        $category = $request->input('category', 'all');
        $languages = $this->resolveRequestedLanguages($request);

        $selectedIds = [];
        if ($userId) {
            $selectedIds = $this->getActiveSelectedIds($userId);
        }

        $items = AppQyV1VocabularyLibraryModel::recommendationsForLanguages($languages)
            ->map(fn (AppQyV1VocabularyLibraryModel $library) => $this->transformLibrary($library, $selectedIds))
            ->values();

        // Filter options reflect everything available for the requested
        // languages, independent of the level/category filters applied below.
        $filters = [
            'levels' => array_values(array_unique($items->pluck('level')->all())),
            'categories' => array_values(array_unique($items->pluck('category')->all())),
        ];

        $recommendations = $items
            ->filter(function (array $item) use ($level, $category) {
                if ($level !== 'all' && stripos($item['level'], $level) === false) {
                    return false;
                }
                if ($category !== 'all' && $item['category'] !== $category) {
                    return false;
                }
                return true;
            })
            ->values()
            ->all();

        return response()->json([
            'success' => true,
            'data' => $recommendations,
            'total' => count($recommendations),
            'filters' => $filters,
        ]);
    }

    public function selectCollection(Request $request): JsonResponse
    {
        $collectionId = (int) $request->input('collection_id');
        $userId = $request->user()->id;
        $action = $request->input('action', 'select');

        if ($action === 'select') {
            $library = AppQyV1VocabularyLibraryModel::findPublicById((int) $collectionId);

            if (!$library) {
                return response()->json([
                    'success' => false,
                    'message' => 'Vocabulary library not found',
                ], 404);
            }

            AppQyV1UserSelectedLibraryModel::selectLibrary(
                $userId,
                (int) $library->id,
                $this->languageCode($library->language)
            );

            return response()->json([
                'success' => true,
                'message' => 'Vocabulary collection selected successfully',
            ]);
        } else {
            AppQyV1UserSelectedLibraryModel::deselectLibrary($userId, $collectionId);

            return response()->json([
                'success' => true,
                'message' => 'Vocabulary collection deselected successfully',
            ]);
        }
    }

    public function getSelectedCollections(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $selected = $this->getActiveSelectedIds($userId);

        if (empty($selected)) {
            return response()->json([
                'success' => true,
                'data' => [],
                'total' => 0,
            ]);
        }

        // collection_id stores real vocabulary_libraries ids (selectCollection
        // validates against that table) — resolve them there and return the
        // same item shape as getRecommendations.
        $libraries = AppQyV1VocabularyLibraryModel::rowsByIds($selected)
            ->map(fn (AppQyV1VocabularyLibraryModel $library) => $this->transformLibrary($library, $selected))
            ->values()
            ->all();

        return response()->json([
            'success' => true,
            'data' => $libraries,
            'total' => count($libraries),
        ]);
    }

    /**
     * Active user_selected_libraries.collection_id values (= library ids).
     */
    private function getActiveSelectedIds(int $userId): array
    {
        return AppQyV1UserSelectedLibraryModel::activeLibraryIds($userId);
    }

    /**
     * Map a real library row to the recommendation item shape the FE consumes.
     */
    private function transformLibrary(AppQyV1VocabularyLibraryModel $library, array $selectedIds): array
    {
        $difficultyLevel = 'intermediate';
        if (!empty($library->difficulty_level)) {
            $difficultyLevel = strtolower($library->difficulty_level);
        }

        $levelLabel = 'B1-B2';
        if (isset(self::DIFFICULTY_LEVELS[$difficultyLevel])) {
            $levelLabel = self::DIFFICULTY_LEVELS[$difficultyLevel];
        }

        $difficultyScore = 3;
        if (isset(self::DIFFICULTY_SCORES[$difficultyLevel])) {
            $difficultyScore = self::DIFFICULTY_SCORES[$difficultyLevel];
        }

        $category = 'general';
        if (!empty($library->category)) {
            $category = $library->category;
        }

        $wordCount = (int) $library->total_words;

        $estimatedDays = (int) ceil($wordCount / self::WORDS_PER_DAY);
        if ($estimatedDays < 1) {
            $estimatedDays = 1;
        }
        if ($estimatedDays > self::MAX_ESTIMATED_DAYS) {
            $estimatedDays = self::MAX_ESTIMATED_DAYS;
        }

        $langCode = $this->languageCode($library->language);

        $description = $library->description;
        if (empty($description)) {
            $description = 'Curated vocabulary collection for ' . $langCode;
        }

        return [
            'id' => (int) $library->id,
            'name' => $library->name,
            'lang_code' => $langCode,
            'total_words' => $wordCount,
            'level' => $levelLabel,
            'category' => $category,
            'is_selected' => in_array((int) $library->id, $selectedIds, true),
            'is_popular' => (bool) $library->is_recommended,
            'difficulty' => $difficultyScore,
            'estimated_days' => $estimatedDays,
            'description' => $description,
            'image_url' => $this->coverImageUrl($library),
        ];
    }

    private function coverImageUrl(AppQyV1VocabularyLibraryModel $library): string
    {
        $cover = $this->coverService->getCoverData($library);
        if (is_array($cover) && !empty($cover['url'])) {
            return $cover['url'];
        }

        return $this->coverService->getDefaultCoverUrl();
    }

    /**
     * Requested languages normalized to the full names stored on
     * vocabulary_libraries.language. Accepts both ?language= (single value)
     * and ?lang_codes[]= (array), each entry as a 2-letter code ('en') or a
     * full name ('english'). Defaults to english.
     */
    private function resolveRequestedLanguages(Request $request): array
    {
        $requested = $request->input('lang_codes', []);
        if (!is_array($requested)) {
            $requested = [$requested];
        }

        $language = $request->input('language');
        if (!empty($language)) {
            $requested[] = $language;
        }

        if (empty($requested)) {
            $requested = ['english'];
        }

        $names = [];
        foreach ($requested as $value) {
            $name = $this->languageName((string) $value);
            if ($name !== '' && !in_array($name, $names, true)) {
                $names[] = $name;
            }
        }

        return $names;
    }

    /**
     * Normalize a language input ('en' or 'English') to the stored full name.
     */
    private function languageName(string $value): string
    {
        $normalized = strtolower(trim($value));
        if ($normalized === '') {
            return '';
        }

        if (isset(self::LANGUAGE_CODES[$normalized])) {
            return $normalized;
        }

        $byCode = array_search($normalized, self::LANGUAGE_CODES, true);
        if ($byCode !== false) {
            return $byCode;
        }

        return $normalized;
    }

    /**
     * Stored full language name -> 2-letter code (mirrors the vocabulary
     * public controller mapping; unknown 2-letter inputs pass through).
     */
    private function languageCode(?string $language): string
    {
        $normalized = '';
        if ($language !== null) {
            $normalized = strtolower(trim($language));
        }

        if (isset(self::LANGUAGE_CODES[$normalized])) {
            return self::LANGUAGE_CODES[$normalized];
        }

        if (strlen($normalized) === 2) {
            return $normalized;
        }

        return 'en';
    }
}
