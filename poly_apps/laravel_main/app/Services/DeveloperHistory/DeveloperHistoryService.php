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
 * and Cursor into an IDEMPOTENT, INCREMENTAL JSON store under the mapped
 * laravel_db data dir (PathMapper::getLaravelDatabaseDir('dev_tool_history')):
 *
 *   index.json          session summaries + tool/user facets + meta
 *   prompts.json        flat, newest-first prompt list (capped) — carries edits
 *   sessions/<id>.json  per-session detail (prompts + full transcript)
 *   prompt_edits.json   user edits overlay (id -> {text, edited_at})
 *   state.json          per-source mtimes + signature (drives incremental scan)
 *
 * The resident scanner calls extract() every ~10s. A cheap discovery pass
 * (list files + mtimes) yields a signature; when it is unchanged the call
 * returns immediately. Only changed/new source files are re-parsed, so a large
 * Claude history (hundreds of MB) is never re-read on an unchanged tick.
 */
class DeveloperHistoryService
{
    private const STORE_NAME = 'dev_tool_history';
    private const PROMPTS_CAP = 8000;
    private const EDITS_NAME = 'prompt_edits.json';

    /** Tool data dirs whose presence marks a "developer machine". */
    private const TOOL_MARKERS = ['.claude', '.codex', '.gemini', '.cursor', '.config/Cursor'];

