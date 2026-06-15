<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordOparate;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Utils\StrTool;
use App\Utils\ArrTool;
use App\Apps\AppQyV1\Utils\Dict\AppQyV1DictWrap as DictWrap;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1PersonalDictionaryProcessPublicController as PDPPublic;
use App\Apps\AppQyV1\AppQyV1Requests\AppQyV1UpdateLearnedStatusRequest;
use App\Traits\ApiResponse;
class AppQyV1WordLearningStatusController
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    public function upLearned(AppQyV1UpdateLearnedStatusRequest $request): JsonResponse
    {
        $words = $request->input('words');
        $safeUpdate = $request->input('safe_update', false);
        $queryResult = PDPPublic::updateLearnedPDByWords($words, $safeUpdate);

        return $this->success(
            $queryResult,
            'Word "' . $words . '" learned status updated successfully'
        );
    }

    /**
     * Mark a single word as learned by its dictionary id.
     * Route: POST /api/app_qy_v1/words/{id}/learn
     * Reuses the same personal-dictionary update path as upLearned,
     * resolving the word text from its dictionary id first.
     */
    public function markAsLearned(Request $request, $id): JsonResponse
    {
        $language = $request->input('language', 'en');
        $dictionaryRow = AppQyV1LangDictionaryModel::forLanguage($language)->find($id);

        if ($dictionaryRow === null) {
            return $this->notFound('Word not found');
        }

        $wordText = $dictionaryRow->content;
        $queryResult = PDPPublic::updateLearnedPDByWords($wordText, false);

        return $this->success(
            $queryResult,
            'Word "' . $wordText . '" marked as learned successfully'
        );
    }

    /**
     * Mark a single word as reviewed by its dictionary id.
     * Route: POST /api/app_qy_v1/words/{id}/review
     * Reuses the same personal-dictionary update path as the
     * word-text based review endpoint.
     */
    public function markAsReviewed(Request $request, $id): JsonResponse
    {
        $language = $request->input('language', 'en');
        $dictionaryRow = AppQyV1LangDictionaryModel::forLanguage($language)->find($id);

        if ($dictionaryRow === null) {
            return $this->notFound('Word not found');
        }

        $wordText = $dictionaryRow->content;
        $queryResult = PDPPublic::updateReviewedPDByWords($wordText, false);

        return $this->success(
            $queryResult,
            'Word "' . $wordText . '" marked as reviewed successfully'
        );
    }

}

