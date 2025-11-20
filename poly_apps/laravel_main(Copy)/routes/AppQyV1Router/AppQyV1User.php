<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| AppQyV1 User Routes
|--------------------------------------------------------------------------
|
| Routes for user progress, stats, and profile management
| Base path: /api/user/
|
*/

Route::prefix('user')->middleware('auth:sanctum')->group(function () {

    // User learning progress
    Route::get('/progress', function () {
        return response()->json([
            'success' => true,
            'data' => [
                'totalWords' => 150,
                'learnedWords' => 45,
                'reviewedWords' => 30,
                'studyStreak' => 7,
                'lastStudyDate' => now()->toDateString()
            ]
        ]);
    });

    // User statistics
    Route::get('/stats', function () {
        return response()->json([
            'success' => true,
            'data' => [
                'studyDays' => 25,
                'totalWords' => 150,
                'completionRate' => 30.0,
                'averageAccuracy' => 85.5,
                'totalStudyTime' => 1200 // minutes
            ]
        ]);
    });

    // User profile
    Route::get('/profile', function () {
        return response()->json([
            'success' => true,
            'data' => [
                'id' => auth()->id(),
                'displayName' => auth()->user()->display_name ?? 'User',
                'avatar' => auth()->user()->avatar,
                'studyLevel' => 'Beginner',
                'joinDate' => auth()->user()->created_at->toDateString()
            ]
        ]);
    });

    // Update profile
    Route::put('/profile', function (\Illuminate\Http\Request $request) {
        $request->validate([
            'displayName' => 'string|max:255',
            'avatar' => 'string|url|nullable'
        ]);

        $user = auth()->user();
        if ($request->has('displayName')) {
            $user->display_name = $request->input('displayName');
        }
        if ($request->has('avatar')) {
            $user->avatar = $request->input('avatar');
        }
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully'
        ]);
    });

});