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
use App\Apps\AwyV0\AwyV0DBTablesBrige\AwyV0TableMaps;

class AwyV0FriendCtl extends Controller
{
    /**
     * Get friends list
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function list(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'string|in:accepted,pending,blocked',
            'limit' => 'integer|min:1|max:100',
            'offset' => 'integer|min:0'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'data' => $validator->errors()
            ], 400);
        }

        $user = $request->user();
        $status = $request->input('status', 'accepted');
        $limit = $request->input('limit', 20);
        $offset = $request->input('offset', 0);

        // For now, return mock data since we don't have database tables yet
        // In production, this would query awy_v0_friends table
        $mockFriends = [
            [
                'id' => 1,
                'username' => 'john_doe',
                'avatar' => null,
                'status' => 'online',
                'lastSeen' => now()->subMinutes(5)->toISOString(),
                'friendshipStatus' => 'accepted',
                'createdAt' => now()->subDays(7)->toISOString()
            ],
            [
                'id' => 2,
                'username' => 'jane_smith',
                'avatar' => null,
                'status' => 'offline',
                'lastSeen' => now()->subHours(2)->toISOString(),
                'friendshipStatus' => 'accepted',
                'createdAt' => now()->subDays(14)->toISOString()
            ]
        ];

        return response()->json([
            'success' => true,
            'message' => 'Friends list retrieved successfully',
            'data' => [
                'friends' => array_slice($mockFriends, $offset, $limit),
                'pagination' => [
                    'total' => count($mockFriends),
                    'limit' => $limit,
                    'offset' => $offset,
                    'hasMore' => $offset + $limit < count($mockFriends)
                ]
            ]
        ]);
    }

    /**
     * Send friend request
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function add(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'user_id' => 'required|integer|exists:users,id',
            'message' => 'string|max:200'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'data' => $validator->errors()
            ], 400);
        }

        $user = $request->user();
        $friendId = $request->input('user_id');
        $message = $request->input('message', '');

        // Check if trying to add self
        if ($user->id === $friendId) {
            return response()->json([
                'success' => false,
                'error' => 'CANNOT_ADD_SELF',
                'message' => 'You cannot add yourself as a friend',
                'data' => null
            ], 400);
        }

        // Check if already friends
        // In production, check awy_v0_friends table
        if ($friendId === 1) { // Mock check
            return response()->json([
                'success' => false,
                'error' => 'ALREADY_FRIENDS',
                'message' => 'You are already friends with this user',
                'data' => null
            ], 400);
        }

        // Create friend request
        $friendshipId = uniqid('friend_', true);

        return response()->json([
            'success' => true,
            'message' => 'Friend request sent successfully',
            'data' => [
                'friendshipId' => $friendshipId,
                'status' => 'pending',
                'requestMessage' => $message
            ]
        ]);
    }

    /**
     * Remove friend
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function remove(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'friend_id' => 'required|integer'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'data' => $validator->errors()
            ], 400);
        }

        $user = $request->user();
        $friendId = $request->input('friend_id');

        // Check if friendship exists
        // In production, check awy_v0_friends table
        if ($friendId !== 1 && $friendId !== 2) {
            return response()->json([
                'success' => false,
                'error' => 'FRIEND_NOT_FOUND',
                'message' => 'Friend not found',
                'data' => null
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Friend removed successfully',
            'data' => true
        ]);
    }

    /**
     * Get friend information
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function info(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'friend_id' => 'required|integer'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'data' => $validator->errors()
            ], 400);
        }

        $friendId = $request->input('friend_id');

        // Find user
        $friend = User::find($friendId);
        if (!$friend) {
            return response()->json([
                'success' => false,
                'error' => 'USER_NOT_FOUND',
                'message' => 'User not found',
                'data' => null
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Friend information retrieved successfully',
            'data' => [
                'id' => $friend->id,
                'username' => $friend->username,
                'email' => $friend->email,
                'phone' => $friend->phone,
                'avatar' => $friend->avatar,
                'bio' => $friend->bio ?? '',
                'location' => $friend->location ?? '',
                'status' => 'online', // Mock status
                'lastSeen' => now()->subMinutes(rand(1, 60))->toISOString(),
                'friendshipStatus' => 'accepted'
            ]
        ]);
    }

    /**
     * Get friend health status
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function health(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'friend_id' => 'required|integer'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'data' => $validator->errors()
            ], 400);
        }

        $friendId = $request->input('friend_id');

        // Mock health data
        $healthData = [
            'status' => 'healthy',
            'lastActivity' => now()->subMinutes(rand(1, 30))->toISOString(),
            'activityScore' => rand(70, 100),
            'mood' => 'happy',
            'socialActivity' => 'active'
        ];

        return response()->json([
            'success' => true,
            'message' => 'Friend health status retrieved successfully',
            'data' => $healthData
        ]);
    }

    /**
     * Search for users to add as friends
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function search(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'query' => 'required|string|min:2|max:50',
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
        $limit = $request->input('limit', 20);
        $currentUser = $request->user();

        // Search users by username or email
        $users = User::where('id', '!=', $currentUser->id)
            ->where(function ($q) use ($query) {
                $q->where('username', 'like', "%{$query}%")
                  ->orWhere('email', 'like', "%{$query}%");
            })
            ->limit($limit)
            ->get(['id', 'username', 'email', 'phone', 'avatar']);

        $results = $users->map(function ($user) {
            return [
                'id' => $user->id,
                'username' => $user->username,
                'avatar' => $user->avatar,
                'mutualFriends' => rand(0, 10), // Mock data
                'isAlreadyFriend' => false // Mock data
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'User search completed successfully',
            'data' => [
                'results' => $results,
                'total' => $results->count()
            ]
        ]);
    }
} 