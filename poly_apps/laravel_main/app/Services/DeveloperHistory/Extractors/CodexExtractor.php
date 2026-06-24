<?php

namespace App\Services\DeveloperHistory\Extractors;

/**
 * OpenAI Codex CLI extractor (best-effort; layout from upstream knowledge,
 * not byte-verified on this machine).
 *
 *   <home>/.codex/sessions/YYYY/MM/DD/rollout-<ts>-<uuid>.jsonl  per-session
 *   <home>/.codex/history.jsonl                                  typed prompts
 *
 * Each rollout line is {timestamp,type,payload}; first line is session_meta.
 * Sub-agents are separate rollout files (no in-line sidechain flag).
 */
class CodexExtractor extends AbstractExtractor
{
    public function tool(): string
    {
        return 'codex';
    }

    public function extract(string $home, string $user): array
    {
        $root = $home . '/.codex';
        if (!is_dir($root)) {
            return [];
        }
        $sessions = [];

        $sessionsDir = $root . '/sessions';
        if (is_dir($sessionsDir)) {
            foreach ($this->findRollouts($sessionsDir) as $file) {
                $sess = $this->parseRollout($file, $user);
                if ($sess !== null) {
                    $sessions[] = $sess;
                }
            }
        }

        $global = $this->parseGlobalPrompts($root, $user);
        if ($global !== null) {
            $sessions[] = $global;
        }

        return $sessions;
    }

    /** Recursively collect rollout-*.jsonl files under the date-bucketed tree. */
    private function findRollouts(string $dir): array
    {
        $found = [];
        $it = @glob($dir . '/*');
        foreach ($it ?: [] as $path) {
            if (is_dir($path)) {
                $found = array_merge($found, $this->findRollouts($path));
            } elseif (str_ends_with($path, '.jsonl') && str_contains(basename($path), 'rollout')) {
                $found[] = $path;
            }
        }
        return $found;
    }

    private function parseRollout(string $file, string $user): ?array
    {
        $entries = $this->loadJsonl($file);
        if (empty($entries)) {
            return null;
        }

        $turns = [];
        $prompts = [];
        $sessionId = '';
        $project = '';
        $first = 0;
        $last = 0;

        foreach ($entries as $e) {
            $ts = $this->tsToEpoch($e['timestamp'] ?? null);
            if ($ts > 0) {
                $last = $ts;
                if ($first === 0) {
                    $first = $ts;
                }
            }
            $type = $e['type'] ?? ($e['record_type'] ?? '');
            $payload = $e['payload'] ?? $e;

            if ($type === 'session_meta' || isset($payload['cwd'])) {
                $sessionId = $sessionId !== '' ? $sessionId : (string) ($payload['id'] ?? '');
                $project = $project !== '' ? $project : (string) ($payload['cwd'] ?? '');
                continue;
            }

            $ptype = $payload['type'] ?? '';
            if ($ptype === 'message') {
                $role = (string) ($payload['role'] ?? 'assistant');
                $text = $this->extractResponseText($payload['content'] ?? []);
                if (trim($text) === '') {
                    continue;
                }
                if ($role === 'user') {
                    $prompts[] = ['ts' => $ts, 'text' => $this->truncate($text)];
                    $turns[] = $this->turn($ts, 'user', $text);
                } else {
                    $turns[] = $this->turn($ts, 'assistant', $text);
                }
            } elseif ($ptype === 'function_call') {
                $args = json_encode($payload['arguments'] ?? null, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                $turns[] = $this->turn($ts, 'tool_use', (string) $args, false, null, (string) ($payload['name'] ?? '?'));
            } elseif ($ptype === 'function_call_output') {
                $turns[] = $this->turn($ts, 'tool_result', (string) ($payload['output'] ?? ''));
            }

            if (count($turns) > self::MAX_TURNS) {
                break;
            }
        }

        if ($sessionId === '') {
            $sessionId = pathinfo($file, PATHINFO_FILENAME);
        }
        if (empty($turns)) {
            return null;
        }

        return [
            'tool' => $this->tool(),
            'os_user' => $user,
            'raw_id' => $sessionId,
            'project' => $project,
            'title' => '',
            'started_ts' => $first,
            'started_at' => $first > 0 ? date('Y-m-d H:i:s', $first) : '',
            'ended_at' => $last > 0 ? date('Y-m-d H:i:s', $last) : '',
            'prompt_count' => count($prompts),
            'message_count' => count($turns),
            'has_subagent' => false,
            'models' => [],
            'source_path' => $file,
            'source_mtime' => (int) @filemtime($file),
            'bytes' => (int) @filesize($file),
            'prompts' => $prompts,
            'turns' => $turns,
        ];
    }

    /** Responses-API content[] -> text (input_text/output_text blocks). */
    private function extractResponseText($content): string
    {
        if (is_string($content)) {
            return $content;
        }
        if (!is_array($content)) {
            return '';
        }
        $parts = [];
        foreach ($content as $b) {
            if (is_array($b) && isset($b['text'])) {
                $parts[] = (string) $b['text'];
            } elseif (is_string($b)) {
                $parts[] = $b;
            }
        }
        return implode("\n", $parts);
    }

    private function parseGlobalPrompts(string $root, string $user): ?array
    {
        $src = $root . '/history.jsonl';
        if (!is_file($src)) {
            return null;
        }
        $rows = $this->loadJsonl($src);
        if (empty($rows)) {
            return null;
        }
        $prompts = [];
        $turns = [];
        $first = 0;
        $last = 0;
        foreach ($rows as $d) {
            $text = trim((string) ($d['text'] ?? ($d['display'] ?? '')));
            if ($text === '') {
                continue;
            }
            $ts = $this->tsToEpoch($d['ts'] ?? ($d['timestamp'] ?? null));
            if ($ts > 0) {
                $last = $ts;
                if ($first === 0) {
                    $first = $ts;
                }
            }
            $prompts[] = ['ts' => $ts, 'text' => $this->truncate($text)];
            $turns[] = $this->turn($ts, 'user', $text);
        }
        if (empty($prompts)) {
            return null;
        }

        return [
            'tool' => $this->tool(),
            'os_user' => $user,
            'raw_id' => 'global-typed-prompts',
            'project' => '(all projects)',
            'title' => 'Typed prompts (global history.jsonl)',
            'started_ts' => $first,
            'started_at' => $first > 0 ? date('Y-m-d H:i:s', $first) : '',
            'ended_at' => $last > 0 ? date('Y-m-d H:i:s', $last) : '',
            'prompt_count' => count($prompts),
            'message_count' => count($turns),
            'has_subagent' => false,
            'models' => [],
            'source_path' => $src,
            'source_mtime' => (int) @filemtime($src),
            'bytes' => (int) @filesize($src),
            'prompts' => $prompts,
            'turns' => $turns,
        ];
    }
}
