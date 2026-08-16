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

use App\Http\Controllers\Controller;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1PersonalDictionaryEntryModel;
use App\Traits\ApiResponse;

class AppQyV1PersonalDictionaryCreationController extends Controller
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    public function createPersonalDictionary(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'word' => 'required|string|max:255',
            'definition' => 'nullable|string',
            'example' => 'nullable|string',
            'notes' => 'nullable|string',
            'language' => 'nullable|string|max:16',
        ]);

        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $uid = Auth::id();
        $language = $request->input('language');
        if ($language === null) {
            $language = 'en';
        }

        $entry = new AppQyV1PersonalDictionaryEntryModel();
        $entry->uid = $uid;
        $entry->word = $request->input('word');
        $entry->language = $language;
        $entry->definition = $request->input('definition');
        $entry->example = $request->input('example');
        $entry->notes = $request->input('notes');
        $entry->saveRecord();

        return $this->success([
            'id' => (string) $entry->id,
            'message' => 'Personal dictionary entry created successfully',
        ], 'Personal dictionary entry created successfully');
    }

}
