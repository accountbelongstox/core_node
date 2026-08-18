<?php

namespace App\Services\DeveloperHistory\Extractors;

use PDO;

/**
 * Cursor IDE extractor (best-effort; SQLite layout, schema drifts by version).
 * Requires the pdo_sqlite extension.
 *
 *   <home>/.config/Cursor/User/globalStorage/state.vscdb        global chat store
 *   <home>/.config/Cursor/User/workspaceStorage/<hash>/state.vscdb  per-workspace
 *
 * Chat lives in table ItemTable(key, value) where value is JSON; keys matched
 * loosely (chat/composer/aiService) and missing fields tolerated.
 */
class CursorExtractor extends AbstractExtractor
{
    public function tool(): string
    {
        return 'cursor';
    }

    public function discover(string $home, string $user): array
    {
        if (!extension_loaded('pdo_sqlite')) {
            return [];
        }
        $base = $home . '/.config/Cursor/User';
        if (!is_dir($base)) {
            return [];
        }
        $out = [];
        $global = $base . '/globalStorage/state.vscdb';
        if (is_file($global)) {
            $out[] = $this->descriptor($global);
        }
        foreach (glob($base . '/workspaceStorage/*/state.vscdb') ?: [] as $db) {
            $out[] = $this->descriptor($db);
        }
        return $out;
    }

    public function parseSource(string $path, string $user): array
    {
        if (!extension_loaded('pdo_sqlite')) {
            return [];
        }
        $rows = $this->readItemTable($path);
        if (empty($rows)) {
            return [];
        }

        $out = [];
        $mtime = (int) @filemtime($path);

        foreach ($rows as $key => $value) {
            $decoded = json_decode($value, true);
            if (!is_array($decoded)) {
                continue;
            }
            foreach ($this->findConversations($decoded) as $idx => $conv) {
                $turns = $this->bubblesToTurns($conv, $mtime);
                if (empty($turns)) {
                    continue;
                }
                $prompts = [];
                foreach ($turns as $turn) {
                    if ($turn['role'] === 'user') {
                        $prompts[] = ['ts' => $turn['ts'], 'text' => $turn['text']];
                    }
                }
                $rawId = (string) ($conv['composerId'] ?? ($conv['id'] ?? ($key . '-' . $idx)));
                $out[] = $this->session('cursor', $user, $rawId, [
                    'project' => basename(dirname($path)),
                    'title' => (string) ($conv['name'] ?? ($conv['title'] ?? '')),
                    'firstTs' => $mtime,
                    'lastTs' => $mtime,
                    'source' => $path,
                    'prompts' => $prompts,
                    'turns' => $turns,
                ]);
            }
        }
        return $out;
    }

    /** Read chat/composer/aiService rows from ItemTable read-only. */
    private function readItemTable(string $db): array
    {
        $rows = [];
        try {
            $pdo = new PDO('sqlite:' . $db, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_SILENT]);
            $pdo->exec('PRAGMA query_only = 1');
            $stmt = $pdo->query(
                "SELECT key, value FROM ItemTable WHERE key LIKE '%chat%' "
                . "OR key LIKE '%composer%' OR key LIKE '%aiService%'"
            );
            if ($stmt !== false) {
                while (($r = $stmt->fetch(PDO::FETCH_NUM)) !== false) {
                    $rows[(string) $r[0]] = (string) $r[1];
                }
            }
        } catch (\Throwable $e) {
            return [];
        }
        return $rows;
    }

    private function findConversations(array $blob): array
    {
        foreach (['tabs', 'conversations', 'allComposers', 'composers'] as $field) {
            if (isset($blob[$field]) && is_array($blob[$field])) {
                return $blob[$field];
            }
        }
        if (isset($blob['bubbles']) || isset($blob['messages']) || isset($blob['conversation'])) {
            return [$blob];
        }
        return [];
    }

    private function bubblesToTurns(array $conv, int $ts): array
    {
        $list = null;
        foreach (['bubbles', 'messages', 'conversation'] as $field) {
            if (isset($conv[$field]) && is_array($conv[$field])) {
                $list = $conv[$field];
                break;
            }
        }
        if ($list === null) {
            return [];
        }

        $turns = [];
        foreach ($list as $b) {
            if (!is_array($b)) {
                continue;
            }
            $text = trim((string) ($b['text'] ?? ($b['content'] ?? '')));
            if ($text === '') {
                continue;
            }
            $type = $b['type'] ?? ($b['role'] ?? '');
            $isUser = ($type === 1 || $type === '1' || $type === 'user');
            $turns[] = $this->turn($ts, $isUser ? 'user' : 'assistant', $text);
            if (count($turns) > self::MAX_TURNS) {
                break;
            }
        }
        return $turns;
    }
}
