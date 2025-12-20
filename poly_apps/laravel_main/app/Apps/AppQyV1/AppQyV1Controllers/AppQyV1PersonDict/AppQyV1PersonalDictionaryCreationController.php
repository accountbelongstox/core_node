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


namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1PersonDict;

use Illuminate\Http\JsonResponse;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1PersonalDictionariesModel;
use App\Utils\StrTool;
use App\Utils\ArrTool;
use Illuminate\Support\Facades\Auth;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1PersonalDictionaryPublicController as PDAPublic;
use App\Apps\AppQyV1\AppQyV1Requests\AppQyV1CreatePersonalDictionaryRequest;
use App\Traits\ApiResponse;
class AppQyV1PersonalDictionaryCreationController
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */


    public function createPersonalDictionary(AppQyV1CreatePersonalDictionaryRequest $request): JsonResponse
    {
        $dictionaries = $request->input('dictionaries');
        $dictionaries = StrTool::toWordArray($dictionaries);
        $result = PDAPublic::addPersonDictionaries($dictionaries);

        $data = $result['data'];
        if (is_string($data)) {
            $data = json_decode($data, true);
        }

        return $this->success([
            'dictionaries_length' => ArrTool::count($dictionaries),
            'id' => $result['id'],
            'data' => $data,
        ], 'Personal dictionary created successfully');
    }

}

