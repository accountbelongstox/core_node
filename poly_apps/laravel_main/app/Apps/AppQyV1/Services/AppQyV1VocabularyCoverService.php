<?php

namespace App\Apps\AppQyV1\Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Providers\PathMapper;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

/**
 * Library cover state lives on the cover_* columns of vocabulary_libraries
 * (the vocabulary_covers table was absorbed by the Wave A consolidation and
 * dropped by AppQyV1_2026_06_12_150002). The status flow is unchanged:
 * pending -> processing -> ready / retry / failed.
 */
class AppQyV1VocabularyCoverService
{
    private string $coversDir;
    private string $coversUrlPrefix;
    private string $defaultFilename;
    private string $aiCacheDir;

    public function __construct()
    {
        $this->coversDir = PathMapper::getStaticPath() . '/app_qy_v1/covers';
        PathMapper::ensureDirectoryExists($this->coversDir);

        // AI-generated images are cached by prompt hash so a repeated prompt
        // never burns another provider call; the cache lives in the SAME
        // global-constant static root as the covers (never the web root).
        $this->aiCacheDir = PathMapper::getStaticPath() . '/app_qy_v1/ai_image_cache';
        PathMapper::ensureDirectoryExists($this->aiCacheDir);

        $this->coversUrlPrefix = url('/static/app_qy_v1/covers');
        $this->defaultFilename = $this->buildFilenameFromParts(0, 'appqyv1-default-cover');
    }

    public function getCoverData(AppQyV1VocabularyLibraryModel $library): array
    {
        $expectedFilename = $this->buildFilename($library);

        // First request for this library: initialize the cover_* columns
        // (previously a vocabulary_covers row was firstOrCreate'd here).
        if ($library->cover_filename === null || $library->cover_filename === '') {
            $library->cover_filename = $expectedFilename;
            if (!in_array($library->cover_status, ['pending', 'processing', 'retry', 'ready', 'failed'], true)) {
                $library->cover_status = 'pending';
            }
            if (!$library->cover_priority) {
                $library->cover_priority = 5;
            }
        }

        if ($library->cover_filename !== $expectedFilename) {
            $oldPath = $this->getCoverPath($library->cover_filename);
            $newPath = $this->getCoverPath($expectedFilename);

            if (File::exists($oldPath) && !File::exists($newPath)) {
                File::move($oldPath, $newPath);
            }

            $library->cover_filename = $expectedFilename;
        }

        // Re-requesting a failed cover re-queues it for mcp-chrome: keep the
        // existing filename, reset attempts and clear the lease +
        // error so the maintenance pass / assist claim picks it up again.
        if ($library->cover_status === 'failed') {
            $library->cover_status = 'pending';
            $library->cover_attempts = 0;
            $library->cover_error_message = null;
            $library->assist_claimed_at = null;
            $library->assist_claimed_by = null;
        }

        $library->cover_last_requested_at = now();
        $library->saveRecord();

        $url = $this->buildCoverUrl($library->cover_filename);
        $logEntry = $this->buildLog($library);

        if ($this->hasCoverFile($library->cover_filename)) {
            if ($library->cover_status !== 'ready') {
                $library->cover_status = 'ready';
                $library->cover_last_generated_at = $library->cover_last_generated_at ?? now();
                $library->saveRecord();
            }

            return [
                'url' => $url,
                'status' => 'ready',
                'error' => null,
                'error_message' => null,
                'attempts' => (int) ($library->cover_attempts ?? 0),
                'log' => $logEntry,
            ];
        }

        if (!in_array($library->cover_status, ['pending', 'processing', 'retry'])) {
            $library->cover_status = 'pending';
            $library->cover_error_message = null;
            $library->saveRecord();
        }

        return [
            'url' => $url,
            'status' => $library->cover_status,
            'error' => $library->cover_error_message,
            'error_message' => $library->cover_error_message,
            'attempts' => (int) ($library->cover_attempts ?? 0),
            'log' => $logEntry,
        ];
    }

    public function getDefaultCoverUrl(): string
    {
        return $this->buildCoverUrl($this->defaultFilename);
    }

    public function getCoverPath(string $filename): string
    {
        return $this->coversDir . '/' . ltrim($filename, '/');
    }

    public function hasCoverFile(string $filename): bool
    {
        return File::exists($this->getCoverPath($filename));
    }

    public function buildCoverUrl(string $filename): string
    {
        return rtrim($this->coversUrlPrefix, '/') . '/' . ltrim($filename, '/');
    }

    public function buildFilename(AppQyV1VocabularyLibraryModel $library): string
    {
        $name = $library->name ?? 'library';
        return $this->buildFilenameFromParts((int) $library->id, $name);
    }

    private function buildFilenameFromParts(int $libraryId, string $name): string
    {
        $slug = Str::of($name)->lower()->squish()->toString();
        $hash = md5($libraryId . '|' . $slug);
        return "{$hash}.png";
    }

    /**
     * Delete the on-disk cover file for a library (if any). Returns true when a
     * file was actually removed. Never throws — a missing file is a no-op.
     */
    public function deleteCoverFile(?string $filename): bool
    {
        if ($filename === null || $filename === '') {
            return false;
        }
        $path = $this->getCoverPath($filename);
        try {
            if (File::exists($path)) {
                return File::delete($path);
            }
        } catch (\Throwable $e) {
            // best-effort cleanup; a locked/permission-denied file is not fatal.
        }
        return false;
    }

