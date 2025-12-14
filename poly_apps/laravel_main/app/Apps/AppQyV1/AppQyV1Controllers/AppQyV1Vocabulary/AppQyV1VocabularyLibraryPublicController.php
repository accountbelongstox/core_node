<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Vocabulary;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\Services\AppQyV1VocabularyCoverService;
use App\Http\Controllers\Controller;
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
