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

use Illuminate\Http\Request;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1PersonalDictionariesModel;
use App\Utils\StrTool;
use App\Utils\ArrTool;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1PersonalDictionaryPublicController as PDAPublic;
class AppQyV1PersonalDictionaryCreationController 
{

    public function createPersonalDictionary(Request $request)
    {   
        $supported_params = ['dictionaries'];
        $validator = Validator::make($request->all(), [
            'dictionaries' => 'required',
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => $validator->errors()->first(),
                'supported_params' => $supported_params,
            ], 400);
        }
        $dictionaries = $request->input('dictionaries');
        $dictionaries = StrTool::toWordArray($dictionaries);
        $result = PDAPublic::addPersonDictionaries($dictionaries);
        $data = $result['data'];
        if(is_string($data)){
            $data = json_decode($data, true);
        }
        return response()->json([
            'status' => 'success',
            'message' => 'Personal dictionary created successfully',
            'supported_params' => $supported_params,
            "dictionaries_lenght" => ArrTool::count($dictionaries),
            'id' => $result['id'],
            'data' => $data,
        ], 200);
    }

}

