<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordOparate;

use Illuminate\Http\Request;
use App\Utils\StrTool;
use App\Utils\ArrTool;
use App\Apps\AppQyV1\Utils\Dict\AppQyV1DictWrap as DictWrap;
use Illuminate\Support\Facades\Validator;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1PersonalDictionaryProcessPublicController as PDPPublic;
use App\Traits\ApiResponse;
class AppQyV1WordWeightController
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    public function upWeight(Request $request)
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
        $queryResult = PDPPublic::updateWeightPDByWords($words, $safeUpdate);
        $message = 'Word "' . $words . '" weight updated done';
        return response()->json([
            'status' => 'success',
            'message' => $message,
            'supported_params' => $supported_params,
            'data' => $queryResult
        ], 200);
    }

}

