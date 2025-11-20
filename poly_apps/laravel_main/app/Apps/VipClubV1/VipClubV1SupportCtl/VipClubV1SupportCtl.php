<?php

namespace App\Apps\VipClubV1\VipClubV1SupportCtl;

use App\Http\Controllers\Controller;
use App\Apps\VipClubV1\VipClubV1Models\VipClubV1SupportMessageModel;
use App\Apps\VipClubV1\VipClubV1Models\VipClubV1SupportConfigModel;
use App\Apps\VipClubV1\VipClubV1Utils\VipClubV1ResponseUtils;
use App\Apps\VipClubV1\VipClubV1TablesMaps\VipClubV1TablesMap;
use App\Apps\VipClubV1\VipClubV1Gvar\VipClubV1Config;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class VipClubV1SupportCtl extends Controller
{
    public function sendMessage(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'message' => 'required|string|max:5000',
            'attachments' => 'sometimes|array|max:5'
        ]);

        if ($validator->fails()) {
            return VipClubV1ResponseUtils::validationError('Validation failed', $validator->errors());
        }

        $user = $request->user();

        $message = new VipClubV1SupportMessageModel();
        $message->{VipClubV1TablesMap::getFieldName('SUPPORT_MESSAGES', 'user_id')} = $user->id;
        $message->{VipClubV1TablesMap::getFieldName('SUPPORT_MESSAGES', 'message')} = $request->message;
        $message->{VipClubV1TablesMap::getFieldName('SUPPORT_MESSAGES', 'attachments')} = $request->attachments ?? [];
        $message->{VipClubV1TablesMap::getFieldName('SUPPORT_MESSAGES', 'is_from_user')} = true;
        $message->{VipClubV1TablesMap::getFieldName('SUPPORT_MESSAGES', 'is_read')} = false;
        $message->save();

        return VipClubV1ResponseUtils::created([
            'message_id' => $message->id,
            'created_at' => $message->created_at?->toIso8601String()
        ], 'Message sent successfully');
    }

    public function getMessages(Request $request): JsonResponse
    {
        $user = $request->user();

        $page = $request->query('page', 1);
        $limit = min($request->query('limit', VipClubV1Config::PAGINATION_DEFAULT_LIMIT), VipClubV1Config::PAGINATION_MAX_LIMIT);

        $query = VipClubV1SupportMessageModel::byUser($user->id);

        $total = $query->count();
        $unreadCount = VipClubV1SupportMessageModel::byUser($user->id)
            ->unread()
            ->fromSupport()
            ->count();

        $messages = $query->orderBy('created_at', 'desc')
            ->skip(($page - 1) * $limit)
            ->take($limit)
            ->get();

        $formattedMessages = $messages->map(function ($message) {
            return $this->formatMessageResponse($message);
        });

        return VipClubV1ResponseUtils::success([
            'messages' => $formattedMessages,
            'total' => $total,
            'unread_count' => $unreadCount,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total_pages' => ceil($total / $limit)
            ]
        ]);
    }

    public function markAsRead(Request $request, $id): JsonResponse
    {
        $user = $request->user();

        $message = VipClubV1SupportMessageModel::find($id);

        if (!$message) {
            return VipClubV1ResponseUtils::notFound('Message not found');
        }

        if ($message->{VipClubV1TablesMap::getFieldName('SUPPORT_MESSAGES', 'user_id')} !== $user->id) {
            return VipClubV1ResponseUtils::forbidden('You do not have permission to access this message');
        }

        $message->markAsRead();

        return VipClubV1ResponseUtils::success(null, 'Message marked as read');
    }

    public function getInfo(Request $request): JsonResponse
    {
        $config = VipClubV1SupportConfigModel::getConfig();

        if (!$config) {
            $config = VipClubV1SupportConfigModel::updateConfig([
                'phone' => '+1-800-VIP-CLUB',
                'email' => 'support@vipclub.com',
                'wechat' => 'VIPClubSupport',
                'whatsapp' => '+1-800-123-4567',
                'hours' => 'Mon-Fri: 9AM-6PM, Sat: 10AM-4PM'
            ]);
        }

        return VipClubV1ResponseUtils::success([
            'phone' => $config->{VipClubV1TablesMap::getFieldName('SUPPORT_CONFIG', 'phone')},
            'email' => $config->{VipClubV1TablesMap::getFieldName('SUPPORT_CONFIG', 'email')},
            'wechat' => $config->{VipClubV1TablesMap::getFieldName('SUPPORT_CONFIG', 'wechat')},
            'whatsapp' => $config->{VipClubV1TablesMap::getFieldName('SUPPORT_CONFIG', 'whatsapp')},
            'hours' => $config->{VipClubV1TablesMap::getFieldName('SUPPORT_CONFIG', 'hours')}
        ]);
    }

    private function formatMessageResponse(VipClubV1SupportMessageModel $message): array
    {
        return [
            'id' => $message->id,
            'userId' => $message->{VipClubV1TablesMap::getFieldName('SUPPORT_MESSAGES', 'user_id')},
            'message' => $message->{VipClubV1TablesMap::getFieldName('SUPPORT_MESSAGES', 'message')},
            'attachments' => $message->{VipClubV1TablesMap::getFieldName('SUPPORT_MESSAGES', 'attachments')},
            'isFromUser' => $message->{VipClubV1TablesMap::getFieldName('SUPPORT_MESSAGES', 'is_from_user')},
            'isRead' => $message->{VipClubV1TablesMap::getFieldName('SUPPORT_MESSAGES', 'is_read')},
            'createdAt' => $message->created_at?->toIso8601String()
        ];
    }
}
