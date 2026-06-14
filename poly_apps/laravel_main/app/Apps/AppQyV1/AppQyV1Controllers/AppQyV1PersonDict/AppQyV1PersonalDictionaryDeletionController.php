<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1PersonDict;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1PersonalDictionaryEntryModel;
use App\Traits\ApiResponse;

class AppQyV1PersonalDictionaryDeletionController
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    public function deletePersonalDictionaryByID(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'id' => 'required',
        ]);

        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $uid = Auth::id();
        $id = $request->input('id');

        AppQyV1PersonalDictionaryEntryModel::where('uid', $uid)
            ->where('id', $id)
            ->delete();

        return $this->success([
            'message' => 'Personal dictionary entry deleted successfully',
        ], 'Personal dictionary entry deleted successfully');
    }

    public function deletePersonalAllDictionary(Request $request): JsonResponse
    {
        $uid = Auth::id();

        AppQyV1PersonalDictionaryEntryModel::where('uid', $uid)->delete();

        return $this->success([
            'message' => 'All personal dictionary entries deleted successfully',
        ], 'All personal dictionary entries deleted successfully');
    }

}
