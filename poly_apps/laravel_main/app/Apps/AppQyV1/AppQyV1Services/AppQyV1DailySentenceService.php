<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Providers\PathMapper;
use Illuminate\Support\Facades\Log;

/**
 * Daily short-sentence center (file-backed, never a database).
 *
 * Receives pycore-assisted prompt translations (English + 3 fluent variants +
 * TTS audio) and stores them as "daily short sentences" for the wordnew
 * daily-reading view. Keyed by md5(english) so the same sentence is not stored
 * twice. Audio reuses the existing AppQyV1 sentence-audio pipeline URL scheme.
 */
class AppQyV1DailySentenceService
{
    private const STORE_NAME = 'daily_sentences';

    private function dir(): string
    {
        $dir = PathMapper::getLaravelDatabaseDir(self::STORE_NAME);
        PathMapper::ensureDirectory($dir);
        return $dir;
    }

    private function indexPath(): string
    {
        return $this->dir() . '/index.json';
    }

    public function audioFile(string $id): string
    {
        $dir = $this->dir() . '/audio';
        PathMapper::ensureDirectory($dir);
        return $dir . '/' . preg_replace('/[^A-Za-z0-9]/', '', $id) . '.mp3';
    }

    /**
     * Write the assist audio bytes (if any) and return the served audio ref,
     * else any pre-resolved 'audio' ref on the record, else null.
     */
    private function writeAudio(string $id, array $record): ?array
    {
        $existing = is_array($record['audio'] ?? null) ? $record['audio'] : null;
        $b64 = (string) ($record['audio_b64'] ?? '');
        if ($b64 === '') {
            return $existing;
        }
        $bytes = base64_decode($b64, true);
        if ($bytes === false || $bytes === '' || @file_put_contents($this->audioFile($id), $bytes) === false) {
            return $existing;
        }
        return [
            'url' => '/api/app_qy_v1/daily-sentences/audio/' . $id,
            'language' => 'en',
            'mime' => 'audio/mpeg',
        ];
    }

    /**
     * Store one assisted translation as a daily sentence. Deduped by english text.
     * When `audio_b64` is present the MP3 bytes are written and an `audio.url`
     * (served by AppQyV1DailySentenceController::audio) is attached.
     *
     * @param array $record {english, cleaned, variants[], audio, audio_b64, source_lang}
     * @return array|null the stored (or pre-existing) item
     */
    public function ingestFromAssist(array $record, string $original = ''): ?array
    {
        $english = trim((string) ($record['cleaned'] ?? ($record['english'] ?? '')));
        if ($english === '') {
            return null;
        }
        $id = substr(md5($english), 0, 16);

        $items = $this->readJson($this->indexPath());
        $items = is_array($items) ? $items : [];
        if (isset($items[$id])) {
            // Known sentence — do not duplicate, but backfill audio if a later
            // result carries it and the stored item still has none.
            if (empty($items[$id]['audio']['url'])) {
                $audio = $this->writeAudio($id, $record);
                if (!empty($audio['url'])) {
                    $items[$id]['audio'] = $audio;
                    $this->writeJson($this->indexPath(), $items);
                }
            }
            return $items[$id];
        }

        $audio = $this->writeAudio($id, $record);

        $items[$id] = [
            'id' => $id,
            'english' => $english,
            'original' => $original,
            'source_lang' => (string) ($record['source_lang'] ?? ''),
            'variants' => array_values(array_filter((array) ($record['variants'] ?? []), 'is_string')),
            'audio' => $audio,
            'created_at' => date('Y-m-d H:i:s'),
            'created_ts' => time(),
        ];
        $this->writeJson($this->indexPath(), $items);
        return $items[$id];
    }

    /** @return array{items: array<int,array>, total: int} newest first */
    public function list(int $limit, int $offset): array
    {
        $items = $this->readJson($this->indexPath());
        $items = is_array($items) ? array_values($items) : [];
        usort($items, static fn ($a, $b) => ($b['created_ts'] ?? 0) <=> ($a['created_ts'] ?? 0));
        $total = count($items);
        if ($limit <= 0) {
            $limit = 50;
        }
        return ['items' => array_slice($items, max(0, $offset), $limit), 'total' => $total];
    }

    /** Today's recommended sentence (stable within a day), or null when empty. */
    public function recommend(): ?array
    {
        $items = $this->readJson($this->indexPath());
        $items = is_array($items) ? array_values($items) : [];
        if (empty($items)) {
            return null;
        }
        usort($items, static fn ($a, $b) => ($a['created_ts'] ?? 0) <=> ($b['created_ts'] ?? 0));
        $idx = ((int) date('z')) % count($items);
        return $items[$idx];
    }

    public function get(string $id): ?array
    {
        $items = $this->readJson($this->indexPath());
        return is_array($items) && isset($items[$id]) ? $items[$id] : null;
    }

    private function readJson(string $path): ?array
    {
        if (!is_file($path)) {
            return null;
        }
        $raw = @file_get_contents($path);
        if ($raw === false) {
            return null;
        }
        $data = json_decode($raw, true);
        return is_array($data) ? $data : null;
    }

    private function writeJson(string $path, $data): void
    {
        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            Log::warning('daily_sentences: json_encode failed', ['path' => $path]);
            return;
        }
        $tmp = $path . '.tmp' . getmypid();
        if (@file_put_contents($tmp, $json) === false || !@rename($tmp, $path)) {
            @unlink($tmp);
            Log::warning('daily_sentences: write failed', ['path' => $path]);
        }
    }
}
