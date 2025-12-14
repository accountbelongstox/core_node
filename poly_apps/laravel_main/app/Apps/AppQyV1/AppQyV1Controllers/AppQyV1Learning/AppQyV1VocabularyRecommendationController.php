<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Learning;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Support\Facades\DB;
use App\Traits\ApiResponse;

class AppQyV1VocabularyRecommendationController extends BaseController
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    private static $recommendedCollections = [
        'en' => [
            ['id' => 1, 'name' => 'TOEFL Core Vocabulary', 'total_words' => 3000, 'level' => 'B2-C1', 'category' => 'exam'],
            ['id' => 2, 'name' => 'IELTS Essential Words', 'total_words' => 2500, 'level' => 'B2-C1', 'category' => 'exam'],
            ['id' => 3, 'name' => 'GRE Advanced Vocabulary', 'total_words' => 4000, 'level' => 'C1-C2', 'category' => 'exam'],
            ['id' => 4, 'name' => 'Business English', 'total_words' => 1500, 'level' => 'B1-B2', 'category' => 'business'],
            ['id' => 5, 'name' => 'Daily Conversation', 'total_words' => 800, 'level' => 'A2-B1', 'category' => 'daily'],
            ['id' => 6, 'name' => 'Academic Writing', 'total_words' => 2000, 'level' => 'B2-C1', 'category' => 'academic'],
            ['id' => 7, 'name' => 'Travel English', 'total_words' => 500, 'level' => 'A2-B1', 'category' => 'travel'],
            ['id' => 8, 'name' => 'Technical Terms (IT)', 'total_words' => 1200, 'level' => 'B2', 'category' => 'technical'],
        ],
        'ja' => [
            ['id' => 101, 'name' => 'JLPT N5 Vocabulary', 'total_words' => 800, 'level' => 'N5', 'category' => 'exam'],
            ['id' => 102, 'name' => 'JLPT N4 Vocabulary', 'total_words' => 1500, 'level' => 'N4', 'category' => 'exam'],
            ['id' => 103, 'name' => 'JLPT N3 Vocabulary', 'total_words' => 3000, 'level' => 'N3', 'category' => 'exam'],
            ['id' => 104, 'name' => 'JLPT N2 Vocabulary', 'total_words' => 6000, 'level' => 'N2', 'category' => 'exam'],
            ['id' => 105, 'name' => 'JLPT N1 Vocabulary', 'total_words' => 10000, 'level' => 'N1', 'category' => 'exam'],
            ['id' => 106, 'name' => 'Daily Japanese', 'total_words' => 1200, 'level' => 'N4-N3', 'category' => 'daily'],
            ['id' => 107, 'name' => 'Business Japanese', 'total_words' => 2000, 'level' => 'N2-N1', 'category' => 'business'],
        ],
        'ko' => [
            ['id' => 201, 'name' => 'TOPIK I (Level 1-2)', 'total_words' => 1500, 'level' => '1-2', 'category' => 'exam'],
            ['id' => 202, 'name' => 'TOPIK II (Level 3-4)', 'total_words' => 3000, 'level' => '3-4', 'category' => 'exam'],
            ['id' => 203, 'name' => 'TOPIK II (Level 5-6)', 'total_words' => 5000, 'level' => '5-6', 'category' => 'exam'],
            ['id' => 204, 'name' => 'Korean Daily Conversation', 'total_words' => 1000, 'level' => '1-2', 'category' => 'daily'],
            ['id' => 205, 'name' => 'K-Drama Vocabulary', 'total_words' => 800, 'level' => '2-3', 'category' => 'entertainment'],
        ],
        'fr' => [
            ['id' => 301, 'name' => 'DELF A1-A2 Vocabulary', 'total_words' => 1200, 'level' => 'A1-A2', 'category' => 'exam'],
            ['id' => 302, 'name' => 'DELF B1-B2 Vocabulary', 'total_words' => 2500, 'level' => 'B1-B2', 'category' => 'exam'],
            ['id' => 303, 'name' => 'French Daily Life', 'total_words' => 800, 'level' => 'A2-B1', 'category' => 'daily'],
            ['id' => 304, 'name' => 'Business French', 'total_words' => 1500, 'level' => 'B2', 'category' => 'business'],
        ],
        'de' => [
            ['id' => 401, 'name' => 'Goethe A1-A2 Vocabulary', 'total_words' => 1300, 'level' => 'A1-A2', 'category' => 'exam'],
            ['id' => 402, 'name' => 'Goethe B1-B2 Vocabulary', 'total_words' => 2800, 'level' => 'B1-B2', 'category' => 'exam'],
            ['id' => 403, 'name' => 'German Daily Conversation', 'total_words' => 900, 'level' => 'A2-B1', 'category' => 'daily'],
        ],
        'es' => [
            ['id' => 501, 'name' => 'DELE A1-A2 Vocabulary', 'total_words' => 1100, 'level' => 'A1-A2', 'category' => 'exam'],
            ['id' => 502, 'name' => 'DELE B1-B2 Vocabulary', 'total_words' => 2400, 'level' => 'B1-B2', 'category' => 'exam'],
            ['id' => 503, 'name' => 'Spanish Daily Life', 'total_words' => 850, 'level' => 'A2-B1', 'category' => 'daily'],
        ],
    ];

    public function getRecommendations(Request $request): JsonResponse
    {
        $langCodes = $request->input('lang_codes', []);
        $userId = $request->user()?->id;
        $level = $request->input('level', 'all');
        $category = $request->input('category', 'all');

        if (empty($langCodes)) {
            $langCodes = ['en'];
        }

        $recommendations = [];

        foreach ($langCodes as $langCode) {
            if (isset(self::$recommendedCollections[$langCode])) {
                $collections = self::$recommendedCollections[$langCode];

                if ($level !== 'all') {
                    $collections = array_filter($collections, function ($col) use ($level) {
                        return stripos($col['level'], $level) !== false;
                    });
                }

                if ($category !== 'all') {
                    $collections = array_filter($collections, function ($col) use ($category) {
                        return $col['category'] === $category;
                    });
                }

                foreach ($collections as $collection) {
                    $recommendations[] = [
                        'id' => $collection['id'],
                        'name' => $collection['name'],
                        'lang_code' => $langCode,
                        'total_words' => $collection['total_words'],
                        'level' => $collection['level'],
                        'category' => $collection['category'],
                        'is_selected' => false,
                        'is_popular' => in_array($collection['id'], [1, 2, 101, 102, 201]),
                        'difficulty' => $this->calculateDifficulty($collection['level']),
                        'estimated_days' => ceil($collection['total_words'] / 20),
                        'description' => $this->getDescription($collection['name'], $langCode),
                    ];
                }
            }
        }

        if ($userId) {
            $selectedIds = DB::table('user_vocabulary_collections')
                ->where('user_id', $userId)
                ->pluck('collection_id')
                ->toArray();

            foreach ($recommendations as &$rec) {
                $rec['is_selected'] = in_array($rec['id'], $selectedIds);
            }
        }

        usort($recommendations, function ($a, $b) {
            if ($a['is_popular'] !== $b['is_popular']) {
                return $b['is_popular'] <=> $a['is_popular'];
            }
            return $a['difficulty'] <=> $b['difficulty'];
        });

        return response()->json([
            'success' => true,
            'data' => $recommendations,
            'total' => count($recommendations),
            'filters' => [
                'levels' => $this->getAvailableLevels($langCodes),
                'categories' => $this->getAvailableCategories($langCodes),
            ],
        ]);
    }

    public function selectCollection(Request $request): JsonResponse
    {
        $collectionId = $request->input('collection_id');
        $userId = $request->user()->id;
        $action = $request->input('action', 'select');

        if ($action === 'select') {
            DB::table('user_vocabulary_collections')->updateOrInsert(
                ['user_id' => $userId, 'collection_id' => $collectionId],
                [
                    'selected_at' => now(),
                    'updated_at' => now(),
                ]
            );

            return response()->json([
                'success' => true,
                'message' => 'Vocabulary collection selected successfully',
            ]);
        } else {
            DB::table('user_vocabulary_collections')
                ->where('user_id', $userId)
                ->where('collection_id', $collectionId)
                ->delete();

            return response()->json([
                'success' => true,
                'message' => 'Vocabulary collection deselected successfully',
            ]);
        }
    }

    public function getSelectedCollections(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $selected = DB::table('user_vocabulary_collections')
            ->where('user_id', $userId)
            ->pluck('collection_id')
            ->toArray();

        $collections = [];
        foreach (self::$recommendedCollections as $langCode => $langCollections) {
            foreach ($langCollections as $collection) {
                if (in_array($collection['id'], $selected)) {
                    $collections[] = [
                        'id' => $collection['id'],
                        'name' => $collection['name'],
                        'lang_code' => $langCode,
                        'total_words' => $collection['total_words'],
                        'level' => $collection['level'],
                        'category' => $collection['category'],
                    ];
                }
            }
        }

        return response()->json([
            'success' => true,
            'data' => $collections,
            'total' => count($collections),
        ]);
    }

    private function calculateDifficulty(string $level): int
    {
        $difficultyMap = [
            'A1' => 1, 'A2' => 2, 'B1' => 3, 'B2' => 4, 'C1' => 5, 'C2' => 6,
            'N5' => 1, 'N4' => 2, 'N3' => 3, 'N2' => 4, 'N1' => 5,
            '1' => 1, '2' => 2, '3' => 3, '4' => 4, '5' => 5, '6' => 6,
        ];

        foreach ($difficultyMap as $key => $value) {
            if (stripos($level, $key) !== false) {
                return $value;
            }
        }

        return 3;
    }

    private function getAvailableLevels(array $langCodes): array
    {
        $levels = [];
        foreach ($langCodes as $langCode) {
            if (isset(self::$recommendedCollections[$langCode])) {
                foreach (self::$recommendedCollections[$langCode] as $collection) {
                    $levels[] = $collection['level'];
                }
            }
        }
        return array_values(array_unique($levels));
    }

    private function getAvailableCategories(array $langCodes): array
    {
        $categories = [];
        foreach ($langCodes as $langCode) {
            if (isset(self::$recommendedCollections[$langCode])) {
                foreach (self::$recommendedCollections[$langCode] as $collection) {
                    $categories[] = $collection['category'];
                }
            }
        }
        return array_values(array_unique($categories));
    }

    private function getDescription(string $name, string $langCode): string
    {
        $descriptions = [
            'TOEFL Core Vocabulary' => 'Essential vocabulary for TOEFL exam preparation',
            'IELTS Essential Words' => 'Most commonly used words in IELTS exams',
            'GRE Advanced Vocabulary' => 'High-level vocabulary for GRE test takers',
            'Business English' => 'Professional vocabulary for workplace communication',
            'Daily Conversation' => 'Common words and phrases for everyday situations',
            'Academic Writing' => 'Formal vocabulary for academic papers and essays',
            'Travel English' => 'Useful phrases and vocabulary for travelers',
            'JLPT N5 Vocabulary' => 'Basic Japanese vocabulary for beginners',
            'JLPT N4 Vocabulary' => 'Elementary Japanese vocabulary',
            'JLPT N3 Vocabulary' => 'Intermediate Japanese vocabulary',
        ];

        return $descriptions[$name] ?? 'Curated vocabulary collection for ' . $langCode;
    }
}
