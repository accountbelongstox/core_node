<?php

namespace App\Services\DeveloperHistory;

use App\Providers\PathMapper;
use App\Services\DeveloperHistory\Extractors\ClaudeCodeExtractor;
use App\Services\DeveloperHistory\Extractors\CodexExtractor;
use App\Services\DeveloperHistory\Extractors\CursorExtractor;
use App\Services\DeveloperHistory\Extractors\GeminiExtractor;
use Illuminate\Support\Facades\Log;

/**
 * Developer AI-tool history extractor / store.
 *
 * Walks every user home (Laravel runs as root, so it can read all users incl.
 * root) and extracts prompt + session history from Claude Code, Codex, Gemini
 * and Cursor into an idempotent JSON store under the mapped laravel_db data dir
 * (PathMapper::getLaravelDatabaseDir('dev_tool_history')):
 *
 *   index.json               session summaries + tool/user facets + meta
 *   prompts.json             flat, newest-first prompt list (capped)
 *   sessions/<id>.json       per-session detail (prompts + full transcript)
 *   state.json              run metadata
 *
 * Writes are idempotent: the same session id overwrites its own file, so a
 * re-run never produces duplicates.
 */
class DeveloperHistoryService
{
    /** Folder name under the laravel_db data dir. */
    private const STORE_NAME = 'dev_tool_history';

    /** Cap for the flat prompts.json (newest first). */
    private const PROMPTS_CAP = 8000;

    /** Tool data dirs whose presence marks a "developer machine". */
    private const TOOL_MARKERS = ['.claude', '.codex', '.gemini', '.cursor', '.config/Cursor'];

    /** @var array<int, \App\Services\DeveloperHistory\Extractors\ExtractorInterface> */
    private array $extractors;

    public function __construct()
    {
        $this->extractors = [
            new ClaudeCodeExtractor(),
            new CodexExtractor(),
            new GeminiExtractor(),
            new CursorExtractor(),
        ];
    }

    // ---------------------------------------------------------------- store paths

    public function storeDir(): string
    {
        $dir = PathMapper::getLaravelDatabaseDir(self::STORE_NAME);
        PathMapper::ensureDirectory($dir);
        return $dir;
    }

    private function sessionsDir(): string
    {
        $dir = $this->storeDir() . '/sessions';
        PathMapper::ensureDirectory($dir);
        return $dir;
    }

    // ---------------------------------------------------------------- detection

    /**
     * Map of [home => os_user] for every readable user home (root + /home/*).
     */
    public function userHomes(): array
    {
        $homes = [];
        if (is_dir('/root')) {
            $homes['/root'] = 'root';
        }
        foreach (glob('/home/*', GLOB_ONLYDIR) ?: [] as $home) {
            $homes[$home] = basename($home);
        }
        return $homes;
    }

    /**
     * A developer machine = any user home holds a known AI-tool data dir, or the
     * host has a desktop / WSL environment.
     */
    public function isDevMachine(): bool
    {
        foreach ($this->userHomes() as $home => $user) {
            foreach (self::TOOL_MARKERS as $marker) {
                if (file_exists($home . '/' . $marker)) {
                    return true;
                }
            }
        }
        return PathMapper::hasDesktopEnvironment() || PathMapper::isWSL();
    }

    // ---------------------------------------------------------------- extraction

