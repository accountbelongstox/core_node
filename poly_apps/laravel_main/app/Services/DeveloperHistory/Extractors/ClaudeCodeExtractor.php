<?php

namespace App\Services\DeveloperHistory\Extractors;

/**
 * Claude Code extractor (verified layout).
 *
 *   <home>/.claude/projects/<slug>/<session>.jsonl   full per-session transcript
 *   <home>/.claude/history.jsonl                     global typed-prompt log
 *
 * Sub-agent (Task tool) turns carry isSidechain=true in the same session file.
 */
class ClaudeCodeExtractor extends AbstractExtractor
{
    public function tool(): string
    {
        return 'claude';
    }

    public function extract(string $home, string $user): array
    {
        $root = $home . '/.claude';
        $sessions = [];

        $projects = $root . '/projects';
        if (is_dir($projects)) {
            foreach (glob($projects . '/*', GLOB_ONLYDIR) ?: [] as $pdir) {
                foreach (glob($pdir . '/*.jsonl') ?: [] as $file) {
                    $sess = $this->parseSession($file, $user);
                    if ($sess !== null) {
                        $sessions[] = $sess;
                    }
                }
            }
        }

        $global = $this->parseGlobalPrompts($root, $user);
        if ($global !== null) {
            $sessions[] = $global;
        }

        return $sessions;
    }

    private function parseSession(string $file, string $user): ?array
    {
        $entries = $this->loadJsonl($file);
        if (empty($entries)) {
            return null;
        }

        $turns = [];
        $prompts = [];
        $hasSubagent = false;
        $sessionId = '';
        $project = '';
        $branch = '';
        $title = '';
        $models = [];
        $firstTs = 0;
        $lastTs = 0;

        foreach ($entries as $e) {
            $type = $e['type'] ?? '';
            $ts = $this->tsToEpoch($e['timestamp'] ?? null);
            if ($ts > 0) {
                $lastTs = $ts;
                if ($firstTs === 0) {
                    $firstTs = $ts;
                }
            }
            $sessionId = $sessionId !== '' ? $sessionId : (string) ($e['sessionId'] ?? '');
            $project = $project !== '' ? $project : (string) ($e['cwd'] ?? '');
            $branch = $branch !== '' ? $branch : (string) ($e['gitBranch'] ?? '');
            $isSide = ($e['isSidechain'] ?? false) === true;
            if ($isSide) {
                $hasSubagent = true;
            }

            if ($type === 'ai-title') {
                $title = (string) ($e['title'] ?? ($e['message'] ?? $title));
                continue;
            }

            if ($type === 'user') {
                [$kind, $text] = $this->classifyUser($e);
                $text = trim($text);
                if ($text === '') {
                    continue;
                }
                if ($kind === 'prompt') {
                    $prompts[] = ['ts' => $ts, 'text' => $this->truncate($text)];
                    $turns[] = $this->turn($ts, 'user', $text, $isSide);
                } elseif ($kind === 'tool_result') {
                    $turns[] = $this->turn($ts, 'tool_result', $text, $isSide);
                }
            } elseif ($type === 'assistant') {
                $msg = $e['message'] ?? [];
                $model = $msg['model'] ?? null;
                if (is_string($model) && $model !== '') {
                    $models[$model] = true;
                }
                $content = $msg['content'] ?? [];
                if (is_string($content)) {
                    $content = [['type' => 'text', 'text' => $content]];
                }
                if (is_array($content)) {
                    foreach ($content as $b) {
                        if (!is_array($b)) {
                            continue;
                        }
                        $bt = $b['type'] ?? '';
                        if ($bt === 'text' && trim((string) ($b['text'] ?? '')) !== '') {
                            $turns[] = $this->turn($ts, 'assistant', (string) $b['text'], $isSide, $model);
                        } elseif ($bt === 'thinking' && trim((string) ($b['thinking'] ?? '')) !== '') {
                            $turns[] = $this->turn($ts, 'thinking', (string) $b['thinking'], $isSide, $model);
                        } elseif ($bt === 'tool_use') {
                            $input = json_encode($b['input'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                            $turns[] = $this->turn($ts, 'tool_use', (string) $input, $isSide, $model, (string) ($b['name'] ?? '?'));
                        }
                    }
                }
            }

            if (count($turns) > self::MAX_TURNS) {
                break;
            }
        }

        if ($sessionId === '') {
            $sessionId = pathinfo($file, PATHINFO_FILENAME);
        }

        return [
            'tool' => $this->tool(),
            'os_user' => $user,
            'raw_id' => $sessionId,
            'project' => $project,
            'title' => $title,
            'started_ts' => $firstTs,
            'started_at' => $firstTs > 0 ? date('Y-m-d H:i:s', $firstTs) : '',
            'ended_at' => $lastTs > 0 ? date('Y-m-d H:i:s', $lastTs) : '',
            'prompt_count' => count($prompts),
            'message_count' => count($turns),
            'has_subagent' => $hasSubagent,
            'models' => array_keys($models),
            'source_path' => $file,
            'source_mtime' => (int) @filemtime($file),
            'bytes' => (int) @filesize($file),
            'prompts' => $prompts,
            'turns' => $turns,
        ];
    }

    /**
     * Classify a Claude user entry: ['prompt'|'tool_result'|'meta', text].
     */
    private function classifyUser(array $entry): array
    {
        $content = $entry['message']['content'] ?? null;
        if (is_array($content)) {
            $chunks = [];
            $isToolResult = false;
            foreach ($content as $b) {
                if (!is_array($b)) {
                    $chunks[] = (string) $b;
                    continue;
                }
                $bt = $b['type'] ?? '';
                if ($bt === 'tool_result') {
                    $isToolResult = true;
                    $chunks[] = $this->stringifyContent($b['content'] ?? '');
                } elseif ($bt === 'text') {
                    $chunks[] = (string) ($b['text'] ?? '');
                } elseif ($bt === 'image') {
                    $chunks[] = '[image]';
                }
            }
            $kind = $isToolResult ? 'tool_result' : 'prompt';
            return [$kind, implode("\n", array_filter($chunks, static fn ($c) => $c !== ''))];
        }
        $text = is_string($content) ? $content : $this->stringifyContent($content);
        if (preg_match('/^\s*<(command-name|command-message|local-command|bash-input)/', $text)) {
            return ['meta', $text];
        }
        return ['prompt', $text];
    }

    /**
     * The global typed-prompt log becomes one synthetic "prompts" session.
     */
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
            $text = trim((string) ($d['display'] ?? ''));
            if ($text === '') {
                continue;
            }
            $ts = $this->tsToEpoch($d['timestamp'] ?? null);
            if ($ts > 0) {
                $last = $ts;
                if ($first === 0) {
                    $first = $ts;
                }
            }
            $prompts[] = ['ts' => $ts, 'text' => $this->truncate($text)];
            $turns[] = $this->turn($ts, 'user', $text, false, null, (string) ($d['project'] ?? ''));
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
