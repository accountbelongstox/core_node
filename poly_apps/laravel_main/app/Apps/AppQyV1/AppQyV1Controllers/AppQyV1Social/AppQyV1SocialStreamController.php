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

use App\Http\Controllers\Controller;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SocialEventModel;
use Illuminate\Http\Request;
use Illuminate\Http\StreamedEvent;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Social real-time SSE stream (per-user; replaces Reverb).
 *
 * GET /api/app_qy_v1/social/stream?cursor=<lastId>   (custom.authenticate)
 *
 * Cloned from AppQyV1TranslationStreamController but mounted under
 * custom.authenticate and SCOPED to the authenticated user: it drains ONLY
 * the resolved user's rows from app_qy_v1_social_events.
 *
 * AUTH: accepts a session cookie (withCredentials) OR an Authorization header
 * (both resolved by custom.authenticate -> $request->user()) OR a `?token=`
 * query param carrying the Sanctum plaintext token. The query-token path exists
 * because the browser EventSource API cannot set an Authorization header; it is
 * scoped to this endpoint, not the shared middleware. Events mirror the
 * social contract:
 *   message.new | friend.request | friend.accept | friend.online |
 *   friend.offline | notification.new | presence.update
 * plus stream.open / ping / stream.close envelopes. Every payload carries `_id`
 * (the outbox row id) so the client advances its cursor and reconnects with no
 * missed/duplicated events. A fresh subscriber starts at this user's maxId (no
 * backlog replay).
 */
class AppQyV1SocialStreamController extends Controller
{
    // Bounded connection lifetime CAP: free the Octane worker; the client
    // reconnects with its cursor and resumes with zero gap. The EFFECTIVE
    // lifetime is clamped below Octane's per-request watchdog at runtime.
    private const MAX_LIFETIME_SECONDS = 50;
    private const POLL_INTERVAL_MS = 800;
    private const BATCH_LIMIT = 200;
    private const HEARTBEAT_SECONDS = 15;
    private const PRUNE_AGE_SECONDS = 600;
    private const PRUNE_EVERY_SECONDS = 60;

    public function stream(Request $request)
    {
        // The stream authenticates via session cookie OR Authorization header
        // (both resolved by custom.authenticate -> $request->user()) OR a
        // `?token=` query param. The query-token path exists ONLY because the
        // browser EventSource API cannot set an Authorization header, so the FE
        // passes the Sanctum token in the query string (with withCredentials for
        // the cookie path). This fallback is intentionally scoped to THIS SSE
        // endpoint, not added to the shared custom.authenticate middleware.
        $user = $request->user();
        if (!$user) {
            $user = $this->resolveUserFromQueryToken($request);
        }
        if (!$user) {
            return response()->json(['success' => false, 'error' => 'Unauthorized'], 401);
        }
        $userId = (int) $user->id;

        $validated = $request->validate([
            'cursor' => 'nullable|integer|min:0',
        ]);

        // cursor absent / 0 -> start from THIS user's current tail (only NEW
        // events), so a fresh subscriber never replays the whole backlog.
        $cursor = 0;
        if (isset($validated['cursor'])) {
            $cursor = (int) $validated['cursor'];
        }
        if ($cursor <= 0) {
            $cursor = AppQyV1SocialEventModel::maxId($userId);
        }

        // The effective lifetime MUST stay UNDER Octane's per-request watchdog
        // (config octane.max_execution_time, default 30s) — otherwise the worker
        // KILLS the stream mid-flight and the client sees a read timeout.
        // Subtract a safety margin; 0/disabled config = unlimited.
        $maxExec = (int) config('octane.max_execution_time', 30);
        $maxLifetime = $maxExec > 0
            ? max(5, min(self::MAX_LIFETIME_SECONDS, $maxExec - 5))
            : self::MAX_LIFETIME_SECONDS;

        $response = response()->eventStream(function () use ($userId, $cursor, $maxLifetime) {
            $current = $cursor;
            $start = microtime(true);
            $lastBeat = $start;
            $lastPrune = $start;

            // Confirm the resume point to the client.
            yield new StreamedEvent(event: 'stream.open', data: json_encode(['cursor' => $current]));

            while ((microtime(true) - $start) < $maxLifetime) {
                $events = AppQyV1SocialEventModel::since($userId, $current, self::BATCH_LIMIT);

                if (!empty($events)) {
                    foreach ($events as $evt) {
                        $payload = $evt['data'];
                        // Carry the cursor inside the payload (client reads `_id`).
                        $payload['_id'] = $evt['id'];
                        yield new StreamedEvent(
                            event: $evt['event'],
                            data: json_encode($payload, JSON_UNESCAPED_UNICODE)
                        );
                        $current = $evt['id'];
                    }
                    $lastBeat = microtime(true);

                    // A full batch likely means more is waiting — catch up now.
                    if (count($events) >= self::BATCH_LIMIT) {
                        continue;
                    }
                } elseif ((microtime(true) - $lastBeat) >= self::HEARTBEAT_SECONDS) {
                    yield new StreamedEvent(event: 'ping', data: json_encode(['cursor' => $current]));
                    $lastBeat = microtime(true);
                }

                if ((microtime(true) - $lastPrune) >= self::PRUNE_EVERY_SECONDS) {
                    AppQyV1SocialEventModel::pruneOlderThan(self::PRUNE_AGE_SECONDS);
                    $lastPrune = microtime(true);
                }

                usleep(self::POLL_INTERVAL_MS * 1000);
            }

            // Final envelope carries the cursor so the client resumes exactly.
            yield new StreamedEvent(event: 'stream.close', data: json_encode(['cursor' => $current]));
        });

        // SSE hygiene: disable nginx/proxy buffering so events flush immediately.
        $response->headers->set('X-Accel-Buffering', 'no');
        $response->headers->set('Cache-Control', 'no-cache, no-transform');
        $response->headers->set('Connection', 'keep-alive');

        return $response;
    }

    /**
     * Resolve the authenticated user from a `?token=` query param (EventSource
     * cannot set an Authorization header). The plaintext Sanctum token is looked
     * up via PersonalAccessToken::findToken; an expired token is rejected. Returns
     * the tokenable user, or null when the token is absent/invalid/expired. The
     * token value is NEVER logged.
     *
     * @return \App\Models\User|null
     */
    private function resolveUserFromQueryToken(Request $request)
    {
        $token = (string) $request->query('token', '');
        if ($token === '') {
            return null;
        }

        $accessToken = PersonalAccessToken::findToken($token);
        if (!$accessToken) {
            return null;
        }

        // Honor per-token expiry (config sanctum.expiration may also apply, but a
        // row-level expires_at always wins when present).
        if ($accessToken->expires_at !== null && $accessToken->expires_at->isPast()) {
            return null;
        }

        $tokenable = $accessToken->tokenable;
        if (!$tokenable instanceof \App\Models\User) {
            return null;
        }

        return $tokenable;
    }
}
