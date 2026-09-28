<?php

namespace App\Services\AiGateway;

/**
 * AiTextLog — one human-readable TEXT log of EVERY AI / capability call, the PHP
 * twin of pycore's pyctl.ai.ai_text_log. Both runtimes append to the SAME file
 * so an operator can `tail -f` what every AI call did (text/vision/probe AND
 * generated images) regardless of which runtime produced it.
 *
 * The JSON ring buffers (ai_usage_records.json, ai_image_history.json) stay the
 * structured record; this is the flat, append-only operator log beside them.
 *
 * Written from the two central record points the whole gateway funnels through:
 *   - AiUsageLog::record   (text / vision / probe)
 *   - AiImageHistory::record (generated images)
 * so it captures all Laravel AI calls without touching each call site.
 *
 * Path:  <cache>/pycore/.ai_state/ai_calls.log   (same dir as the JSON state,
 * resolved via AiUsageLog::stateDir() so pycore + Laravel land on ONE file).
 *
 * Best-effort + size-capped: it never throws into the AI call path, and self-
 * trims (keeps the most recent ~half) once it grows past the cap.
 */
final class AiTextLog
{
    private const LOG_NAME = 'ai_calls.log';

    /** 5 MB, then keep the most recent ~half (matches pycore ai_text_log). */
    private const MAX_BYTES = 5242880;

    /** Absolute path of the shared TEXT log (same dir the JSON state uses). */
    public static function path(): string
    {
        return AiUsageLog::stateDir() . '/' . self::LOG_NAME;
    }

    /**
     * Format + append one AI-call line. $success: true=ok, false=FAIL, null=unknown.
     * Line shape matches pycore log_ai_call so the shared file stays consistent:
     *   <iso>  <runtime>  <kind>   <provider>/<model>  src=<source>  <ok|FAIL>  [<ms>ms]  [err=..]  [extra]
     */
    public static function log(
        string $runtime,
        string $kind,
        string $provider,
        string $model = '',
        string $source = '',
        ?bool $success = null,
        ?float $latencyMs = null,
        ?string $error = null,
        string $extra = ''
    ): void {
        try {
            $iso = gmdate('Y-m-d\TH:i:s+00:00');
            $status = $success === true ? 'ok' : ($success === false ? 'FAIL' : '-');
            $parts = [
                $iso,
                $runtime !== '' ? $runtime : '?',
                str_pad($kind !== '' ? $kind : '?', 6),
                ($provider !== '' ? $provider : '?') . '/' . ($model !== '' ? $model : '-'),
            ];
            if ($source !== '') {
                $parts[] = 'src=' . $source;
            }
            $parts[] = $status;
            if ($latencyMs !== null) {
                $parts[] = ((int) $latencyMs) . 'ms';
            }
            if ($error !== null && $error !== '') {
                $parts[] = 'err=' . substr($error, 0, 200);
            }
            if ($extra !== '') {
                $parts[] = $extra;
            }
            $line = implode('  ', $parts) . "\n";

            // Per-call CLI visibility: also print the line to the process console
            // (Octane/queue worker stderr), mirroring pycore's ColorPrint so an
            // operator sees every AI call live, not only in the flat file.
            $console = '[AI] ' . rtrim($line);
            if (defined('STDERR')) {
                @fwrite(STDERR, $console . "\n");
            } else {
                @error_log($console);
            }

            $path = self::path();
            $dir = dirname($path);
            if (!is_dir($dir)) {
                @mkdir($dir, 0775, true);
            }
            if (is_file($path) && (int) @filesize($path) > self::MAX_BYTES) {
                $data = @file_get_contents($path);
                if ($data !== false && $data !== '') {
                    @file_put_contents($path, substr($data, intdiv(strlen($data), 2)), LOCK_EX);
                }
            }
            @file_put_contents($path, $line, FILE_APPEND | LOCK_EX);
        } catch (\Throwable $e) {
            // Logging must never break the actual AI call.
        }
    }
}
