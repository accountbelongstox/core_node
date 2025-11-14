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


namespace App\Apps\AwyV0\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class AwyV0ChatCtl extends Controller
{
    /**
     * Get chat history
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getChatList(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'friend_id' => 'required|integer'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'code' => 400,
                'msg' => 'Validation failed',
                'data' => $validator->errors()
            ], 400);
        }

        // TODO: Implement get chat history logic
        return response()->json([
            'code' => 200,
            'msg' => 'success',
            'data' => []
        ]);
    }

    /**
     * Send a message
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function sendMessage(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'friend_id' => 'required|integer',
            'content' => 'required|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'code' => 400,
                'msg' => 'Validation failed',
                'data' => $validator->errors()
            ], 400);
        }

        // TODO: Implement send message logic
        return response()->json([
            'code' => 200,
            'msg' => 'success',
            'data' => []
        ]);
    }
} 