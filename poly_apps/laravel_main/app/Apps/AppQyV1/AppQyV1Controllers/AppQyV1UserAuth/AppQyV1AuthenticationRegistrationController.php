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


namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1UserAuth;

use Illuminate\Routing\Controller as BaseController;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\JsonResponse;
use App\Http\Common\CommonUserGen;
class AppQyV1AuthenticationRegistrationController extends BaseController
{
    /**
     * Handle an incoming registration request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function apiStore(Request $request): Response | JsonResponse
    {
        try {
            $request->validate([
                'username' => ['required', 'string', 'max:255'],
                'password' => ['required', 'string', 'min:6', 'max:255'],
            ]);

            if (CommonUserGen::checkUsernameIsExist($request->username)) {
                return response()->json([
                    'message' => 'Username already exists',
                    'code' => 400,
                    'status' => 'error',
                ], 400);
            }

            $email = $request->email ?? "";
            $nickname = $request->nickname ?? "";
            $name = $request->name ?? "";
            $userData = CommonUserGen::createUser($request->username, $request->password, $email, $nickname, $name, 'AppQyV1');

            if (!$userData) {
                \Log::error('[AppQyV1Registration] Registration failed for user', [
                    'username' => $request->username
                ]);
                return response()->json([
                    'message' => 'Registration failed. Please check the logs or try again.',
                    'code' => 500,
                    'status' => 'error',
                ], 500);
            }
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors(),
                'code' => 422,
                'status' => 'error',
            ], 422);
        } catch (\Exception $e) {
            \Log::error('[AppQyV1Registration] Unexpected error', [
                'username' => $request->username ?? 'unknown',
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'message' => 'Registration failed: ' . $e->getMessage(),
                'code' => 500,
                'status' => 'error',
            ], 500);
        }
        
        $user = $userData['user'];
        $token = $userData['token'];
        $expiration = $userData['expiration'];
        $uid = $userData['uid'];
        return response()->json([
            'token' => $token,
            'token_type' => 'Bearer',
            "expiration" => $expiration,
            'uid' => $uid,
            "user" => $user,
            'message' => 'User registered successfully',
            'code' => 200,
            'status' => 'success',
        ], 200);
    }
}

