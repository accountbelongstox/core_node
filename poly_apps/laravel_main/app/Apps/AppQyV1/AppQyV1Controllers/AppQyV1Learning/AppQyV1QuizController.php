<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Learning;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserLearningProgressModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Traits\ApiResponse;

class AppQyV1QuizController extends Controller
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    private function resolveNativeLanguage($user): string
    {
        $nativeLang = 'zh';
        if (isset($user->native_language) && is_string($user->native_language) && $user->native_language !== '') {
            $nativeLang = $user->native_language;
        }
        return $nativeLang;
    }

    private function extractMeaning($entry, string $nativeLang): ?string
    {
        if ($entry === null) {
            return null;
        }

        $translations = $entry->translations;
        if (is_array($translations)) {
            if (isset($translations[$nativeLang]) && is_string($translations[$nativeLang]) && $translations[$nativeLang] !== '') {
                return $translations[$nativeLang];
            }
            foreach ($translations as $value) {
                if (is_string($value) && $value !== '') {
                    return $value;
                }
            }
        }

        return null;
    }

    public function generate(Request $request): JsonResponse
    {
        $user = Auth::user();
        $userId = Auth::id();

        $language = $request->input('language', 'en');
        if (!is_string($language) || $language === '') {
            $language = 'en';
        }

        $count = (int) $request->input('count', 10);
        if ($count <= 0) {
            $count = 10;
        }
        if ($count > 50) {
            $count = 50;
        }

        $nativeLang = $this->resolveNativeLanguage($user);

        $candidatePool = AppQyV1UserLearningProgressModel::where('user_id', $userId)
            ->where('lang_code', $language)
            ->whereIn('learning_status', ['learning', 'reviewing', 'mastered'])
            // Cross-DB "NULLS LAST then ascending" trick: (col IS NULL) sorts non-null
            // first (boolean 0) before null (1), then by col ASC. Valid on both sqlite
            // and pgsql; do NOT switch to "NULLS LAST" (sqlite does not support it).
            ->orderByRaw('next_review_at IS NULL, next_review_at ASC')
            ->limit(200)
            ->get();

        if ($candidatePool->count() < ($count + 3)) {
            $newWords = AppQyV1UserLearningProgressModel::where('user_id', $userId)
                ->where('lang_code', $language)
                ->where('learning_status', 'new')
                ->orderBy('created_at')
                ->limit(200)
                ->get();
            $candidatePool = $candidatePool->concat($newWords);
        }

        $candidatePool = $candidatePool->unique('word_md5')->values();

        $meaningByMd5 = [];
        $wordByMd5 = [];
        foreach ($candidatePool as $progress) {
            $md5 = $progress->word_md5;
            $entry = AppQyV1LangDictionaryModel::findByMd5($language, $md5);
            $meaning = $this->extractMeaning($entry, $nativeLang);
            if ($meaning !== null) {
                $meaningByMd5[$md5] = $meaning;
                $wordByMd5[$md5] = $progress->word_content;
            }
        }

        $usableMd5s = array_keys($meaningByMd5);

        $questions = [];
        if (count($usableMd5s) >= 4) {
            shuffle($usableMd5s);

            $allMeanings = array_values(array_unique($meaningByMd5));

            $built = 0;
            foreach ($usableMd5s as $md5) {
                if ($built >= $count) {
                    break;
                }

                $correctMeaning = $meaningByMd5[$md5];
                $word = $wordByMd5[$md5];

                $distractors = [];
                $distractorSource = $allMeanings;
                shuffle($distractorSource);
                foreach ($distractorSource as $candidateMeaning) {
                    if (count($distractors) >= 3) {
                        break;
                    }
                    if ($candidateMeaning === $correctMeaning) {
                        continue;
                    }
                    if (in_array($candidateMeaning, $distractors, true)) {
                        continue;
                    }
                    $distractors[] = $candidateMeaning;
                }

                if (count($distractors) < 3) {
                    continue;
                }

                $options = [];
                $options[] = ['text' => $correctMeaning, 'isCorrect' => true];
                foreach ($distractors as $distractor) {
                    $options[] = ['text' => $distractor, 'isCorrect' => false];
                }
                shuffle($options);

                $formattedOptions = [];
                $optionIndex = 0;
                foreach ($options as $option) {
                    $formattedOptions[] = [
                        'id' => $md5 . '_opt_' . $optionIndex,
                        'text' => $option['text'],
                        'isCorrect' => $option['isCorrect'],
                    ];
                    $optionIndex++;
                }

                $questions[] = [
                    'id' => 'q_' . $md5,
                    'wordId' => (string) $md5,
                    'question' => 'Select the correct meaning for: ' . $word,
                    'options' => $formattedOptions,
                    'type' => 'meaning',
                ];

                $built++;
            }
        }

        return $this->success($questions, 'Quiz generated successfully');
    }
}
