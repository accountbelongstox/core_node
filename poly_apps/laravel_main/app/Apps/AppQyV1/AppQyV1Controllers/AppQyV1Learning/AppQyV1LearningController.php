<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Learning;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyCollectionModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyItemModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserLearningProgressModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserSelectedLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1MultiLangDictionaryModel;

class AppQyV1LearningController extends Controller
{
    public function getUserLanguages(Request $request)
    {
        $user = Auth::user();

        $learningLanguages = $user->learning_languages ?? [];
        $nativeLanguage = $user->native_language ?? 'zh';

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

        $user->save();

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
            $learningLanguages = $user->learning_languages ?? [];
            $langCode = $learningLanguages[0] ?? 'en';
        }

        $publicLibraries = AppQyV1VocabularyCollectionModel::getPublicCollections($langCode);

        $userLibraries = AppQyV1VocabularyCollectionModel::getUserCollections($user->id, $langCode);

        $selectedLibraries = AppQyV1UserSelectedLibraryModel::getUserSelectedLibraries(
            $user->id,
            $langCode,
            true
        );

        $selectedIds = $selectedLibraries->pluck('collection_id')->toArray();

        return response()->json([
            'success' => true,
            'data' => [
                'public_libraries' => $publicLibraries->map(function($lib) use ($selectedIds) {
                    return [
                        'id' => $lib->id,
                        'name' => $lib->collection_name,
                        'lang_code' => $lib->lang_code,
                        'total_words' => $lib->total_words,
                        'description' => $lib->description,
                        'is_selected' => in_array($lib->id, $selectedIds),
                    ];
                }),
                'user_libraries' => $userLibraries->map(function($lib) use ($selectedIds) {
                    return [
                        'id' => $lib->id,
                        'name' => $lib->collection_name,
                        'lang_code' => $lib->lang_code,
                        'total_words' => $lib->total_words,
                        'description' => $lib->description,
                        'is_selected' => in_array($lib->id, $selectedIds),
                    ];
                }),
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

        $collection = AppQyV1VocabularyCollectionModel::find($collectionId);

        if (!$collection) {
            return response()->json([
                'success' => false,
                'error' => 'Collection not found',
            ], 404);
        }

        if ($collection->owner_id && $collection->owner_id !== $user->id) {
            return response()->json([
                'success' => false,
                'error' => 'You do not have permission to access this collection',
            ], 403);
        }

        try {
            DB::connection('AppQyV1')->beginTransaction();

            if ($action === 'select') {
                AppQyV1UserSelectedLibraryModel::selectLibrary($user->id, $collectionId, $langCode);

                $words = AppQyV1VocabularyItemModel::getWordsForCollection($collectionId);
                $wordContents = $words->pluck('word_content')->toArray();

                if (!empty($wordContents)) {
                    AppQyV1UserLearningProgressModel::initializeWordsForUser(
                        $user->id,
                        $langCode,
                        $wordContents
                    );
                }

                $message = 'Library selected and words added to your learning progress';
            } else {
                AppQyV1UserSelectedLibraryModel::deselectLibrary($user->id, $collectionId);
                $message = 'Library deselected';
            }

            DB::connection('AppQyV1')->commit();

            return response()->json([
                'success' => true,
                'message' => $message,
            ]);

        } catch (\Exception $e) {
            DB::connection('AppQyV1')->rollBack();

            Log::error('[AppQyV1Learning] Error selecting library', [
                'user_id' => $user->id,
                'collection_id' => $collectionId,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to process request: ' . $e->getMessage(),
            ], 500);
        }
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
            $entry = AppQyV1MultiLangDictionaryModel::findByMd5($langCode, $md5);
            if ($entry) {
                $dictionaryEntries[$md5] = $entry;
            }
        }

        $ttsService = new \App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TTSService();

        $cards = $progressWords->map(function($progress) use ($dictionaryEntries, $user, $langCode, $ttsService) {
            $md5 = $progress->word_md5;
            $dictEntry = $dictionaryEntries[$md5] ?? null;

            $nativeLang = $user->native_language ?? 'zh';
            $translation = null;

            if ($dictEntry && $dictEntry->translations) {
                $translations = $dictEntry->translations;
                $translation = $translations[$nativeLang] ?? null;
            }

            $ttsFiles = $dictEntry?->tts_files ?? [];

            if (empty($ttsFiles) && $dictEntry) {
                try {
                    $result = $ttsService->generateAudio($progress->word_content, $langCode, 'word');

                    if ($result['success']) {
                        $ttsFiles = [[
                            'path' => $result['audio_path'],
                            'url' => $result['audio_url'],
                            'provider' => 'edge-tts',
                            'speed' => $result['speed'] ?? '+0%',
                            'created_at' => now()->toDateTimeString()
                        ]];

                        $dictEntry->tts_files = $ttsFiles;
                        $dictEntry->tts_provider = 'edge-tts';
                        $dictEntry->save();
                    }
                } catch (\Exception $e) {
                    Log::warning('[AppQyV1Learning] Failed to generate TTS on demand', [
                        'word' => $progress->word_content,
                        'lang' => $langCode,
                        'error' => $e->getMessage()
                    ]);
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

        $progress = AppQyV1UserLearningProgressModel::find($progressId);

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
}
