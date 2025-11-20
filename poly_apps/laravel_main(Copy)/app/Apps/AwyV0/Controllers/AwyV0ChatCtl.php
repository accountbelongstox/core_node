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

class AwyV0ChatCtl extends Controller
{
    /**
     * Get conversation list
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function conversations(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'limit' => 'integer|min:1|max:50',
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
        $limit = $request->input('limit', 20);
        $offset = $request->input('offset', 0);

        // Mock conversation data
        $mockConversations = [
            [
                'id' => 'conv_1',
                'participant' => [
                    'id' => 1,
                    'username' => 'john_doe',
                    'avatar' => null
                ],
                'lastMessage' => [
                    'content' => 'Hey, how are you?',
                    'timestamp' => now()->subMinutes(5)->toISOString(),
                    'sender' => 'friend'
                ],
                'unreadCount' => 2
            ],
            [
                'id' => 'conv_2',
                'participant' => [
                    'id' => 2,
                    'username' => 'jane_smith',
                    'avatar' => null
                ],
                'lastMessage' => [
                    'content' => 'See you tomorrow!',
                    'timestamp' => now()->subHours(2)->toISOString(),
                    'sender' => 'me'
                ],
                'unreadCount' => 0
            ]
        ];

        return response()->json([
            'success' => true,
            'message' => 'Conversations retrieved successfully',
            'data' => [
                'conversations' => array_slice($mockConversations, $offset, $limit),
                'pagination' => [
                    'total' => count($mockConversations),
                    'limit' => $limit,
                    'offset' => $offset,
                    'hasMore' => $offset + $limit < count($mockConversations)
                ]
            ]
        ]);
    }

    /**
     * Get conversation messages
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function messages(Request $request, $conversationId)
    {
        $validator = Validator::make($request->all(), [
            'limit' => 'integer|min:1|max:100',
            'before' => 'string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'data' => $validator->errors()
            ], 400);
        }

        $limit = $request->input('limit', 50);
        $before = $request->input('before');

        // Mock messages data
        $mockMessages = [
            [
                'id' => 'msg_1',
                'senderId' => $request->user()->id,
                'content' => 'Hi there!',
                'timestamp' => now()->subHours(1)->toISOString(),
                'type' => 'text'
            ],
            [
                'id' => 'msg_2',
                'senderId' => 1,
                'content' => 'Hello! How can I help you?',
                'timestamp' => now()->subMinutes(55)->toISOString(),
                'type' => 'text'
            ],
            [
                'id' => 'msg_3',
                'senderId' => $request->user()->id,
                'content' => 'I wanted to ask about the project',
                'timestamp' => now()->subMinutes(50)->toISOString(),
                'type' => 'text'
            ]
        ];

        return response()->json([
            'success' => true,
            'message' => 'Messages retrieved successfully',
            'data' => [
                'messages' => $mockMessages,
                'conversationId' => $conversationId,
                'hasMore' => false
            ]
        ]);
    }

    /**
     * Send message
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function send(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'conversation_id' => 'required|string',
            'content' => 'required|string|max:1000',
            'type' => 'string|in:text,image,file'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'data' => $validator->errors()
            ], 400);
        }

        $conversationId = $request->input('conversation_id');
        $content = $request->input('content');
        $type = $request->input('type', 'text');
        $user = $request->user();

        // Generate message ID
        $messageId = 'msg_' . uniqid();
        $timestamp = now()->toISOString();

        // Mock message sending
        $message = [
            'id' => $messageId,
            'senderId' => $user->id,
            'content' => $content,
            'timestamp' => $timestamp,
            'type' => $type,
            'isRead' => false
        ];

        return response()->json([
            'success' => true,
            'message' => 'Message sent successfully',
            'data' => [
                'messageId' => $messageId,
                'timestamp' => $timestamp,
                'conversationId' => $conversationId
            ]
        ]);
    }

    /**
     * Get chat history with specific friend
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function history(Request $request, $friendId)
    {
        $validator = Validator::make($request->all(), [
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

        $limit = $request->input('limit', 50);
        $offset = $request->input('offset', 0);

        // Check if friend exists
        $friend = User::find($friendId);
        if (!$friend) {
            return response()->json([
                'success' => false,
                'error' => 'USER_NOT_FOUND',
                'message' => 'User not found',
                'data' => null
            ], 404);
        }

        // Mock chat history
        $mockMessages = [
            [
                'id' => 'msg_1',
                'senderId' => $request->user()->id,
                'senderName' => $request->user()->username,
                'content' => 'Hey, how are you doing?',
                'timestamp' => now()->subDays(1)->toISOString(),
                'type' => 'text',
                'isRead' => true
            ],
            [
                'id' => 'msg_2',
                'senderId' => $friendId,
                'senderName' => $friend->username,
                'content' => 'I\'m doing great! Just working on some projects.',
                'timestamp' => now()->subDays(1)->subMinutes(30)->toISOString(),
                'type' => 'text',
                'isRead' => true
            ],
            [
                'id' => 'msg_3',
                'senderId' => $friendId,
                'senderName' => $friend->username,
                'content' => 'How about you?',
                'timestamp' => now()->subDays(1)->subMinutes(25)->toISOString(),
                'type' => 'text',
                'isRead' => true
            ]
        ];

        $paginatedMessages = array_slice(array_reverse($mockMessages), $offset, $limit);

        return response()->json([
            'success' => true,
            'message' => 'Chat history retrieved successfully',
            'data' => [
                'friend' => [
                    'id' => $friend->id,
                    'username' => $friend->username,
                    'avatar' => $friend->avatar
                ],
                'messages' => $paginatedMessages,
                'pagination' => [
                    'total' => count($mockMessages),
                    'limit' => $limit,
                    'offset' => $offset,
                    'hasMore' => $offset + $limit < count($mockMessages)
                ]
            ]
        ]);
    }

    /**
     * Delete message
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function deleteMessage(Request $request, $messageId)
    {
        // In a real implementation, you would check if the user owns the message
        // and delete it from the database

        return response()->json([
            'success' => true,
            'message' => 'Message deleted successfully',
            'data' => [
                'messageId' => $messageId
            ]
        ]);
    }

    /**
     * Mark message as read
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function markAsRead(Request $request, $messageId)
    {
        // In a real implementation, you would update the message read status
        // in the database

        return response()->json([
            'success' => true,
            'message' => 'Message marked as read',
            'data' => [
                'messageId' => $messageId,
                'readAt' => now()->toISOString()
            ]
        ]);
    }
} 