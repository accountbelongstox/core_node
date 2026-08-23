<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Social;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SocialEventModel;
use App\Http\Controllers\Controller;
use App\Services\Relay\RelayHubAuthService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AppQyV1SocialRealtimeController extends Controller
{
    use ApiResponse;

    private const BATCH_LIMIT = 200;

    public function connection(Request $request): JsonResponse
    {
        $userId = (int) $request->user()->id;
        $token = RelayHubAuthService::issueForTopics(
            'social:'.$userId,
            [AppQyV1SocialEventModel::topic($userId)]
        );
        $token['events'] = AppQyV1SocialEventModel::eventNames();
        $token['cursor'] = AppQyV1SocialEventModel::maxId($userId);

        return RelayHubAuthService::withHubCookie(
            $this->success($token, __('relay.social_realtime_connection')),
            $token
        );
    }

    public function events(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'cursor' => 'nullable|integer|min:0',
            'limit' => 'nullable|integer|min:1|max:'.self::BATCH_LIMIT,
        ]);
        $userId = (int) $request->user()->id;
        $cursor = (int) ($validated['cursor'] ?? 0);
        $limit = (int) ($validated['limit'] ?? self::BATCH_LIMIT);
        $current = $cursor > 0 ? $cursor : AppQyV1SocialEventModel::maxId($userId);
        $rows = $cursor > 0
            ? AppQyV1SocialEventModel::since($userId, $cursor, $limit)
            : [];
        $events = [];

        foreach ($rows as $row) {
            $current = max($current, (int) $row['id']);
            $payload = $row['data'];
            $payload['_id'] = (int) $row['id'];
            $events[] = [
                'id' => (int) $row['id'],
                'event' => (string) $row['event'],
                'data' => $payload,
            ];
        }

        return $this->success([
            'cursor' => $current,
            'events' => $events,
            'has_more' => count($rows) >= $limit,
        ], __('relay.social_realtime_events'));
    }
}
