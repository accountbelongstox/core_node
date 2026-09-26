<?php

namespace App\Apps\AppQyV1\Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1ResourceIndexService;
use App\Providers\PathMapper;
use App\Services\AiGateway\AiGateway;
use DateTimeInterface;
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
    public const COVER_STATUSES = ['pending', 'processing', 'retry', 'ready', 'failed'];

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
            if (!in_array($library->cover_status, self::COVER_STATUSES, true)) {
                $library->cover_status = $this->hasCoverFile($expectedFilename) ? 'ready' : 'pending';
                if ($library->cover_status === 'ready') {
                    $library->cover_last_generated_at = $library->cover_last_generated_at ?? now();
                }
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

        // Reads never move an initialized cover between statuses: failed rows
        // stay failed (AppQyV1CoverGenerationTask owns the retry policy) and a
        // queued regeneration stays pending while the previous file is served.
        $library->cover_last_requested_at = now();
        $library->saveRecord();

        return $this->presentCover($library);
    }

    /**
     * Side-effect-free cover view. image_url is set only while a cover file
     * exists on disk; a ready row whose file vanished reports pending until
     * the reconcile pass re-queues it.
     */
    public function presentCover(AppQyV1VocabularyLibraryModel $library): array
    {
        $hasFile = $this->hasCoverFile($this->coverFilename($library));
        $status = in_array($library->cover_status, self::COVER_STATUSES, true)
            ? (string) $library->cover_status
            : 'pending';
        if ($status === 'ready' && !$hasFile) {
            $status = 'pending';
        }
        $url = $this->versionedCoverUrl($library);
        $errorMessage = $status === 'ready' ? null : $library->cover_error_message;

        return [
            'url' => $url,
            'image_url' => $hasFile ? $url : null,
            'has_file' => $hasFile,
            'status' => $status,
            'error' => $errorMessage,
            'error_message' => $errorMessage,
            'attempts' => (int) ($library->cover_attempts ?? 0),
            'log' => $this->buildLog($library),
        ];
    }

    /** Cover URL cache-busted with ?v=<cover_last_generated_at timestamp>. */
    public function versionedCoverUrl(AppQyV1VocabularyLibraryModel $library): string
    {
        $url = $this->buildCoverUrl($this->coverFilename($library));
        $generatedAt = $library->cover_last_generated_at;
        if ($generatedAt instanceof DateTimeInterface) {
            return $url . '?v=' . $generatedAt->getTimestamp();
        }

        return $url;
    }

    private function coverFilename(AppQyV1VocabularyLibraryModel $library): string
    {
        $filename = (string) ($library->cover_filename ?? '');

        return $filename !== '' ? $filename : $this->buildFilename($library);
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
            if (File::exists($path) && File::delete($path)) {
                app(AppQyV1ResourceIndexService::class)->forgetStaticPath($path);
                return true;
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
     * (no provider call at all) unless $fresh is set; freshly generated images
     * are always written INTO the cache and then to the cover path, so covers
     * are never one-shot throwaway output.
     *
     * Returns { success, url, provider, model, latency_ms, cached, error }.
     */
    public function regenerateWithAi(
        AppQyV1VocabularyLibraryModel $library,
        ?string $promptOverride = null,
        bool $fresh = false
    ): array {
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
        $cached = !$fresh && File::exists($cachePath) && File::size($cachePath) > 0;

        if ($cached) {
            File::copy($cachePath, $coverPath);
            $provider = 'cache';
            $model = 'prompt-cache';
            $latencyMs = null;
        } else {
            $result = AiGateway::generateImage($prompt, $size, null, 'vocabulary_cover');
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
            'url' => $this->versionedCoverUrl($library),
            'provider' => $provider,
            'model' => $model,
            'latency_ms' => $latencyMs,
            'cached' => $cached,
            'error' => null,
        ];
    }
}
