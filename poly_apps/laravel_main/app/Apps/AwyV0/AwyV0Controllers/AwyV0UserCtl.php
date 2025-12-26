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


namespace App\Apps\AwyV0\AwyV0Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Http\Common\CommonAuthService;

class AwyV0UserCtl extends Controller
{
    /**
     * Get user profile
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function profile(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'success' => true,
            'message' => 'User profile retrieved successfully',
            'data' => [
                'id' => $user->id,
                'username' => $user->username,
                'email' => $user->email,
                'phone' => $user->phone,
                'avatar' => $user->avatar,
                'bio' => $user->bio ?? '',
                'location' => $user->location ?? '',
                'createdAt' => $user->created_at->toISOString(),
                'updatedAt' => $user->updated_at->toISOString()
            ]
        ]);
    }

    /**
     * Update user profile
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateProfile(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'username' => 'string|min:3|max:50|unique:users,username,' . $request->user()->id,
            'email' => 'email|unique:users,email,' . $request->user()->id,
            'bio' => 'string|max:500',
            'location' => 'string|max:100'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'data' => $validator->errors()
            ], 400);
        }

        $user = $request->user();

        // Update only provided fields
        if ($request->has('username')) {
            $user->username = $request->input('username');
        }
        if ($request->has('email')) {
            $user->email = $request->input('email');
        }
        if ($request->has('bio')) {
            $user->bio = $request->input('bio');
        }
        if ($request->has('location')) {
            $user->location = $request->input('location');
        }

        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully',
            'data' => [
                'id' => $user->id,
                'username' => $user->username,
                'email' => $user->email,
                'phone' => $user->phone,
                'avatar' => $user->avatar,
                'bio' => $user->bio ?? '',
                'location' => $user->location ?? '',
                'updatedAt' => $user->updated_at->toISOString()
            ]
        ]);
    }

    /**
     * Change password
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function changePassword(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'current_password' => 'required|string',
            // [Removed] Password 'min:6' validation removed - no minimum requirement
            'new_password' => 'required|string|confirmed'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'data' => $validator->errors()
            ], 400);
        }

        $user = $request->user();
        $currentPassword = $request->input('current_password');
        $newPassword = $request->input('new_password');

        // Verify current password
        if (!Hash::check($currentPassword, $user->password)) {
            return response()->json([
                'success' => false,
                'error' => 'INVALID_CURRENT_PASSWORD',
                'message' => 'Current password is incorrect',
                'data' => null
            ], 400);
        }

        // Update password
        $user->password = Hash::make($newPassword);
        $user->save();

        // Revoke all existing tokens for security
        $user->tokens()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Password changed successfully',
            'data' => true
        ]);
    }

    /**
     * Bind phone number
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function bindPhone(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'phone' => 'required|string|unique:users,phone,' . $request->user()->id,
            'verification_code' => 'required|string|size:6'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'data' => $validator->errors()
            ], 400);
        }

        $phone = $request->input('phone');
        $verificationCode = $request->input('verification_code');

        // Verify SMS code (simplified implementation)
        if ($verificationCode !== '123456') { // Default code for testing
            return response()->json([
                'success' => false,
                'error' => 'INVALID_VERIFICATION_CODE',
                'message' => 'Invalid verification code',
                'data' => null
            ], 400);
        }

        $user = $request->user();
        $user->phone = $phone;
        $user->phone_verified_at = now();
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Phone number bound successfully',
            'data' => true
        ]);
    }

    /**
     * Bind email address
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function bindEmail(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email|unique:users,email,' . $request->user()->id,
            'verification_code' => 'required|string|size:6'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'data' => $validator->errors()
            ], 400);
        }

        $email = $request->input('email');
        $verificationCode = $request->input('verification_code');

        // Verify email code (simplified implementation)
        if ($verificationCode !== '123456') { // Default code for testing
            return response()->json([
                'success' => false,
                'error' => 'INVALID_VERIFICATION_CODE',
                'message' => 'Invalid verification code',
                'data' => null
            ], 400);
        }

        $user = $request->user();
        $user->email = $email;
        $user->email_verified_at = now();
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Email address bound successfully',
            'data' => true
        ]);
    }

    /**
     * Upload avatar
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function uploadAvatar(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'avatar' => 'required|image|mimes:jpeg,png,jpg,gif|max:5120' // Max 5MB
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'data' => $validator->errors()
            ], 400);
        }

        if ($request->hasFile('avatar')) {
            $file = $request->file('avatar');
            $filename = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();

            // Store file (in production, use cloud storage)
            $path = $file->storeAs('avatars', $filename, 'public');

            if (!$path) {
                return response()->json([
                    'success' => false,
                    'error' => 'UPLOAD_FAILED',
                    'message' => 'Failed to upload avatar',
                    'data' => null
                ], 500);
            }

            $user = $request->user();

            // Delete old avatar if exists
            if ($user->avatar) {
                // Delete old file logic here
            }

            $user->avatar = '/storage/' . $path;
            $user->save();

            return response()->json([
                'success' => true,
                'message' => 'Avatar uploaded successfully',
                'data' => [
                    'avatarUrl' => $user->avatar
                ]
            ]);
        }

        return response()->json([
            'success' => false,
            'error' => 'NO_FILE_UPLOADED',
            'message' => 'No avatar file uploaded',
            'data' => null
        ], 400);
    }
} 