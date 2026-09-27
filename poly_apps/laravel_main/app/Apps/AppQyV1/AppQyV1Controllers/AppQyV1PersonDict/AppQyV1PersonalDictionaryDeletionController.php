<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1PersonDict;

use App\Http\Controllers\Controller;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1PersonalDictionaryEntryModel;
use App\Traits\ApiResponse;

class AppQyV1PersonalDictionaryDeletionController extends Controller
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

        AppQyV1PersonalDictionaryEntryModel::deleteForUser((int) $uid, (int) $id);

        return $this->success([
            'message' => __('app_qy_v1.messages.personal_dictionary_entry_deleted'),
        ], __('app_qy_v1.messages.personal_dictionary_entry_deleted'));
    }

    public function deletePersonalAllDictionary(Request $request): JsonResponse
    {
        $uid = Auth::id();

        AppQyV1PersonalDictionaryEntryModel::deleteForUser((int) $uid);

        return $this->success([
            'message' => __('app_qy_v1.messages.personal_dictionary_all_entries_deleted'),
        ], __('app_qy_v1.messages.personal_dictionary_all_entries_deleted'));
    }

}
