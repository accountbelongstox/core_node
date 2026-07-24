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

    public function __construct()
    {
        $this->coversDir = PathMapper::getStaticPath() . '/app_qy_v1/covers';
        PathMapper::ensureDirectoryExists($this->coversDir);

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
            $library->cover_prompt = $this->buildPrompt($library);
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
        // existing filename/prompt, reset attempts and clear the lease +
        // error so the maintenance pass / assist claim picks it up again.
        if ($library->cover_status === 'failed') {
            $library->cover_status = 'pending';
            $library->cover_attempts = 0;
            $library->cover_error_message = null;
            $library->assist_claimed_at = null;
            $library->assist_claimed_by = null;
        }

        $library->cover_last_requested_at = now();
        $library->save();

        $url = $this->buildCoverUrl($library->cover_filename);
        $logEntry = $this->buildLog($library);

        if ($this->hasCoverFile($library->cover_filename)) {
            if ($library->cover_status !== 'ready') {
                $library->cover_status = 'ready';
                $library->cover_last_generated_at = $library->cover_last_generated_at ?? now();
                $library->save();
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
            $library->save();
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
     * Cover prompt for a library. Delegates to AppQyV1CoverPromptBuilder, which
     * produces a TEXT-FREE prompt (image models render letters poorly) with
     * RANDOMIZED visual variables (style/palette/background/lighting/motif) so
     * each call — and therefore each regeneration — yields a different image.
     *
     * Public because it is shared by the local generation pipeline AND the
     * assist claim endpoint (pycore receives this exact prompt).
     */
    public function buildPrompt(AppQyV1VocabularyLibraryModel $library): string
    {
        return AppQyV1CoverPromptBuilder::build($library);
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
}
