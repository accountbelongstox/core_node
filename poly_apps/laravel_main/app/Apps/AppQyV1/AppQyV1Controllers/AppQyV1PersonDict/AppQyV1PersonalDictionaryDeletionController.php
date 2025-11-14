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
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
class AppQyV1PersonalDictionaryDeletionController 
{
    public function deleteDictionaries($id) 
    {   
        $uid = Auth::id();
        PersonalDictionaries::where('uid', $uid)->where('id', $id)->delete(); // Soft delete
        $personDictModel = new PersonalDictionaries(
            [
                'uid' => $uid,
            ]   
        );
        return $personDictModel;
    }

    public function deletePersonalAllDictionary(Request $request)
    {
        $supported_params = ['force'];
        $uid = Auth::id();
        $force = $request->input('force') ?? false;
        if($force === true){
            $deletedCount = PersonalDictionaries::where('uid', $uid)->forceDelete(); // Soft delete
        }else{
            $deletedCount = PersonalDictionaries::where('uid', $uid)->delete(); // Soft delete
        }
        return response()->json([
            'status' => 'success',
            "deleted_count" => $deletedCount,
            "force" => $force,
            "delete_type" => $force ? 'force' : 'soft',
            'message' => 'Personal dictionary deleted successfully',
            'supported_params' => $supported_params,
        ], 200);
    }

    public function deletePersonalDictionaryByID(Request $request)
    {   
        $supported_params = ['id'];
        $validator = Validator::make($request->all(), [
            'id' => 'required',
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => $validator->errors()->first(),
                'supported_params' => $supported_params,
            ], 400);
        }
        $personDictModel = $this->deleteDictionaries($request->id);
        return response()->json([
            'status' => 'success',
            'message' => 'Personal dictionary created successfully',
            'supported_params' => $supported_params,
            'id' => $personDictModel->id,
            'data' => json_decode($personDictModel->personal_dicts),
        ], 200);
    }

}

