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
use App\Utils\StrTool;
use App\Utils\ArrTool;
use App\Apps\AppQyV1\Utils\Dict\AppQyV1DictWrap as DictWrap;
use Illuminate\Support\Facades\Validator;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1PersonalDictionaryProcessPublicController as PDPPublic;
use App\Traits\ApiResponse;
class AppQyV1WordReviewStatusController
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    public function upReviewed(Request $request)
    {
        $supported_params = ['words','safe_update'];
        $validator = Validator::make($request->all(), [
            'words' => 'required',
            'safe_update' => 'nullable|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => $validator->errors()->first(),
                'supported_params' => $supported_params,
            ], 400);
        }
        $words = $request->input('words');
        $safeUpdate = $request->input('safe_update', false);
        $queryResult = PDPPublic::updateReviewedPDByWords($words, $safeUpdate);
        $message = 'Word "' . $words . '" reviewed updated done';
        return response()->json([
            'status' => 'success',
            'message' => $message,
            'supported_params' => $supported_params,
            'data' => $queryResult
        ], 200);
    }

}

