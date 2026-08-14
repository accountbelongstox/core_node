<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Learning;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserLearningProgressModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserSelectedLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1LanguageStudyGroupService;
use App\Apps\AppQyV1\Services\AppQyV1VocabularyCoverService;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TtsUrl;
use App\Traits\ApiResponse;

class AppQyV1LearningController extends Controller
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

    public function getUserLanguages(Request $request)
    {
        $user = Auth::user();

        $learningLanguages = [];
        if (isset($user->learning_languages)) {
            $learningLanguages = $user->learning_languages;
        }
        $nativeLanguage = 'zh';
        if (isset($user->native_language)) {
            $nativeLanguage = $user->native_language;
        }

        return response()->json([
            'success' => true,
            'data' => [
                'learning_languages' => $learningLanguages,
                'native_language' => $nativeLanguage,
            ]
        ]);
    }

    public function setUserLanguages(Request $request)
    {
        $request->validate([
            'learning_languages' => 'required|array|min:1',
            'learning_languages.*' => 'string|size:2',
            'native_language' => 'nullable|string|size:2',
        ]);

        $user = Auth::user();
        $user->learning_languages = $request->input('learning_languages');

        if ($request->has('native_language')) {
            $user->native_language = $request->input('native_language');
        }

        $user->saveRecord();
        AppQyV1LanguageStudyGroupService::ensureLanguageGroupsExist(
            (int) $user->id,
            $request->input('learning_languages')
        );

        return response()->json([
            'success' => true,
            'message' => 'Learning languages updated successfully',
            'data' => [
                'learning_languages' => $user->learning_languages,
                'native_language' => $user->native_language,
            ]
        ]);
    }

    public function getVocabularyLibraries(Request $request)
    {
        $user = Auth::user();
        $langCode = $request->input('lang_code');

        if (!$langCode) {
            $learningLanguages = [];
            if (isset($user->learning_languages)) {
                $learningLanguages = $user->learning_languages;
            }
            $langCode = 'en';
            if (isset($learningLanguages[0])) {
                $langCode = $learningLanguages[0];
            }
        }

        // Collections were merged into vocabulary_libraries (Wave A/B
        // consolidation): public libraries replace public collections and
        // owner_user_id libraries replace user collections. Library rows
        // store the full language NAME ('english'); the API keeps lang_code.
        $languageName = AppQyV1VocabularyLibraryModel::languageCodeToName($langCode);

        $publicLibraries = collect();
        $userLibraries = collect();
        if ($languageName !== null) {
            $libraryRows = AppQyV1VocabularyLibraryModel::learningLibraries(
                (int) $user->id,
                $languageName
            );
            $publicLibraries = $libraryRows['public'];
            $userLibraries = $libraryRows['user'];
        }

        $selectedLibraries = AppQyV1UserSelectedLibraryModel::getUserSelectedLibraries(
            $user->id,
            $langCode,
            true
        );

        $selectedIds = $selectedLibraries->pluck('collection_id')->toArray();

        $transform = function ($lib) use ($selectedIds, $langCode) {
            return [
                'id' => $lib->id,
                'name' => $lib->name,
                'lang_code' => $langCode,
                'total_words' => $lib->total_words,
                'description' => $lib->description,
                'is_selected' => in_array($lib->id, $selectedIds),
                'cover_image_url' => $this->coverService->getDefaultCoverUrl(),
            ];
        };

        return response()->json([
            'success' => true,
            'data' => [
                'public_libraries' => $publicLibraries->map($transform),
                'user_libraries' => $userLibraries->map($transform),
                'lang_code' => $langCode,
            ]
        ]);
    }

    public function selectVocabularyLibrary(Request $request)
    {
        $request->validate([
            'collection_id' => 'required|integer',
            'lang_code' => 'required|string|size:2',
            'action' => 'required|in:select,deselect',
        ]);

        $user = Auth::user();
        $collectionId = $request->input('collection_id');
        $langCode = $request->input('lang_code');
        $action = $request->input('action');

        // collection_id is a vocabulary_libraries id (collections were merged
        // into libraries by the Wave A/B consolidation).
        $collection = AppQyV1VocabularyLibraryModel::findById((int) $collectionId);

        if (!$collection) {
            return response()->json([
                'success' => false,
                'error' => 'Collection not found',
            ], 404);
        }

        if ($collection->owner_user_id && $collection->owner_user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'error' => 'You do not have permission to access this collection',
            ], 403);
        }

        $message = AppQyV1UserSelectedLibraryModel::runInTransaction(function () use ($action, $user, $collection, $collectionId, $langCode) {
            if ($action === 'select') {
                AppQyV1UserSelectedLibraryModel::selectLibrary($user->id, $collectionId, $langCode);

                // Library words: word_ids resolved against the per-language
                // dictionary (one whereIn, word_ids order).
                $words = $collection->dictionaryWords(0, count($collection->getWordIdsArray()));
                $wordContents = $words->pluck('content')->toArray();

                if (!empty($wordContents)) {
                    AppQyV1UserLearningProgressModel::initializeWordsForUser(
                        $user->id,
                        $langCode,
                        $wordContents
                    );
                }

                return 'Library selected and words added to your learning progress';
            } else {
                AppQyV1UserSelectedLibraryModel::deselectLibrary($user->id, $collectionId);
                return 'Library deselected';
            }
        });

            return response()->json([
                'success' => true,
                'message' => $message,
            ]);

    }

    public function getWordCards(Request $request)
    {
        $user = Auth::user();
        $langCode = $request->input('lang_code', 'en');
        $limit = min($request->input('limit', 100), 100);

        $progressWords = AppQyV1UserLearningProgressModel::getWordsForLearning($user->id, $langCode, $limit);

        if ($progressWords->isEmpty()) {
            return response()->json([
                'success' => true,
                'data' => [
                    'words' => [],
                    'total' => 0,
                    'lang_code' => $langCode,
                    'message' => 'No words to learn. Please select a vocabulary library first.',
                ]
            ]);
        }

        $progressWords = $progressWords->shuffle();

        $wordMd5s = $progressWords->pluck('word_md5')->toArray();
        $dictionaryEntries = [];

        foreach ($wordMd5s as $md5) {
            $entry = AppQyV1LangDictionaryModel::findByMd5($langCode, $md5);
            if ($entry) {
                $dictionaryEntries[$md5] = $entry;
            }
        }

        $ttsService = new \App\Services\EdgeTTS\EdgeTTSService();

        $cards = $progressWords->map(function($progress) use ($dictionaryEntries, $user, $langCode, $ttsService) {
            $md5 = $progress->word_md5;
            $dictEntry = null;
            if (isset($dictionaryEntries[$md5])) {
                $dictEntry = $dictionaryEntries[$md5];
            }

            $nativeLang = 'zh';
            if (isset($user->native_language)) {
                $nativeLang = $user->native_language;
            }
            $translation = null;

            if ($dictEntry && $dictEntry->translations) {
                $translations = $dictEntry->translations;
                $translation = null;
                if (isset($translations[$nativeLang])) {
                    $translation = $translations[$nativeLang];
                }
            }

            $ttsFiles = [];
            if (isset($dictEntry?->tts_files)) {
                $ttsFiles = $dictEntry?->tts_files;
            }

            if (empty($ttsFiles) && $dictEntry) {
                    $result = $ttsService->generateAudio($progress->word_content, $langCode, 'word');

                    if ($result['success']) {
                        $ttsFiles = [[
                            'path' => $result['audio_path'],
                            'url' => AppQyV1TtsUrl::forPath($result['audio_path']),
                            'provider' => 'edge-tts',
                            'speed' => $result['speed'] ?? '+0%',
                            'created_at' => now()->toDateTimeString()
                        ]];

                        $dictEntry->tts_files = $ttsFiles;
                        $dictEntry->tts_provider = 'edge-tts';
                        $dictEntry->saveRecord();
                    }
            }

            return [
                'id' => $progress->id,
                'word' => $progress->word_content,
                'word_md5' => $md5,
                'learning_status' => $progress->learning_status,
                'familiarity_level' => $progress->familiarity_level,
                'review_count' => $progress->review_count,
                'correct_count' => $progress->correct_count,
                'wrong_count' => $progress->wrong_count,
                'translations' => $dictEntry?->translations ?? null,
                'native_translation' => $translation,
                'phonetic' => $dictEntry?->phonetic,
                'us_phonetic' => $dictEntry?->us_phonetic,
                'uk_phonetic' => $dictEntry?->uk_phonetic,
                'tts_files' => $ttsFiles,
                'image_files' => $dictEntry?->image_files ?? [],
                'word_details' => $dictEntry?->word_details,
                'next_review_at' => $progress->next_review_at,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'words' => $cards->values(),
                'total' => $cards->count(),
                'lang_code' => $langCode,
            ]
        ]);
    }

    public function updateProgress(Request $request)
    {
        $request->validate([
            'progress_id' => 'required|integer',
            'correct' => 'required|boolean',
        ]);

        $user = Auth::user();
        $progressId = $request->input('progress_id');
        $correct = $request->input('correct');

        $progress = AppQyV1UserLearningProgressModel::findById((int) $progressId);

        if (!$progress) {
            return response()->json([
                'success' => false,
                'error' => 'Progress record not found',
            ], 404);
        }

        if ($progress->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'error' => 'You do not have permission to update this progress',
            ], 403);
        }

        $progress->recordReview($correct);

        return response()->json([
            'success' => true,
            'message' => 'Progress updated',
            'data' => [
                'learning_status' => $progress->learning_status,
                'familiarity_level' => $progress->familiarity_level,
                'review_count' => $progress->review_count,
                'correct_count' => $progress->correct_count,
                'wrong_count' => $progress->wrong_count,
                'next_review_at' => $progress->next_review_at,
            ]
        ]);
    }

    public function getLearningStats(Request $request)
    {
        $user = Auth::user();
        $langCode = $request->input('lang_code');

        $stats = AppQyV1UserLearningProgressModel::getUserStats($user->id, $langCode);

        $selectedLibraries = AppQyV1UserSelectedLibraryModel::getUserSelectedLibraries(
            $user->id,
            $langCode,
            true
        );

        return response()->json([
            'success' => true,
            'data' => [
                'stats' => $stats,
                'selected_libraries_count' => $selectedLibraries->count(),
                'learning_languages' => $user->learning_languages ?? [],
                'native_language' => $user->native_language ?? 'zh',
            ]
        ]);
    }

    public function getReviewQueue(Request $request)
    {
        $user = Auth::user();
        $langCode = $request->input('lang_code');

        if (!$langCode) {
            $learningLanguages = [];
            if (isset($user->learning_languages)) {
                $learningLanguages = $user->learning_languages;
            }
            $langCode = 'en';
            if (isset($learningLanguages[0])) {
                $langCode = $learningLanguages[0];
            }
        }

        $queue = AppQyV1UserLearningProgressModel::dailyQueue((int) $user->id, $langCode);
        $reviewWords = $queue['review'];
        $newWords = $queue['new'];

        return response()->json([
            'success' => true,
            'data' => [
                'review_words' => $reviewWords->map(function($word) {
                    return [
                        'id' => $word->id,
                        'word' => $word->word_content,
                        'word_md5' => $word->word_md5,
                        'learning_status' => $word->learning_status,
                        'familiarity_level' => $word->familiarity_level,
                        'review_count' => $word->review_count,
                        'next_review_at' => $word->next_review_at,
                    ];
                }),
                'new_words' => $newWords->map(function($word) {
                    return [
                        'id' => $word->id,
                        'word' => $word->word_content,
                        'word_md5' => $word->word_md5,
                        'learning_status' => $word->learning_status,
                    ];
                }),
                'review_count' => $reviewWords->count(),
                'new_count' => $newWords->count(),
                'total_count' => $reviewWords->count() + $newWords->count(),
                'lang_code' => $langCode,
            ]
        ]);
    }
}
