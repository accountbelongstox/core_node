<?php

namespace App\Services\DeveloperHistory\Extractors;

use PDO;

/**
 * Cursor IDE extractor (best-effort; SQLite layout from upstream knowledge,
 * not byte-verified on this machine). Requires the pdo_sqlite extension.
 *
 *   <home>/.config/Cursor/User/globalStorage/state.vscdb        global chat store
 *   <home>/.config/Cursor/User/workspaceStorage/<hash>/state.vscdb  per-workspace
 *
 * Chat lives in table ItemTable(key, value) where value is JSON. Schema drifts
 * across Cursor versions, so keys are matched loosely and missing fields tolerated.
 */
class CursorExtractor extends AbstractExtractor
{
    public function tool(): string
    {
        return 'cursor';
    }

    public function extract(string $home, string $user): array
    {
        if (!extension_loaded('pdo_sqlite')) {
            return [];
        }
        $base = $home . '/.config/Cursor/User';
        if (!is_dir($base)) {
            return [];
        }

        $dbs = [];
        $global = $base . '/globalStorage/state.vscdb';
        if (is_file($global)) {
            $dbs[] = $global;
        }
        foreach (glob($base . '/workspaceStorage/*/state.vscdb') ?: [] as $db) {
            $dbs[] = $db;
        }

        $sessions = [];
        foreach ($dbs as $db) {
            foreach ($this->parseDb($db, $user) as $sess) {
                $sessions[] = $sess;
            }
        }
        return $sessions;
    }

    private function parseDb(string $db, string $user): array
    {
        $rows = $this->readItemTable($db);
        if (empty($rows)) {
            return [];
        }

        $out = [];
        $mtime = (int) @filemtime($db);
        $bytes = (int) @filesize($db);

        foreach ($rows as $key => $value) {
            $decoded = json_decode($value, true);
            if (!is_array($decoded)) {
                continue;
            }
            $conversations = $this->findConversations($decoded);
            foreach ($conversations as $idx => $conv) {
                $turns = $this->bubblesToTurns($conv);
                if (empty($turns)) {
                    continue;
                }
                $prompts = [];
                foreach ($turns as $t) {
                    if ($t['role'] === 'user') {
                        $prompts[] = ['ts' => $t['ts'], 'text' => $t['text']];
                    }
                }
                $rawId = (string) ($conv['composerId'] ?? ($conv['id'] ?? ($key . '-' . $idx)));
                $out[] = [
                    'tool' => $this->tool(),
                    'os_user' => $user,
                    'raw_id' => $rawId,
                    'project' => basename(dirname($db)),
                    'title' => (string) ($conv['name'] ?? ($conv['title'] ?? '')),
                    'started_ts' => $mtime,
                    'started_at' => $mtime > 0 ? date('Y-m-d H:i:s', $mtime) : '',
                    'ended_at' => $mtime > 0 ? date('Y-m-d H:i:s', $mtime) : '',
                    'prompt_count' => count($prompts),
                    'message_count' => count($turns),
                    'has_subagent' => false,
                    'models' => [],
                    'source_path' => $db,
                    'source_mtime' => $mtime,
                    'bytes' => $bytes,
                    'prompts' => $prompts,
                    'turns' => $turns,
                ];
            }
        }
        return $out;
    }

    /** Read chat/composer/aiService rows from ItemTable read-only. */
    private function readItemTable(string $db): array
    {
        $rows = [];
        try {
            $pdo = new PDO('sqlite:' . $db, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_SILENT,
            ]);
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

    /** Heuristically locate conversation objects inside a decoded blob. */
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

    /** Turn a conversation's bubbles/messages into normalized turns. */
    private function bubblesToTurns(array $conv): array
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
            $turns[] = $this->turn(0, $isUser ? 'user' : 'assistant', $text);
            if (count($turns) > self::MAX_TURNS) {
                break;
            }
        }
        return $turns;
    }
}
