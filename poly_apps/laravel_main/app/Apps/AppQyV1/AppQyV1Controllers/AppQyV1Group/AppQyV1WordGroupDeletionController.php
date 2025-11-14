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


namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Group;

use Illuminate\Http\Request;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;
use App\Utils\StrTool;
use App\Utils\ArrTool;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class AppQyV1WordGroupDeletionController 
{
    public function isGroupNameExist($gname,$gid=null)
    {
        $uid = Auth::id();
        return $gid ? 
            AppQyV1WordGroupModel::where('gid', $gid)->where('uid', $uid)->first() :
            AppQyV1WordGroupModel::where('gname', $gname)->where('uid', $uid)->first();
    }

    public function deleteDictGroupByGname(Request $request)
    {
        $supported_params = ['gname'];
        $validator = Validator::make($request->all(), [
            'gname' => 'required|string',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => $validator->errors()->first(),
                'supported_params' => $supported_params,
            ], 400);
        }
        $gname = $request->input('gname');
        $existGroup = $this->isGroupNameExist($gname);
        if (!$existGroup) {
            return response()->json([
                'status' => 'error',
                'message' => 'Group not found',
                'supported_params' => $supported_params,
            ], 404);
        }
        $existGroup->delete();
        return response()->json([
            'status' => 'success',
            'message' => 'Group deleted successfully',
            'supported_params' => $supported_params,
        ]);
    }

    public function deleteDictGroupByGid(Request $request)
    {
        $supported_params = ['gid'];
        try {
            $validator = Validator::make($request->all(), [
                'gid' => 'required|string',
            ]);
            if ($validator->fails()) {
                return response()->json([
                    'status' => 'error',
                    'message' => $validator->errors()->first(),
                    'supported_params' => $supported_params,
                ], 400);
            }
            $gid = $request->input('gid');
            $existGroup = $this->isGroupNameExist($gid);
            if (!$existGroup) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Group not found',
                    'supported_params' => $supported_params,
                ], 404);
            }
            $existGroup->delete();
            return response()->json([
                'status' => 'success',
                'message' => 'Group deleted successfully',
                'supported_params' => $supported_params,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
                'supported_params' => $supported_params,
            ], 500);
        }
    }
}