    /**
     * Extract all tools for all users into the JSON store. Idempotent.
     *
     * @return array<string, mixed> run summary
     */
    public function extract(bool $force = false): array
    {
        $store = $this->storeDir();
        $generatedAt = date('Y-m-d H:i:s');

        if (!$this->isDevMachine()) {
            $index = [
                'is_dev_machine' => false,
                'generated_at' => $generatedAt,
                'tools' => [],
                'users' => [],
                'sessions' => [],
                'counts' => [],
            ];
            $this->writeJson($store . '/index.json', $index);
            $this->writeJson($store . '/prompts.json', []);
            $this->writeJson($store . '/state.json', [
                'is_dev_machine' => false,
                'generated_at' => $generatedAt,
                'forced' => $force,
            ]);
            return ['is_dev_machine' => false, 'sessions' => 0, 'prompts' => 0];
        }

        $sessionsDir = $this->sessionsDir();
        $summaries = [];
        $flatPrompts = [];
        $tools = [];
        $users = [];

        foreach ($this->userHomes() as $home => $user) {
            foreach ($this->extractors as $extractor) {
                $sessions = $extractor->extract($home, $user);
                foreach ($sessions as $sess) {
                    $id = $this->safeId($sess['tool'] . '__' . $sess['os_user'] . '__' . $sess['raw_id']);
                    $file = $id . '.json';

                    $detail = $sess;
                    $detail['id'] = $id;
                    $detail['file'] = $file;
                    $this->writeJson($sessionsDir . '/' . $file, $detail);

                    $summary = $detail;
                    unset($summary['prompts'], $summary['turns']);
                    $summaries[] = $summary;

                    $tools[$sess['tool']] = true;
                    $users[$sess['os_user']] = true;

                    foreach ($sess['prompts'] as $p) {
                        $flatPrompts[] = [
                            'tool' => $sess['tool'],
                            'os_user' => $sess['os_user'],
                            'project' => $sess['project'],
                            'session_id' => $id,
                            'ts' => $p['ts'],
                            'time' => $p['ts'] > 0 ? date('Y-m-d H:i:s', $p['ts']) : '',
                            'text' => $p['text'],
                        ];
                    }
                }
            }
        }

        // Newest first.
        usort($summaries, static fn ($a, $b) => ($b['started_ts'] ?? 0) <=> ($a['started_ts'] ?? 0));
        usort($flatPrompts, static fn ($a, $b) => ($b['ts'] ?? 0) <=> ($a['ts'] ?? 0));
        if (count($flatPrompts) > self::PROMPTS_CAP) {
            $flatPrompts = array_slice($flatPrompts, 0, self::PROMPTS_CAP);
        }

        $index = [
            'is_dev_machine' => true,
            'generated_at' => $generatedAt,
            'tools' => array_keys($tools),
            'users' => array_keys($users),
            'sessions' => $summaries,
            'counts' => [
                'sessions' => count($summaries),
                'prompts' => count($flatPrompts),
                'tools' => count($tools),
                'users' => count($users),
            ],
        ];

        $this->writeJson($store . '/index.json', $index);
        $this->writeJson($store . '/prompts.json', $flatPrompts);
        $this->writeJson($store . '/state.json', [
            'is_dev_machine' => true,
            'generated_at' => $generatedAt,
            'forced' => $force,
            'counts' => $index['counts'],
        ]);

        return [
            'is_dev_machine' => true,
            'sessions' => count($summaries),
            'prompts' => count($flatPrompts),
            'tools' => array_keys($tools),
            'users' => array_keys($users),
        ];
    }

    // ---------------------------------------------------------------- read API

    public function readIndex(): array
    {
        $index = $this->readJson($this->storeDir() . '/index.json');
        if ($index === null) {
            // Lazily build on first read if a boot extraction has not run yet.
            $this->extract(false);
            $index = $this->readJson($this->storeDir() . '/index.json');
        }
        return $index ?? [
            'is_dev_machine' => $this->isDevMachine(),
            'generated_at' => '',
            'tools' => [],
            'users' => [],
            'sessions' => [],
            'counts' => [],
        ];
    }

    /**
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    public function readPrompts(?string $tool, ?string $user, int $limit, int $offset): array
    {
        $all = $this->readJson($this->storeDir() . '/prompts.json');
        if (!is_array($all)) {
            $all = [];
        }
        $filtered = array_values(array_filter($all, static function ($p) use ($tool, $user) {
            if ($tool !== null && $tool !== '' && ($p['tool'] ?? '') !== $tool) {
                return false;
            }
            if ($user !== null && $user !== '' && ($p['os_user'] ?? '') !== $user) {
                return false;
            }
            return true;
        }));

        $total = count($filtered);
        if ($limit <= 0) {
            $limit = 500;
        }
        $items = array_slice($filtered, max(0, $offset), $limit);
        return ['items' => $items, 'total' => $total];
    }

    public function readSession(string $id): ?array
    {
        $safe = $this->safeId($id);
        $path = $this->sessionsDir() . '/' . $safe . '.json';
        return $this->readJson($path);
    }

    // ---------------------------------------------------------------- helpers

    private function safeId(string $id): string
    {
        $clean = preg_replace('/[^A-Za-z0-9._-]/', '-', $id);
        $clean = trim((string) $clean, '-');
        return $clean !== '' ? $clean : 'unknown';
    }

    private function writeJson(string $path, $data): void
    {
        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            Log::warning('developer_history: json_encode failed', ['path' => $path]);
            return;
        }
        if (@file_put_contents($path, $json, LOCK_EX) === false) {
            Log::warning('developer_history: write failed', ['path' => $path]);
        }
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
}
