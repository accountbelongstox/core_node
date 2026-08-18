<?php

namespace App\Services\TimerTasks;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserPresenceModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SocialEventModel;

/**
 * Presence offline push (real-time symmetry for friend.online).
 *
 * Presence is heartbeat-written: friend.online is emitted synchronously on the
 * offline->online transition inside PresenceController@heartbeat, but OFFLINE is
 * the ABSENCE of a heartbeat and therefore has no synchronous hook — it can only
 * be observed by a periodic sweep once last_seen_at lapses past STALE_SECONDS.
 * This is that detector (the idiomatic TimerTask driver, LARAVEL_GUIDE §5): each
 * run marks users who just crossed the offline threshold and pushes friend.offline
 * into every friend's/follower's social outbox — the exact same mechanism and
 * audience the online push uses (AppQyV1UserPresenceModel::audienceFor).
 *
 * Exactly-once per transition is enforced in the model's atomic claim
 * (sweepNewlyOffline flips status live->offline only once), so this task simply
 * fans the returned transitions out to the outbox. Idempotent: with nobody newly
 * offline it does a single indexed read and returns, costing almost nothing.
 */
class AppQyV1PresenceSweepTask extends OctaneTimerTaskAbstract
{
    // Run cadence (seconds). Offline is inherently floored at STALE_SECONDS (60s)
    // since it is absence-based; a 15s sweep keeps the extra detection latency
    // small (<= 15s past the stale mark) while staying cheap on a healthy system.
    public function getInterval(): int
    {
        return 15;
    }

    public function exec(): void
    {
        $transitions = [];
        $userId = 0;
        $lastSeen = null;
        $audience = [];
        $emitted = 0;

        $transitions = AppQyV1UserPresenceModel::sweepNewlyOffline();
        if (empty($transitions)) {
            return;
        }

        foreach ($transitions as $transition) {
            $userId = (int) $transition['user_id'];
            $lastSeen = $transition['last_seen_at'] ?? null;
            $audience = AppQyV1UserPresenceModel::audienceFor($userId);
            foreach ($audience as $recipientId) {
                AppQyV1SocialEventModel::emit($recipientId, 'friend.offline', [
                    'user_id' => $userId,
                    'status' => AppQyV1UserPresenceModel::STATUS_OFFLINE,
                    'last_seen_at' => $lastSeen,
                ]);
                $emitted++;
            }
        }

        if ($emitted > 0) {
            $this->logInfo('Pushed friend.offline transitions', [
                'users' => count($transitions),
                'events' => $emitted,
            ]);
        }
    }
}
