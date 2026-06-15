<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordQurey;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Support\Facades\DB;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1DictionaryModel;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1InitializationMarkerManager;
use App\Traits\ApiResponse;

/**
 * Untranslated Words Query Controller
 * Reference: DevOps server_controller/server_init_words.js, provider/constants/WordCounter.js
 */
class AppQyV1UntranslatedWordsController extends BaseController
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    protected $markerManager;

    public function __construct()
    {
        $this->markerManager = new AppQyV1InitializationMarkerManager();
    }

    /**
     * Get words that lack translation content
     * Reference: DevOps server_init_words.js findIncompleteWords logic
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getUntranslatedWords(Request $request)
    {
        // Check initialization first
        if (!$this->markerManager->isInitializationComplete()) {
            return response()->json([
                'status' => 'initialization_required',
                'message' => 'System initialization required. Please run /initialize endpoint first.'
            ], 503);
        }

        $limit = $request->input('limit', 50);
        $offset = $request->input('offset', 0);
        $filterBy = $request->input('filter_by', 'translation'); // translation, phonetic, audio, images

        // Validate parameters
        $limit = min(max($limit, 1), 500); // Between 1 and 500
        $offset = max($offset, 0);

            // Build query based on filter criteria
            $query = AppQyV1DictionaryModel::query();

            switch ($filterBy) {
                case 'translation':
                    $query->where(function ($q) {
                        $q->whereNull('translation')
                          ->orWhere('translation', '')
                          ->orWhere('translation', '{}')
                          ->orWhere('translation', '[]')
                          ->orWhere('isTranslation', false);
                    });
                    break;

                case 'phonetic':
                    $query->where(function ($q) {
                        $q->where(function ($subQuery) {
                            $subQuery->whereNull('usPhonetic')
                                     ->orWhere('usPhonetic', '');
                        })->where(function ($subQuery) {
                            $subQuery->whereNull('ukPhonetic')
                                     ->orWhere('ukPhonetic', '');
                        });
                    });
                    break;

                case 'audio':
                    $query->where(function ($q) {
                        $q->whereNull('voice_files')
                          ->orWhere('voice_files', '')
                          ->orWhere('voice_files', '{}')
                          ->orWhere('voice_files', '[]')
                          ->orWhere('isExistLocal', false);
                    });
                    break;

                case 'images':
                    $query->where(function ($q) {
                        $q->whereNull('image_files')
                          ->orWhere('image_files', '')
                          ->orWhere('image_files', '{}')
                          ->orWhere('image_files', '[]');
                    });
                    break;

                case 'all':
                    $query->where(function ($q) {
                        $q->where(function ($subQuery) {
                            // Missing translation
                            $subQuery->whereNull('translation')
                                     ->orWhere('translation', '')
                                     ->orWhere('translation', '{}')
                                     ->orWhere('translation', '[]')
                                     ->orWhere('isTranslation', false);
                        })->orWhere(function ($subQuery) {
                            // Missing phonetic
                            $subQuery->where(function ($phoneticQuery) {
                                $phoneticQuery->whereNull('usPhonetic')
                                             ->orWhere('usPhonetic', '');
                            })->where(function ($phoneticQuery) {
                                $phoneticQuery->whereNull('ukPhonetic')
                                             ->orWhere('ukPhonetic', '');
                            });
                        })->orWhere(function ($subQuery) {
                            // Missing audio
                            $subQuery->whereNull('voice_files')
                                     ->orWhere('voice_files', '')
                                     ->orWhere('voice_files', '{}')
                                     ->orWhere('voice_files', '[]');
                        });
                    });
                    break;

                default:
                    return response()->json([
                        'status' => 'error',
                        'message' => 'Invalid filter_by parameter. Use: translation, phonetic, audio, images, all'
                    ], 400);
            }

            // Get total count for pagination
            $totalCount = $query->count();

            // Get paginated results with priority scoring
            $words = $query->select([
                'id',
                'content',
                'translation',
                'usPhonetic',
                'ukPhonetic',
                'voice_files',
                'image_files',
                'isTranslation',
                'isExistLocal',
                'queryCount',
                'lastQueryTime'
            ])
            ->orderBy('queryCount', 'desc') // Most queried words first
            ->orderBy('lastQueryTime', 'desc') // Recently queried words prioritized
            ->skip($offset)
            ->take($limit)
            ->get();

            // Format results with missing information analysis
            $results = $words->map(function ($word) {
                $missing = [];
                $priority = 0;

                // Check what's missing
                if (empty($word->translation) || $word->translation === '{}' || !$word->isTranslation) {
                    $missing[] = 'translation';
                    $priority += 10;
                }

                if (empty($word->usPhonetic) && empty($word->ukPhonetic)) {
                    $missing[] = 'phonetic';
                    $priority += 5;
                }

                if (empty($word->voice_files) || $word->voice_files === '{}') {
                    $missing[] = 'audio';
                    $priority += 8;
                }

                if (empty($word->image_files) || $word->image_files === '{}') {
                    $missing[] = 'images';
                    $priority += 3;
                }

                // Priority boost for frequently queried words
                $priority += min($word->queryCount * 0.1, 5);

                return [
                    'id' => $word->id,
                    'word' => $word->content,
                    'missing' => $missing,
                    'priority' => round($priority, 1),
                    'query_count' => $word->queryCount,
                    'last_queried' => $word->lastQueryTime
                ];
            });

            // Get statistics
            $stats = $this->getUntranslatedStatistics();

            return response()->json([
                'status' => 'success',
                'data' => [
                    'words' => $results,
                    'pagination' => [
                        'total' => $totalCount,
                        'per_page' => $limit,
                        'current_page' => floor($offset / $limit) + 1,
                        'last_page' => ceil($totalCount / $limit),
                        'from' => $offset + 1,
                        'to' => min($offset + $limit, $totalCount)
                    ],
                    'statistics' => $stats,
                    'filter_applied' => $filterBy
                ]
            ]);

    }

    /**
     * Get statistics about untranslated words
     * Reference: DevOps provider/constants/WordCounter.js
     *
     * @return array
     */
    protected function getUntranslatedStatistics(): array
    {
            $totalWords = AppQyV1DictionaryModel::count();
            
            $missingTranslation = AppQyV1DictionaryModel::where(function ($q) {
                $q->whereNull('translation')
                  ->orWhere('translation', '')
                  ->orWhere('translation', '{}')
                  ->orWhere('translation', '[]')
                  ->orWhere('isTranslation', false);
            })->count();

            $missingPhonetic = AppQyV1DictionaryModel::where(function ($q) {
                $q->where(function ($subQuery) {
                    $subQuery->whereNull('usPhonetic')
                             ->orWhere('usPhonetic', '');
                })->where(function ($subQuery) {
                    $subQuery->whereNull('ukPhonetic')
                             ->orWhere('ukPhonetic', '');
                });
            })->count();

            $missingAudio = AppQyV1DictionaryModel::where(function ($q) {
                $q->whereNull('voice_files')
                  ->orWhere('voice_files', '')
                  ->orWhere('voice_files', '{}')
                  ->orWhere('voice_files', '[]');
            })->count();

            $missingImages = AppQyV1DictionaryModel::where(function ($q) {
                $q->whereNull('image_files')
                  ->orWhere('image_files', '')
                  ->orWhere('image_files', '{}')
                  ->orWhere('image_files', '[]');
            })->count();

            $completeWords = AppQyV1DictionaryModel::where('isTranslation', true)
                ->whereNotNull('translation')
                ->where('translation', '!=', '')
                ->where('translation', '!=', '{}')
                ->whereNotNull('usPhonetic')
                ->where('usPhonetic', '!=', '')
                ->count();

            return [
                'total_words' => $totalWords,
                'complete_words' => $completeWords,
                'completion_rate' => $totalWords > 0 ? round(($completeWords / $totalWords) * 100, 2) : 0,
                'missing_breakdown' => [
                    'translation' => $missingTranslation,
                    'phonetic' => $missingPhonetic,
                    'audio' => $missingAudio,
                    'images' => $missingImages
                ],
                'missing_percentages' => [
                    'translation' => $totalWords > 0 ? round(($missingTranslation / $totalWords) * 100, 2) : 0,
                    'phonetic' => $totalWords > 0 ? round(($missingPhonetic / $totalWords) * 100, 2) : 0,
                    'audio' => $totalWords > 0 ? round(($missingAudio / $totalWords) * 100, 2) : 0,
                    'images' => $totalWords > 0 ? round(($missingImages / $totalWords) * 100, 2) : 0,
                ]
            ];

    }

    /**
     * Get words by priority score
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getWordsByPriority(Request $request)
    {
        $limit = $request->input('limit', 50);
        $minPriority = $request->input('min_priority', 5.0);

            $words = AppQyV1DictionaryModel::select([
                'id',
                'content',
                'queryCount',
                'lastQueryTime',
                'translation',
                'usPhonetic',
                'ukPhonetic',
                'voice_files',
                'image_files',
                'isTranslation'
            ])
            ->where('queryCount', '>', 0)
            ->orderBy('queryCount', 'desc')
            ->limit($limit * 2) // Get more for filtering
            ->get()
            ->map(function ($word) {
                // Calculate priority
                $priority = 0;
                
                if (empty($word->translation) || !$word->isTranslation) $priority += 10;
                if (empty($word->usPhonetic) && empty($word->ukPhonetic)) $priority += 5;
                if (empty($word->voice_files) || $word->voice_files === '{}') $priority += 8;
                if (empty($word->image_files) || $word->image_files === '{}') $priority += 3;
                
                $priority += min($word->queryCount * 0.1, 5);
                
                return [
                    'word' => $word->content,
                    'priority' => round($priority, 1),
                    'query_count' => $word->queryCount,
                    'issues' => $this->getWordIssues($word)
                ];
            })
            ->filter(function ($word) use ($minPriority) {
                return $word['priority'] >= $minPriority;
            })
            ->sortByDesc('priority')
            ->take($limit)
            ->values();

            return response()->json([
                'status' => 'success',
                'data' => $words,
                'criteria' => [
                    'min_priority' => $minPriority,
                    'limit' => $limit
                ]
            ]);

    }

    /**
     * Get specific issues for a word
     *
     * @param mixed $word
     * @return array
     */
    protected function getWordIssues($word): array
    {
        $issues = [];
        
        if (empty($word->translation) || !$word->isTranslation) {
            $issues[] = 'missing_translation';
        }
        
        if (empty($word->usPhonetic) && empty($word->ukPhonetic)) {
            $issues[] = 'missing_phonetic';
        }
        
        if (empty($word->voice_files) || $word->voice_files === '{}') {
            $issues[] = 'missing_audio';
        }
        
        if (empty($word->image_files) || $word->image_files === '{}') {
            $issues[] = 'missing_images';
        }
        
        return $issues;
    }
}
