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

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools;

use App\Http\Controllers\Controller;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TranslationEventModel;
use App\Support\ServerRuntime;
use App\Utils\SseStreamResponse;
use Illuminate\Http\Request;
use Illuminate\Http\StreamedEvent;

/**
 * Translation real-time SSE stream (replaces Reverb).
 *
 * GET /api/app_qy_v1/ai_tools/translation/queue/stream?cursor=<lastId>
 *
 * Streams translation-queue events over the SAME Octane :9000 HTTP port using
 * Laravel 12's response()->eventStream + StreamedEvent — no separate Reverb /
 * WebSocket process. Events mirror the original broadcast contract exactly:
 *   task.*, word.translated, sentence.priority, word_audio.priority,
 *   word_image.priority, cover.priority
 * plus stream.open / ping / stream.close envelope events. Every payload carries
 * `_id` (the outbox row id) so the consumer (pycore) advances its cursor and
 * reconnects from exactly where it left off (no missed/duplicated events).
 *
 * Public/no-auth (mounted in the pycore-reachable control-plane group), same
 * trust level as the queue/list control endpoint.
 */
class AppQyV1TranslationStreamController extends Controller
{
    // Bounded connection lifetime CAP: end the stream so the Octane worker is freed;
    // the client reconnects with its cursor and resumes with zero gap. The EFFECTIVE
    // lifetime is clamped below Octane's per-request watchdog at runtime (see stream()),
    // otherwise the worker kills the stream mid-flight and the client sees a timeout.
    private const MAX_LIFETIME_SECONDS = 50;
    // On the single-worker php -S runtime the SSE generator occupies the ONE
    // worker for its whole lifetime, starving all other requests. Cap the
    // lifetime hard there so the worker is released every few seconds; the
    // client reconnects by cursor, turning the stream into a near-short-poll
    // that lets other requests interleave. No effect on Octane.
    private const SINGLE_WORKER_LIFETIME_SECONDS = 3;
    // Poll cadence for new outbox rows when idle.
    private const POLL_INTERVAL_MS = 800;
    // Max rows drained per query.
    private const BATCH_LIMIT = 200;
    // Idle keep-alive so proxies/clients don't drop the connection.
    private const HEARTBEAT_SECONDS = 15;
    // Outbox retention; pruned from the loop.
    private const PRUNE_AGE_SECONDS = 600;
    private const PRUNE_EVERY_SECONDS = 60;

    public function stream(Request $request)
    {
        $validated = $request->validate([
            'cursor' => 'nullable|integer|min:0',
        ]);

        // cursor absent / 0 -> start from the current tail (only NEW events),
        // so a fresh subscriber never replays the whole backlog.
        $cursor = 0;
        if (isset($validated['cursor'])) {
            $cursor = (int) $validated['cursor'];
        }
        if ($cursor <= 0) {
            $cursor = AppQyV1TranslationEventModel::maxId();
        }

        // The effective lifetime MUST stay UNDER Octane's per-request watchdog
        // (config octane.max_execution_time, default 30s) — otherwise the worker
        // KILLS the stream mid-flight and the consumer (pycore) sees a read timeout
        // / "unreachable". Subtract a safety margin; 0/disabled config = unlimited.
        $maxExec = (int) config('octane.max_execution_time', 30);
        $maxLifetime = $maxExec > 0
            ? max(5, min(self::MAX_LIFETIME_SECONDS, $maxExec - 5))
            : self::MAX_LIFETIME_SECONDS;

        // Single-worker php -S: hard-cap the hold so the sole worker is freed
        // frequently and other requests are not starved (client reconnects by
        // cursor). Overrides the Octane-oriented budget above on this runtime.
        if (ServerRuntime::isSingleWorker()) {
            $maxLifetime = self::SINGLE_WORKER_LIFETIME_SECONDS;
        }

        return SseStreamResponse::make(function () use ($cursor, $maxLifetime) {
            $current = $cursor;
            $start = microtime(true);
            $lastBeat = $start;
            $lastPrune = $start;

            // Confirm the resume point to the consumer.
            yield new StreamedEvent(event: 'stream.open', data: json_encode(['cursor' => $current]));

            while ((microtime(true) - $start) < $maxLifetime) {
                $events = AppQyV1TranslationEventModel::since($current, self::BATCH_LIMIT);

                if (!empty($events)) {
                    foreach ($events as $evt) {
                        $payload = $evt['data'];
                        // Carry the cursor inside the payload (pycore reads `_id`).
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
                    AppQyV1TranslationEventModel::pruneOlderThan(self::PRUNE_AGE_SECONDS);
                    $lastPrune = microtime(true);
                }

                usleep(self::POLL_INTERVAL_MS * 1000);
            }

            // Final envelope carries the cursor so the client resumes exactly.
            yield new StreamedEvent(event: 'stream.close', data: json_encode(['cursor' => $current]));
        });
    }
}
