<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Group;

use App\Http\Controllers\Controller;

use Illuminate\Http\Request;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;
use App\Utils\StrTool;
use App\Utils\ArrTool;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use App\Traits\ApiResponse;

class AppQyV1WordGroupDeletionController extends Controller
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    public function isGroupNameExist($gname,$gid=null)
    {
        $uid = Auth::id();
        return $gid ? 
            AppQyV1WordGroupModel::findOwnedByGid($uid, $gid) :
            AppQyV1WordGroupModel::findOwnedByName($uid, $gname);
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
        $existGroup->deleteRecord();
        return response()->json([
            'status' => 'success',
            'message' => 'Group deleted successfully',
            'supported_params' => $supported_params,
        ]);
    }

    public function deleteDictGroupByGid(Request $request)
    {
        $supported_params = ['gid'];
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
            $existGroup = $this->isGroupNameExist(null, $gid);
            if (!$existGroup) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Group not found',
                    'supported_params' => $supported_params,
                ], 404);
            }
            $existGroup->deleteRecord();
            return response()->json([
                'status' => 'success',
                'message' => 'Group deleted successfully',
                'supported_params' => $supported_params,
            ]);
    }
}
