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

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserPresenceModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SocialEventModel;

/**
 * Presence heartbeat + batch read (SOCIAL_FEATURE_SPECIFICATION.md §3/§4).
 *
 * Heartbeat upserts app_qy_v1_user_presence(last_seen_at=now, status). On an
 * offline->online transition it emits friend.online to the user's friends.
 * Read collapses a heartbeat older than 60s to offline.
 */
class AppQyV1PresenceController extends Controller
{
    use ApiResponse;

    private const ALLOWED_STATUSES = ['online', 'away', 'studying', 'offline'];

    /**
     * POST /social/presence/heartbeat {status?}
     */
    public function heartbeat(Request $request)
    {
        $currentUser = $request->user();
        $validator = null;
        $status = null;
        $result = [];
        $friendIds = [];

        if (!$currentUser) {
            return $this->unauthorized();
        }

        $validator = Validator::make($request->all(), [
            'status' => ['nullable', 'string', 'in:' . implode(',', self::ALLOWED_STATUSES)],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $status = $request->input('status');
        $result = AppQyV1UserPresenceModel::heartbeat((int) $currentUser->id, $status);

        // Offline -> online transition: notify friends (best-effort SSE). The
        // symmetric offline push is driven by AppQyV1PresenceSweepTask, which
        // detects the lapsed heartbeat and emits friend.offline to this same
        // audience (AppQyV1UserPresenceModel::audienceFor).
        if (!$result['previously_online'] && $result['status'] !== AppQyV1UserPresenceModel::STATUS_OFFLINE) {
            $friendIds = AppQyV1UserPresenceModel::audienceFor((int) $currentUser->id);
            foreach ($friendIds as $fid) {
                AppQyV1SocialEventModel::emit($fid, 'friend.online', [
                    'user_id' => (int) $currentUser->id,
                    'status' => $result['status'],
                ]);
            }
        }

        return $this->success([
            'status' => $result['status'],
            'transitioned_online' => !$result['previously_online'] && $result['status'] !== AppQyV1UserPresenceModel::STATUS_OFFLINE,
        ], 'Heartbeat recorded');
    }

    /**
     * GET /social/presence?user_ids=a,b,c  -> { [user_id]: {status, last_seen_at} }
     */
    public function batch(Request $request)
    {
        $currentUser = $request->user();
        $raw = '';
        $ids = [];
        $presence = [];

        if (!$currentUser) {
            return $this->unauthorized();
        }

        $raw = (string) $request->query('user_ids', '');
        if ($raw !== '') {
            foreach (explode(',', $raw) as $part) {
                $part = trim($part);
                if ($part !== '' && ctype_digit($part)) {
                    $ids[(int) $part] = (int) $part;
                }
            }
        }
        $ids = array_values($ids);

        $presence = AppQyV1UserPresenceModel::effectiveFor($ids);

        return $this->success(['presence' => $presence]);
    }
}
