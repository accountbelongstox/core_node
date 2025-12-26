<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Vocabulary;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\Services\AppQyV1VocabularyCoverService;
use App\Http\Controllers\Controller;
use App\Providers\PathMapper;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AppQyV1VocabularyLibraryPublicController extends Controller
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    private AppQyV1VocabularyCoverService $coverService;

    public function __construct(AppQyV1VocabularyCoverService $coverService)
    {
        $this->coverService = $coverService;
    }

    public function getRecommended(Request $request): JsonResponse
    {
        $language = $request->query('language', 'english');
        $limit = (int) $request->query('limit', 10);
        $limit = max(1, min($limit, 50));

        $libraries = AppQyV1VocabularyLibraryModel::query()
            ->public()
            ->forLanguage($language)
            ->where('is_recommended', true)
            ->orderByDesc('total_words')
            ->limit($limit)
            ->get()
            ->map(fn ($library) => $this->transformLibrary($library))
            ->values();

        return $this->success([
            'libraries' => $libraries,
        ]);
    }

    public function getStatistics(Request $request): JsonResponse
    {
        $language = $request->query('language', 'english');

        $stats = [
            'total_libraries' => AppQyV1VocabularyLibraryModel::query()
                ->public()
                ->forLanguage($language)
                ->count(),
            'total_words' => AppQyV1VocabularyLibraryModel::query()
                ->public()
                ->forLanguage($language)
                ->sum('total_words'),
            'recommended_count' => AppQyV1VocabularyLibraryModel::query()
                ->public()
                ->forLanguage($language)
                ->where('is_recommended', true)
                ->count(),
        ];

        return $this->success($stats);
    }

    public function getLibraries(Request $request): JsonResponse
    {
        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(1, min((int) $request->query('per_page', 20), 100));

        $query = AppQyV1VocabularyLibraryModel::query()
            ->public()
            ->forLanguage($request->query('language'));

        if ($category = $request->query('category')) {
            $query->where('category', $category);
        }

        if ($difficulty = $request->query('difficulty')) {
            $query->where('difficulty_level', $difficulty);
        }

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', '%' . $search . '%')
                    ->orWhere('description', 'like', '%' . $search . '%');
            });
        }

        $total = (clone $query)->count();
        $lastPage = max(1, (int) ceil($total / $perPage));

        $libraries = $query
            ->orderByDesc('is_recommended')
            ->orderBy('difficulty_level')
            ->orderByDesc('total_words')
            ->forPage($page, $perPage)
            ->get()
            ->map(fn ($library) => $this->transformLibrary($library))
            ->values();

        return $this->success([
            'libraries' => $libraries,
            'pagination' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'last_page' => $lastPage,
                'has_more' => $page < $lastPage,
            ],
        ]);
    }

    public function getLibraryWords(Request $request, int $libraryId): JsonResponse
    {
        $library = AppQyV1VocabularyLibraryModel::query()
            ->public()
            ->findOrFail($libraryId);

        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(1, min((int) $request->query('per_page', 1000), 2000));
        $offset = ($page - 1) * $perPage;

        $connection = 'appqyv1';
        $wordsTable = 'app_qy_v1_vocabulary_words';

        $total = \DB::connection($connection)
            ->table($wordsTable)
            ->where('library_id', $libraryId)
            ->count();

        $languageCode = $this->getLanguageCode($library->language);
        $dictionaryTable = "app_qy_v1_{$languageCode}_dictionaries";

        $hasDictionaryTable = \DB::connection($connection)
            ->select("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [$dictionaryTable]);

        $query = \DB::connection($connection)
            ->table($wordsTable . ' as w');

        if (!empty($hasDictionaryTable)) {
            $query->leftJoin($dictionaryTable . ' as d', 'w.word', '=', 'd.content');
        }

        $words = $query
            ->where('w.library_id', $libraryId)
            ->orderBy('w.word_index')
            ->skip($offset)
            ->take($perPage)
            ->get(
                !empty($hasDictionaryTable)
                    ? [
                        'w.word_index',
                        'w.word',
                        'd.translations',
                        'd.us_phonetic',
                        'd.uk_phonetic',
                        'd.image_files as word_details',
                    ]
                    : [
                        'w.word_index',
                        'w.word',
                        \DB::raw('NULL as translations'),
                        \DB::raw('NULL as us_phonetic'),
                        \DB::raw('NULL as uk_phonetic'),
                        \DB::raw('NULL as word_details'),
                    ]
            )
            ->map(function ($item) use ($languageCode) {
                $translations = null;
                $hasTranslation = false;

                if ($item->translations) {
                    $decodedTranslations = json_decode($item->translations, true);
                    if (is_array($decodedTranslations)) {
                        $simpleTranslations = [];
                        if (isset($decodedTranslations['word_translation']) && is_array($decodedTranslations['word_translation'])) {
                            foreach ($decodedTranslations['word_translation'] as $trans) {
                                if (is_array($trans) && count($trans) >= 2) {
                                    $simpleTranslations[] = $trans[1];
                                }
                            }
                        }

                        if (!empty($simpleTranslations)) {
                            $translations = $simpleTranslations;
                            $hasTranslation = true;
                        }
                    }
                }

                $wordDetails = null;
                if ($item->word_details) {
                    $decodedDetails = json_decode($item->word_details, true);
                    if (is_array($decodedDetails)) {
                        $wordDetails = $decodedDetails;
                    }
                }

                $audioUrl = null;
                $audioAvailable = false;

                if ($languageCode && $item->word) {
                    $md5 = md5($item->word);
                    $dictEntry = AppQyV1LangDictionaryModel::findByMd5($languageCode, $md5);

                    if ($dictEntry && !empty($dictEntry->tts_files)) {
                        foreach ($dictEntry->tts_files as $ttsFile) {
                            if (isset($ttsFile['path'])) {
                                $audioBasePath = PathMapper::getLaravelDataDir() . '/tts_data/audio/';
                                $fullPath = $audioBasePath . $ttsFile['path'];

                                if (file_exists($fullPath)) {
                                    $audioUrl = '/api/app_qy_v1/ai_tools/tts/audio/' . $ttsFile['path'];
                                    $audioAvailable = true;
                                    break;
                                }
                            }
                        }
                    }
                }

                return [
                    'index' => (int) $item->word_index,
                    'word' => $item->word,
                    'translations' => $translations,
                    'us_phonetic' => $item->us_phonetic,
                    'uk_phonetic' => $item->uk_phonetic,
                    'word_details' => $wordDetails,
                    'has_translation' => $hasTranslation,
                    'audio_url' => $audioUrl,
                    'audio_available' => $audioAvailable,
                ];
            })
            ->values();

        $lastPage = max(1, (int) ceil($total / $perPage));

        return $this->success([
            'library' => [
                'id' => (int) $library->id,
                'name' => $library->name,
                'total_words' => (int) $library->total_words,
                'language' => $library->language,
            ],
            'words' => $words,
            'pagination' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'last_page' => $lastPage,
                'has_more' => $page < $lastPage,
            ],
        ]);
    }

    private function getLanguageCode(string $language): string
    {
        $languageMap = [
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

        $normalizedLang = strtolower($language);

        if (isset($languageMap[$normalizedLang])) {
            return $languageMap[$normalizedLang];
        }

        if (strlen($normalizedLang) === 2) {
            return $normalizedLang;
        }

        return 'en';
    }

    private function transformLibrary(AppQyV1VocabularyLibraryModel $library): array
    {
        $cover = $this->coverService->getCoverData($library);
        if (!is_array($cover)) {
            $cover = [];
        }

        $imageUrl = $this->coverService->getDefaultCoverUrl();
        if (isset($cover['url'])) {
            $imageUrl = $cover['url'];
        }

        return [
            'id' => (int) $library->id,
            'name' => $library->name,
            'description' => $library->description,
            'word_count' => (int) $library->total_words,
            'language' => $library->language,
            'difficulty' => $library->difficulty_level ?? 'intermediate',
            'category' => $library->category ?? 'general',
            'image_url' => $imageUrl,
            'cover_status' => $cover['status'] ?? 'pending',
            'cover_error' => $cover['error'] ?? null,
            'is_recommended' => (bool) $library->is_recommended,
            'tags' => $library->tags ?? [],
            'cover_log' => $cover['log'] ?? null,
        ];
    }
}
