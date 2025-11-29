<?php

namespace App\Apps\AppQyV1\Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyCoverModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Providers\PathMapper;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class AppQyV1VocabularyCoverService
{
    private string $coversDir;
    private string $coversUrlPrefix;
    private string $defaultFilename = 'default_cover.png';

    public function __construct()
    {
        $this->coversDir = PathMapper::getStaticPath() . '/app_qy_v1/covers';
        PathMapper::ensureDirectoryExists($this->coversDir);

        $this->coversUrlPrefix = url('/static/app_qy_v1/covers');

        $placeholderPath = $this->coversDir . '/placeholder.png';
        if (!File::exists($placeholderPath)) {
            $this->createPlaceholderImage($placeholderPath);
        }
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

        if ($this->hasCoverFile($record->cover_filename)) {
            if ($record->status !== 'ready') {
                $record->status = 'ready';
                $record->last_generated_at = $record->last_generated_at ?? now();
                $record->save();
            }

            return [
                'url' => $this->buildCoverUrl($record->cover_filename),
                'status' => 'ready',
            ];
        }

        $this->queueGeneration($record);

        return [
            'url' => $this->getDefaultCoverUrl(),
            'status' => $record->status,
        ];
    }

    public function getDefaultCoverUrl(): string
    {
        $defaultPath = $this->getCoverPath($this->defaultFilename);

        if (!File::exists($defaultPath)) {
            $record = AppQyV1VocabularyCoverModel::query()->firstOrCreate(
                ['library_id' => 0],
                [
                    'cover_filename' => $this->defaultFilename,
                    'prompt' => $this->buildDefaultPrompt(),
                    'description' => 'Default vocabulary library cover art',
                    'status' => 'pending',
                    'priority' => 10,
                ]
            );

            $this->queueGeneration($record);

            // Use placeholder while waiting for Gemini cover
            $placeholder = $this->coversDir . '/placeholder.png';
            File::copy($placeholder, $defaultPath);
        }

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
        $slug = Str::lower(trim($library->name ?? 'library'));
        $hash = md5($library->id . '|' . $slug);
        return "{$hash}.png";
    }

    private function queueGeneration(AppQyV1VocabularyCoverModel $record): void
    {
        if ($record->status !== 'processing') {
            $record->status = 'pending';
        }
        $record->priority = $record->priority ?? 1;
        $record->error_message = null;
        $record->save();
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

    private function createPlaceholderImage(string $path): void
    {
        if (function_exists('imagecreatetruecolor')) {
            $width = 1280;
            $height = 720;
            $image = imagecreatetruecolor($width, $height);
            $background = imagecolorallocate($image, 15, 23, 42);
            $accent = imagecolorallocate($image, 59, 130, 246);

            imagefill($image, 0, 0, $background);

            for ($i = 0; $i < 5; $i++) {
                $alpha = imagecolorallocatealpha($image, 79, 70, 229, 60 + ($i * 10));
                imagefilledellipse(
                    $image,
                    ($i * 200) + 150,
                    ($i * 100) + 120,
                    320 - ($i * 20),
                    240 - ($i * 10),
                    $alpha
                );
            }

            imagefilledrectangle($image, 200, 260, 420, 560, $accent);
            imagefilledrectangle($image, 450, 220, 660, 560, $accent);
            imagefilledrectangle($image, 700, 300, 900, 560, $accent);

            imagepng($image, $path);
            imagedestroy($image);

            return;
        }

        $base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAucB9pNXvFAAAAAASUVORK5CYII=';
        file_put_contents($path, base64_decode($base64));
    }
}
