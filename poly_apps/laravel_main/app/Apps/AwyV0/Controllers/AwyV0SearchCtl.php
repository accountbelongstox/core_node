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
use App\Models\User;

class AwyV0SearchCtl extends Controller
{
    /**
     * Global search
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function search(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'query' => 'required|string|min:2|max:100',
            'type' => 'string|in:users,content,all',
            'limit' => 'integer|min:1|max:50'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'data' => $validator->errors()
            ], 400);
        }

        $query = $request->input('query');
        $type = $request->input('type', 'all');
        $limit = $request->input('limit', 20);
        $currentUser = $request->user();

        $results = [
            'users' => [],
            'content' => []
        ];

        if ($type === 'users' || $type === 'all') {
            // Search users
            $users = User::where('id', '!=', $currentUser->id)
                ->where(function ($q) use ($query) {
                    $q->where('username', 'like', "%{$query}%")
                      ->orWhere('email', 'like', "%{$query}%")
                      ->orWhere('bio', 'like', "%{$query}%");
                })
                ->limit($limit)
                ->get(['id', 'username', 'email', 'avatar', 'bio']);

            $results['users'] = $users->map(function ($user) {
                return [
                    'id' => $user->id,
                    'username' => $user->username,
                    'avatar' => $user->avatar,
                    'bio' => $user->bio ?? '',
                    'type' => 'user'
                ];
            })->toArray();
        }

        if ($type === 'content' || $type === 'all') {
            // Mock content search results
            // In production, this would search messages, posts, etc.
            $results['content'] = [
                [
                    'id' => 'content_1',
                    'title' => 'Sample message about ' . $query,
                    'content' => 'This is a sample message that contains the search term: ' . $query,
                    'type' => 'message',
                    'timestamp' => now()->subHours(2)->toISOString(),
                    'author' => [
                        'id' => 1,
                        'username' => 'john_doe'
                    ]
                ],
                [
                    'id' => 'content_2',
                    'title' => 'Discussion about ' . $query,
                    'content' => 'People are discussing various topics related to ' . $query . ' in this conversation',
                    'type' => 'conversation',
                    'timestamp' => now()->subDays(1)->toISOString(),
                    'author' => [
                        'id' => 2,
                        'username' => 'jane_smith'
                    ]
                ]
            ];
        }

        return response()->json([
            'success' => true,
            'message' => 'Search completed successfully',
            'data' => [
                'results' => array_merge($results['users'], $results['content']),
                'total' => count($results['users']) + count($results['content']),
                'query' => $query,
                'type' => $type
            ]
        ]);
    }

    /**
     * Search users specifically
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function searchUsers(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'query' => 'required|string|min:2|max:50',
            'limit' => 'integer|min:1|max:100',
            'include_friends' => 'boolean'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'data' => $validator->errors()
            ], 400);
        }

        $query = $request->input('query');
        $limit = $request->input('limit', 20);
        $includeFriends = $request->input('include_friends', false);
        $currentUser = $request->user();

        $usersQuery = User::where('id', '!=', $currentUser->id)
            ->where(function ($q) use ($query) {
                $q->where('username', 'like', "%{$query}%")
                  ->orWhere('email', 'like', "%{$query}%")
                  ->orWhere('bio', 'like', "%{$query}%");
            });

        if (!$includeFriends) {
            // Exclude friends from search
            // In production, this would filter out users already in friends list
        }

        $users = $usersQuery->limit($limit)
            ->get(['id', 'username', 'email', 'phone', 'avatar', 'bio']);

        $results = $users->map(function ($user) use ($currentUser) {
            return [
                'id' => $user->id,
                'username' => $user->username,
                'avatar' => $user->avatar,
                'bio' => $user->bio ?? '',
                'isFriend' => false, // Mock data
                'mutualFriends' => rand(0, 15), // Mock data
                'lastSeen' => now()->subMinutes(rand(1, 1440))->toISOString()
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'User search completed successfully',
            'data' => [
                'users' => $results,
                'total' => $results->count(),
                'query' => $query
            ]
        ]);
    }
}