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


namespace App\Apps\DictV1\Controllers\DictV1PersonDict;

use Illuminate\Http\Request;
use App\Apps\DictV1\DictV1Models\DictV1PersonalDictionariesModel;
use App\Utils\StrTool;
use App\Utils\ArrTool;
use App\Apps\DictV1\Utils\Dict\DictWrap;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use App\Apps\DictV1\Controllers\DictV1Public\DictV1PersonalDictionaryQueryBasePublicController as PDQBasePublic;

class DictV1PersonalDictionaryQueryController 
{
    public function queryPDictionary(Request $request)
    {
        $supported_params = ['query_soft_delete'];
        $isQueryAlreadSoftDelete  = $request->input('query_soft_delete') ?? false;
        $queryResult = PDQBasePublic::queryPersonalDictionary($isQueryAlreadSoftDelete);
        return response()->json([
            'status' => 'success',
            'message' => 'Personal dictionary created successfully',
            'supported_params' => $supported_params,
            ...$queryResult
        ], 200);
    }

    public function queryPDictionaryByWords(Request $request)
    {
        $supported_params = ['words'];
        $words = $request->input('words');
        $words = StrTool::toWordArray($words);
        $queryResult = PDQPublic::queryPDByWord($words);
        return response()->json([
            'status' => 'success',
            'message' => 'Personal dictionary created successfully',
            'supported_params' => $supported_params,
            ...$queryResult
        ], 200);
    }

}
