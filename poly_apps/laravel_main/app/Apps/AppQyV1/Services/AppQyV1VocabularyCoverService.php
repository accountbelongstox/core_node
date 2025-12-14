<?php

namespace App\Apps\AppQyV1\Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyCoverModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Providers\PathMapper;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

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
        $record = AppQyV1VocabularyCoverModel::query()->firstOrCreate(
            ['library_id' => $library->id],
            [
                'cover_filename' => $this->buildFilename($library),
                'prompt' => $this->buildPrompt($library),
                'description' => $this->buildDescription($library),
                'status' => 'pending',
                'priority' => 5,
            ]
        );

        $expectedFilename = $this->buildFilename($library);
        if ($record->cover_filename !== $expectedFilename) {
            $oldPath = $this->getCoverPath($record->cover_filename);
            $newPath = $this->getCoverPath($expectedFilename);

            if (File::exists($oldPath) && !File::exists($newPath)) {
                File::move($oldPath, $newPath);
            }

            $record->cover_filename = $expectedFilename;
            $record->save();
        }

        $record->last_requested_at = now();
        $record->save();

        $url = $this->buildCoverUrl($record->cover_filename);
        $logEntry = $this->getLatestLog($record->id);

        if ($this->hasCoverFile($record->cover_filename)) {
            if ($record->status !== 'ready') {
                $record->status = 'ready';
                $record->last_generated_at = $record->last_generated_at ?? now();
                $record->save();
            }

            return [
                'url' => $url,
                'status' => 'ready',
                'error' => null,
                'log' => $logEntry,
            ];
        }

        if (!in_array($record->status, ['pending', 'processing', 'retry'])) {
            $record->status = 'pending';
            $record->error_message = null;
            $record->save();
        }

        return [
            'url' => $url,
            'status' => $record->status,
            'error' => $record->error_message,
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

    private function buildPrompt(AppQyV1VocabularyLibraryModel $library): string
    {
        $category = Str::of($library->category ?? 'general')->replace('_', ' ')->title();
        $difficulty = Str::of($library->difficulty_level ?? 'intermediate')->title();

        return sprintf(
            "Design a clean, modern 16:9 book cover for a %s vocabulary library named \"%s\". Theme: %s learning. Include abstract educational imagery, warm lighting, subtle typography. Avoid text other than the title. Use professional vector illustration style.",
            strtolower($difficulty),
            $library->name,
            strtolower($category)
        );
    }

    private function buildDescription(AppQyV1VocabularyLibraryModel $library): string
    {
        $category = $library->category ?? 'general';
        $difficulty = $library->difficulty_level ?? 'intermediate';

        return sprintf(
            '%s vocabulary library cover (%s, %s level)',
            $library->name,
            $category,
            $difficulty
        );
    }

    private function buildDefaultPrompt(): string
    {
        return 'Create a minimalistic 16:9 cover art for a vocabulary learning library platform. Use soft gradients, abstract bookshelves, light textures, and inspirational tones. No text.';
    }

    private function getLatestLog(int $coverId): ?array
    {
        $cover = AppQyV1VocabularyCoverModel::query()->find($coverId);

        if (!$cover) {
            return null;
        }

        return [
            'cover_id' => $cover->id,
            'status' => $cover->status,
            'attempts' => $cover->attempts ?? 0,
            'error_message' => $cover->error_message,
            'updated_at' => optional($cover->updated_at)->toDateTimeString(),
            'started_at' => optional($cover->started_at)->toDateTimeString(),
            'finished_at' => optional($cover->finished_at)->toDateTimeString(),
        ];
    }
}
