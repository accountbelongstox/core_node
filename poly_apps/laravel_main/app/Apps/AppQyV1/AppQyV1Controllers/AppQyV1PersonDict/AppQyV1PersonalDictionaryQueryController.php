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
use App\Apps\AppQyV1\Utils\Dict\AppQyV1DictWrap as DictWrap;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1PersonalDictionaryQueryBasePublicController as PDQBasePublic;
use App\Apps\AppQyV1\AppQyV1Requests\AppQyV1QueryPersonalDictionaryRequest;
use App\Apps\AppQyV1\AppQyV1Requests\AppQyV1QueryPersonalDictionaryByWordsRequest;
use App\Traits\ApiResponse;

class AppQyV1PersonalDictionaryQueryController
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    public function queryPDictionary(AppQyV1QueryPersonalDictionaryRequest $request): JsonResponse
    {
        $isQueryAlreadSoftDelete = false;
        if ($request->has('query_soft_delete')) {
            $isQueryAlreadSoftDelete = $request->input('query_soft_delete');
        }

        $userId = Auth::id();
        $cacheKey = "personal_dictionary:{$userId}:" . ($isQueryAlreadSoftDelete ? 'soft' : 'active');

        $queryResult = Cache::remember($cacheKey, now()->addMinutes(10), function () use ($isQueryAlreadSoftDelete) {
            return PDQBasePublic::queryPersonalDictionary($isQueryAlreadSoftDelete);
        });

        return $this->success([
            ...$queryResult
        ], 'Personal dictionary queried successfully');
    }

    public function queryPDictionaryByWords(AppQyV1QueryPersonalDictionaryByWordsRequest $request): JsonResponse
    {
        $words = $request->input('words');
        $words = StrTool::toWordArray($words);
        $queryResult = PDQBasePublic::queryPDByWord($words);

        return $this->success([
            ...$queryResult
        ], 'Personal dictionary queried by words successfully');
    }

}