    /** Cached resolved store dir (avoids repeating disk-base detection each tick). */
    private static ?string $storeDirCache = null;

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
        if (self::$storeDirCache === null) {
            $dir = PathMapper::getLaravelDatabaseDir(self::STORE_NAME);
            PathMapper::ensureDirectory($dir);
            self::$storeDirCache = $dir;
        }
        return self::$storeDirCache;
    }

    private function sessionsDir(): string
    {
        $dir = $this->storeDir() . '/sessions';
        PathMapper::ensureDirectory($dir);
        return $dir;
    }

    // ---------------------------------------------------------------- detection

    /** Map of [home => os_user] for every readable user home (root + /home/*). */
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

    /** Dev machine = any user home holds an AI-tool dir, or desktop/WSL host. */
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

    /**
     * Cheap discovery: every source file across all homes/extractors with mtime.
     *
     * @return array<string, array{mtime:int,bytes:int,extractor:int,tool:string,user:string}>
     */
    private function discoverAll(): array
    {
        $map = [];
        foreach ($this->userHomes() as $home => $user) {
            foreach ($this->extractors as $idx => $extractor) {
                foreach ($extractor->discover($home, $user) as $d) {
                    $map[$d['path']] = [
                        'mtime' => $d['mtime'],
                        'bytes' => $d['bytes'],
                        'extractor' => $idx,
                        'tool' => $extractor->tool(),
                        'user' => $user,
                    ];
                }
            }
        }
        return $map;
    }

    private function signature(array $sources): string
    {
        $parts = [];
        foreach ($sources as $path => $info) {
            $parts[] = $path . ':' . $info['mtime'] . ':' . $info['bytes'];
        }
        sort($parts);
        return md5(implode('|', $parts));
    }

    // ---------------------------------------------------------------- extraction

    /**
     * Incrementally refresh the store. Cheap on an unchanged tick.
     *
     * @return array<string, mixed> run summary
     */
    public function extract(bool $force = false): array
    {
        // Never scan/parse on production hosts (mirrors the timer's isEnabled).
        if (PathMapper::isProduction()) {
            return ['is_dev_machine' => false, 'skipped' => 'production'];
        }

        $store = $this->storeDir();

        // Single-writer guard. A normal probe tick skips when another worker
        // holds the lock; a user-forced refresh waits so it always rebuilds.
        // If the lock file cannot be created, skip rather than run unlocked.
        $lock = @fopen($store . '/.extract.lock', 'c');
        if ($lock === false) {
            return $this->cachedSummary();
        }
        if (!flock($lock, $force ? LOCK_EX : (LOCK_EX | LOCK_NB))) {
            fclose($lock);
            return $this->cachedSummary();
        }

        try {
            $generatedAt = date('Y-m-d H:i:s');
            $isDev = $this->isDevMachine();
            $current = $this->discoverAll();
            $signature = $this->signature($current);

            $state = $this->readJson($store . '/state.json') ?? ['sources' => [], 'signature' => '', 'counts' => []];
            $index = $this->readJson($store . '/index.json');

            if (!$force && ($state['signature'] ?? '') === $signature && is_array($index)) {
                return ['unchanged' => true, 'is_dev_machine' => $isDev] + ($state['counts'] ?? []);
            }

            $prevSources = is_array($state['sources'] ?? null) ? $state['sources'] : [];
            $edits = $this->readEdits();
            $sessionsDir = $this->sessionsDir();

            // Existing summaries keyed by id (reused for unchanged sources).
            $summaries = [];
            if (is_array($index)) {
                foreach (($index['sessions'] ?? []) as $s) {
                    if (isset($s['id'])) {
                        $summaries[$s['id']] = $s;
                    }
                }
            }

            $changedPaths = [];
            foreach ($current as $path => $info) {
                $prev = $prevSources[$path] ?? null;
                if (!$prev || ($prev['mtime'] ?? -1) !== $info['mtime'] || ($prev['bytes'] ?? -1) !== $info['bytes']) {
                    $changedPaths[] = $path;
                }
            }
            $removedPaths = array_diff(array_keys($prevSources), array_keys($current));

            $changedIds = [];
            $removedIds = [];
            $appendPrompts = [];
            $newSources = $prevSources;

            // Drop sessions whose source vanished.
            foreach ($removedPaths as $path) {
                foreach (($prevSources[$path]['session_ids'] ?? []) as $id) {
                    @unlink($sessionsDir . '/' . $id . '.json');
                    unset($summaries[$id]);
                    $removedIds[] = $id;
                }
                unset($newSources[$path]);
            }

            // Re-parse changed/new sources only.
            foreach ($changedPaths as $path) {
                $info = $current[$path];
                $oldIds = $prevSources[$path]['session_ids'] ?? [];
                $sessions = $this->extractors[$info['extractor']]->parseSource($path, $info['user']);

                $ids = [];
                foreach ($sessions as $sess) {
                    // Bind the id to the source path so two source files that
                    // emit the same raw_id never collapse to one id (which would
                    // silently overwrite a session and drift prompts.json).
                    $srcPath = $sess['source_path'] ?? $path;
                    $id = $this->safeId($sess['tool'] . '__' . $sess['os_user'] . '__' . $sess['raw_id'])
                        . '-' . substr(md5($srcPath . '|' . $sess['raw_id']), 0, 8);
                    $detail = $sess;
                    $detail['id'] = $id;
                    $detail['file'] = $id . '.json';
                    $this->assignPromptIds($detail, $id);
                    $this->applyEdits($detail['prompts'], $edits);
                    $this->writeJson($sessionsDir . '/' . $id . '.json', $detail);

                    $summary = $detail;
                    unset($summary['prompts'], $summary['turns']);
                    $summaries[$id] = $summary;

                    foreach ($detail['prompts'] as $p) {
                        $appendPrompts[] = [
                            'id' => $p['id'],
                            'tool' => $sess['tool'],
                            'os_user' => $sess['os_user'],
                            'project' => $sess['project'],
                            'session_id' => $id,
                            'ts' => $p['ts'],
                            'time' => $p['ts'] > 0 ? date('Y-m-d H:i:s', $p['ts']) : '',
                            'text' => $p['text'],
                            'edited' => $p['edited'] ?? false,
                        ];
                    }
                    $ids[] = $id;
                    $changedIds[] = $id;
                }

                // A re-parse may drop ids that existed before — clean them.
                foreach (array_diff($oldIds, $ids) as $gone) {
                    @unlink($sessionsDir . '/' . $gone . '.json');
                    unset($summaries[$gone]);
                    $removedIds[] = $gone;
                }

                $newSources[$path] = [
                    'mtime' => $info['mtime'],
                    'bytes' => $info['bytes'],
                    'extractor' => $info['extractor'],
                    'tool' => $info['tool'],
                    'user' => $info['user'],
                    'session_ids' => $ids,
                ];
            }

            // Rebuild prompts.json incrementally: drop touched sessions, append fresh.
            $drop = array_flip(array_merge($changedIds, $removedIds));
            $prompts = $this->readJson($store . '/prompts.json');
            if (!is_array($prompts)) {
                $prompts = [];
            }
            $prompts = array_values(array_filter($prompts, static fn ($p) => !isset($drop[$p['session_id'] ?? ''])));
            $prompts = array_merge($prompts, $appendPrompts);
            usort($prompts, static fn ($a, $b) => ($b['ts'] ?? 0) <=> ($a['ts'] ?? 0));
            if (count($prompts) > self::PROMPTS_CAP) {
                $prompts = array_slice($prompts, 0, self::PROMPTS_CAP);
            }

            // Rebuild index from the summaries map.
            $sessions = array_values($summaries);
            usort($sessions, static fn ($a, $b) => ($b['started_ts'] ?? 0) <=> ($a['started_ts'] ?? 0));
            $tools = [];
            $users = [];
            foreach ($sessions as $s) {
                $tools[$s['tool'] ?? ''] = true;
                $users[$s['os_user'] ?? ''] = true;
            }
            unset($tools[''], $users['']);

            $counts = [
                'sessions' => count($sessions),
                'prompts' => count($prompts),
                'tools' => count($tools),
                'users' => count($users),
            ];

            $this->writeJson($store . '/index.json', [
                'is_dev_machine' => $isDev,
                'generated_at' => $generatedAt,
                'tools' => array_keys($tools),
                'users' => array_keys($users),
                'sessions' => $sessions,
                'counts' => $counts,
            ]);
            $this->writeJson($store . '/prompts.json', $prompts);
            $this->writeJson($store . '/state.json', [
                'is_dev_machine' => $isDev,
                'generated_at' => $generatedAt,
                'signature' => $signature,
                'sources' => $newSources,
                'counts' => $counts,
            ]);

            return ['is_dev_machine' => $isDev, 'changed' => count($changedPaths), 'removed' => count($removedPaths)] + $counts;
        } catch (\Throwable $e) {
            Log::error('developer_history: extract failed', ['error' => $e->getMessage()]);
            return ['error' => $e->getMessage()];
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    private function cachedSummary(): array
    {
        $state = $this->readJson($this->storeDir() . '/state.json');
        return ['busy' => true] + (is_array($state) ? ($state['counts'] ?? []) : []);
    }

    // ---------------------------------------------------------------- read API

    public function readIndex(): array
    {
        $index = $this->readJson($this->storeDir() . '/index.json');
        if ($index === null) {
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
        return ['items' => array_slice($filtered, max(0, $offset), $limit), 'total' => $total];
    }

    public function readSession(string $id): ?array
    {
        $path = $this->sessionsDir() . '/' . $this->safeId($id) . '.json';
        return $this->readJson($path);
    }

    /**
     * Persist a user edit of one prompt to FILES (overlay + prompts.json + detail).
     * Survives re-extraction because extract() re-applies the overlay.
     *
     * @return array<string, mixed>|null
     */
    public function updatePrompt(string $id, string $text): ?array
    {
        if (!preg_match('/^(.+)#(\d+)$/', $id, $m)) {
            return null;
        }
        $sessionId = $m[1];
        $store = $this->storeDir();

        $edits = $this->readEdits();
        $edits[$id] = ['text' => $text, 'edited_at' => date('Y-m-d H:i:s')];
        $this->writeJson($store . '/' . self::EDITS_NAME, $edits);

        // Patch the flat prompt list.
        $prompts = $this->readJson($store . '/prompts.json');
        if (is_array($prompts)) {
            foreach ($prompts as &$p) {
                if (($p['id'] ?? '') === $id) {
                    $p['text'] = $text;
                    $p['edited'] = true;
                }
            }
            unset($p);
            $this->writeJson($store . '/prompts.json', $prompts);
        }

        // Patch the session detail.
        $detailPath = $this->sessionsDir() . '/' . $this->safeId($sessionId) . '.json';
        $detail = $this->readJson($detailPath);
        if (is_array($detail)) {
            foreach (($detail['prompts'] ?? []) as &$pp) {
                if (($pp['id'] ?? '') === $id) {
                    $pp['text'] = $text;
                    $pp['edited'] = true;
                }
            }
            unset($pp);
            $this->writeJson($detailPath, $detail);
        }

        return ['id' => $id, 'text' => $text, 'edited' => true];
    }

    // ---------------------------------------------------------------- helpers

    private function readEdits(): array
    {
        $edits = $this->readJson($this->storeDir() . '/' . self::EDITS_NAME);
        return is_array($edits) ? $edits : [];
    }

    /** Give each prompt a stable id ("<sessionId>#<ordinal>"). */
    private function assignPromptIds(array &$detail, string $sessionId): void
    {
        foreach ($detail['prompts'] as $i => &$p) {
            $p['id'] = $sessionId . '#' . $i;
        }
        unset($p);
    }

    /** Overlay user edits onto a prompt list (each prompt must carry 'id'). */
    private function applyEdits(array &$prompts, array $edits): void
    {
        foreach ($prompts as &$p) {
            $id = $p['id'] ?? '';
            if ($id !== '' && isset($edits[$id]['text'])) {
                $p['text'] = $edits[$id]['text'];
                $p['edited'] = true;
            }
        }
        unset($p);
    }

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
        // Write to a temp file then rename (atomic on the same fs) so concurrent
        // readers never observe a half-written index.json / prompts.json.
        $tmp = $path . '.tmp' . getmypid();
        if (@file_put_contents($tmp, $json) === false) {
            Log::warning('developer_history: write failed', ['path' => $path]);
            return;
        }
        if (!@rename($tmp, $path)) {
            @unlink($tmp);
            Log::warning('developer_history: rename failed', ['path' => $path]);
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
