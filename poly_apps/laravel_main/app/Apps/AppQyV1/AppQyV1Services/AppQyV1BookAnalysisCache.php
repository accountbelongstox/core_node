<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Providers\PathMapper;
use App\Utils\FileSystemManager;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AppQyV1BookAnalysisCache
{
    public function mergeLists(array $lists, string $kind, ?string $asciiName): array
    {
        $files = isset($lists['files']) && is_array($lists['files']) ? $lists['files'] : [];
        $sourceKey = in_array($kind, ['words', 'unique_words'], true) ? 'words' : $kind;
        $merged = [];

        foreach ($files as $name => $fileLists) {
            if ($asciiName !== null && $name !== $asciiName) {
                continue;
            }
            if (!isset($fileLists[$sourceKey]) || !is_array($fileLists[$sourceKey])) {
                continue;
            }
            array_push($merged, ...$fileLists[$sourceKey]);
        }

        return match ($kind) {
            'words', 'unique_words' => $this->mergeWordFrequencies($merged),
            'unique_sentences' => $this->deduplicateByKey($merged, 'content_id'),
            'languages' => $this->mergeLanguages($merged),
            default => $merged,
        };
    }

    public function loadFileCaches(string $stagingDirectory): array
    {
        $caches = [];
        $index = 0;

        while (true) {
            $path = rtrim($stagingDirectory, '/\\') . DIRECTORY_SEPARATOR . "file_{$index}.json";
            if (!is_file($path)) {
                break;
            }

            $data = $this->readJson($path);
            if ($data !== null) {
                $caches[] = $data;
            }
            $index++;
        }

        return $caches;
    }

    public function listsPath(string $uploadId): string
    {
        $stagingDirectory = PathMapper::getSharedDownloadCacheDir("pycore/appqyv1/books/{$uploadId}");

        return rtrim($stagingDirectory, '/\\') . DIRECTORY_SEPARATOR . 'lists.json';
    }

    public function writeJson(string $path, mixed $value): void
    {
        $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        $current = is_file($path) ? file_get_contents($path) : false;

        if ($json === false) {
            Log::warning('[AppQyV1Books] Failed to encode JSON cache', ['path' => $path]);
            return;
        }
        if ($current === $json) {
            return;
        }
        if (!FileSystemManager::writeFile($path, $json)) {
            Log::warning('[AppQyV1Books] Failed to write JSON cache', ['path' => $path]);
        }
    }

    public function readJson(string $path): ?array
    {
        $raw = false;
        $data = null;

        if (!is_file($path)) {
            return null;
        }

        $raw = file_get_contents($path);
        if ($raw === false) {
            return null;
        }

        $data = json_decode($raw, true);

        return is_array($data) ? $data : null;
    }

    public function asciiName(string $originalName, int $index, string $extension): string
    {
        $base = pathinfo($originalName, PATHINFO_FILENAME);
        $slug = Str::slug($base);
        $suffix = '';

        if ($slug === '') {
            $slug = 'file';
        }

        $slug = substr($slug, 0, 80);
        if ($extension !== '') {
            $suffix = '.' . preg_replace('/[^a-z0-9]/', '', strtolower($extension));
        }

        return $index . '_' . $slug . $suffix;
    }

    public function sanitizeId(string $id): string
    {
        return preg_replace('/[^A-Za-z0-9_\-]/', '', $id);
    }

    private function mergeWordFrequencies(array $rows): array
    {
        $accumulator = [];

        foreach ($rows as $row) {
            $word = isset($row['word']) ? (string) $row['word'] : '';
            if ($word === '') {
                continue;
            }
            if (!isset($accumulator[$word])) {
                $accumulator[$word] = [
                    'word' => $word,
                    'count' => 0,
                    'language' => $row['language'] ?? '',
                ];
            }
            $accumulator[$word]['count'] += (int) ($row['count'] ?? 0);
        }

        $result = array_values($accumulator);
        usort($result, static function (array $left, array $right): int {
            return $left['count'] !== $right['count']
                ? $right['count'] <=> $left['count']
                : strcmp((string) $left['word'], (string) $right['word']);
        });

        return $result;
    }

    private function mergeLanguages(array $rows): array
    {
        $accumulator = [];
        $total = 0;

        foreach ($rows as $row) {
            $script = isset($row['script']) ? (string) $row['script'] : '';
            if ($script === '') {
                continue;
            }
            if (!isset($accumulator[$script])) {
                $accumulator[$script] = [
                    'script' => $script,
                    'code' => $row['code'] ?? '',
                    'chars' => 0,
                    'ratio' => 0.0,
                ];
            }
            $accumulator[$script]['chars'] += (int) ($row['chars'] ?? 0);
            $total += (int) ($row['chars'] ?? 0);
        }

        foreach ($accumulator as &$row) {
            $row['ratio'] = $total > 0 ? round($row['chars'] / $total, 4) : 0.0;
        }
        unset($row);

        $result = array_values($accumulator);
        usort($result, static fn (array $left, array $right): int => $right['chars'] <=> $left['chars']);

        return $result;
    }

    private function deduplicateByKey(array $rows, string $key): array
    {
        $seen = [];
        $result = [];

        foreach ($rows as $row) {
            $value = isset($row[$key]) ? (string) $row[$key] : '';
            if ($value === '' || isset($seen[$value])) {
                continue;
            }
            $seen[$value] = true;
            $result[] = $row;
        }

        return $result;
    }
}