    /**
     * Same log shape the covers-table implementation produced; cover_id now
     * carries the library id (covers had a 1:1 unique(library_id) row).
     */
    private function buildLog(AppQyV1VocabularyLibraryModel $library): array
    {
        return [
            'cover_id' => $library->id,
            'status' => $library->cover_status,
            'attempts' => $library->cover_attempts ?? 0,
            'error_message' => $library->cover_error_message,
            'updated_at' => optional($library->updated_at)->toDateTimeString(),
            'started_at' => optional($library->cover_started_at)->toDateTimeString(),
            'finished_at' => optional($library->cover_finished_at)->toDateTimeString(),
        ];
    }

    // ------------------------------------------------------------------ //
    // Laravel-side AI cover generation (AiGateway text-to-image)           //
    // ------------------------------------------------------------------ //

    /**
     * The cover prompt for a library: the stored cover_prompt wins (mcp-chrome
     * randomizes it on clear); otherwise a deterministic prompt is built from
     * the library identity.
     */
    public function buildAiPrompt(AppQyV1VocabularyLibraryModel $library): string
    {
        $stored = trim((string) ($library->cover_prompt ?? ''));
        if ($stored !== '') {
            return $stored;
        }
        $name = trim((string) ($library->name ?? 'vocabulary'));
        $language = trim((string) ($library->language ?? 'en'));
        return "Minimalist flat illustration for a {$language} vocabulary learning library named \"{$name}\", "
            . 'educational book cover style, soft gradient background, clean geometric shapes, no text, no letters';
    }

    /** Cache file for one exact prompt+size combination (prompt-hash keyed). */
    private function aiCachePath(string $prompt, string $size): string
    {
        return $this->aiCacheDir . '/' . hash('sha256', $prompt . '|' . $size) . '.png';
    }

    /**
     * Regenerate the library cover through Laravel's AI image gateway
     * (free-quota providers first, multi-key failover, cooldown-aware).
     *
     * Caching: an identical prompt+size is served from the on-disk ai_image_cache
     * (no provider call at all); freshly generated images are written INTO the
     * cache first and then copied to the cover path, so covers are never
     * one-shot throwaway output.
     *
     * Returns { success, url, provider, model, cached, error }.
     */
    public function regenerateWithAi(AppQyV1VocabularyLibraryModel $library, ?string $promptOverride = null): array
    {
        set_time_limit(300);
        $size = 'square';
        $prompt = trim((string) ($promptOverride ?? '')) !== ''
            ? trim((string) $promptOverride)
            : $this->buildAiPrompt($library);

        if ($library->cover_filename === null || $library->cover_filename === '') {
            $library->cover_filename = $this->buildFilename($library);
        }
        $coverPath = $this->getCoverPath($library->cover_filename);

        $library->cover_status = 'processing';
        $library->cover_started_at = now();
        $library->cover_prompt = $prompt;
        $library->cover_attempts = (int) ($library->cover_attempts ?? 0) + 1;
        $library->saveRecord();

        $cachePath = $this->aiCachePath($prompt, $size);
        $cached = File::exists($cachePath) && File::size($cachePath) > 0;

        if ($cached) {
            File::copy($cachePath, $coverPath);
            $provider = 'cache';
            $model = 'prompt-cache';
            $latencyMs = null;
        } else {
            $result = \App\Services\AiGateway\AiGateway::generateImage($prompt, $size, null, 'vocabulary_cover');
            if (empty($result['success']) || empty($result['image_base64'])) {
                $library->cover_status = 'failed';
                $library->cover_error_message = mb_substr((string) ($result['error'] ?? 'image generation failed'), 0, 2000);
                $library->cover_finished_at = now();
                $library->saveRecord();
                return [
                    'success' => false,
                    'error' => $library->cover_error_message,
                    'provider' => $result['provider'] ?? '',
                    'cached' => false,
                ];
            }
            $bytes = base64_decode((string) $result['image_base64'], true);
            if ($bytes === false || strlen($bytes) < 100) {
                $library->cover_status = 'failed';
                $library->cover_error_message = 'AI image payload was empty or corrupt';
                $library->cover_finished_at = now();
                $library->saveRecord();
                return ['success' => false, 'error' => $library->cover_error_message, 'provider' => $result['provider'] ?? '', 'cached' => false];
            }
            File::put($cachePath, $bytes);
            File::put($coverPath, $bytes);
            $provider = (string) ($result['provider'] ?? '');
            $model = (string) ($result['model'] ?? '');
            $latencyMs = isset($result['latency_ms']) ? (int) $result['latency_ms'] : null;
        }

        $library->cover_status = 'ready';
        $library->cover_error_message = null;
        $library->cover_provider = $provider;
        $library->cover_model = $model;
        $library->cover_latency_ms = $latencyMs;
        $library->cover_finished_at = now();
        $library->cover_last_generated_at = now();
        $library->saveRecord();

        return [
            'success' => true,
            'url' => $this->buildCoverUrl($library->cover_filename) . '?v=' . $library->cover_last_generated_at->getTimestamp(),
            'provider' => $provider,
            'model' => $model,
            'cached' => $cached,
            'error' => null,
        ];
    }
}
