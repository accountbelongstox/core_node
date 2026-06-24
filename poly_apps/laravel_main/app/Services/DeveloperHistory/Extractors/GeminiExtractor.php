<?php

namespace App\Services\DeveloperHistory\Extractors;

/**
 * Gemini CLI extractor (paths confirmed via official gemini-cli docs).
 *
 * Conversation history + tool calls are stored as JSON under:
 *   <home>/.gemini/tmp/<project_hash>/checkpoints/*.json   auto + named checkpoints
 *   <home>/.gemini/tmp/<project_hash>/<tag>.json           `/chat save <tag>`
 *   <home>/.gemini/tmp/<project_hash>/logs.json            session message log
 *
 * Checkpoint files are an array of Gemini Content objects:
 *   [{ role: 'user'|'model', parts: [ {text} | {functionCall} | {functionResponse} ] }]
 * logs.json is an array of {sessionId, type:'user'|'gemini', message, timestamp}.
 * No first-class sub-agent concept.
 */
class GeminiExtractor extends AbstractExtractor
{
    public function tool(): string
    {
        return 'gemini';
    }

    public function discover(string $home, string $user): array
    {
        $tmp = $home . '/.gemini/tmp';
        if (!is_dir($tmp)) {
            return [];
        }
        $out = [];
        foreach (glob($tmp . '/*', GLOB_ONLYDIR) ?: [] as $projectDir) {
            $logs = $projectDir . '/logs.json';
            if (is_file($logs)) {
                $out[] = $this->descriptor($logs);
            }
            foreach (glob($projectDir . '/checkpoints/*.json') ?: [] as $cp) {
                $out[] = $this->descriptor($cp);
            }
            // `/chat save <tag>` writes <tag>.json (or checkpoint-<tag>.json) at tmp/<hash>/.
            foreach (glob($projectDir . '/*.json') ?: [] as $tag) {
                if (basename($tag) !== 'logs.json') {
                    $out[] = $this->descriptor($tag);
                }
            }
        }
        return $out;
    }

    public function parseSource(string $path, string $user): array
    {
        $data = $this->loadJson($path);
        if (!is_array($data)) {
            return [];
        }
        // logs.json -> message records grouped by sessionId.
        if (basename($path) === 'logs.json') {
            return $this->parseLogs($data, $user, $path);
        }
        // checkpoint -> single Content[] conversation.
        $sess = $this->parseCheckpoint($data, $user, $path);
        return $sess !== null ? [$sess] : [];
    }

    /** logs.json: array of {sessionId,type,message,timestamp}. */
    private function parseLogs(array $rows, string $user, string $source): array
    {
        $bySession = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $sid = (string) ($row['sessionId'] ?? 'default');
            $bySession[$sid][] = $row;
        }

        $out = [];
        foreach ($bySession as $sid => $items) {
            $turns = [];
            $prompts = [];
            $first = 0;
            $last = 0;
            foreach ($items as $row) {
                $ts = $this->tsToEpoch($row['timestamp'] ?? null);
                if ($ts > 0) {
                    $last = $ts;
                    if ($first === 0) {
                        $first = $ts;
                    }
                }
                $type = (string) ($row['type'] ?? '');
                $text = trim((string) ($row['message'] ?? ''));
                if ($text === '') {
                    continue;
                }
                if ($type === 'user') {
                    $prompts[] = ['ts' => $ts, 'text' => $this->truncate($text)];
                    $turns[] = $this->turn($ts, 'user', $text);
                } else {
                    $turns[] = $this->turn($ts, 'assistant', $text);
                }
                if (count($turns) > self::MAX_TURNS) {
                    break;
                }
            }
            if (empty($turns)) {
                continue;
            }
            $out[] = $this->session('gemini', $user, 'log-' . basename(dirname($source)) . '-' . $sid, [
                'project' => basename(dirname($source)),
                'firstTs' => $first,
                'lastTs' => $last,
                'source' => $source,
                'prompts' => $prompts,
                'turns' => $turns,
            ]);
        }
        return $out;
    }

    /** checkpoint: Content[] with role + parts[text|functionCall|functionResponse]. */
    private function parseCheckpoint(array $contents, string $user, string $source): ?array
    {
        $turns = [];
        $prompts = [];
        $mtime = (int) @filemtime($source);

        foreach ($contents as $c) {
            if (!is_array($c)) {
                continue;
            }
            $role = (string) ($c['role'] ?? '');
            $parts = $c['parts'] ?? [];
            if (!is_array($parts)) {
                continue;
            }
            $text = '';
            $isCall = false;
            $isResp = false;
            $callName = null;
            foreach ($parts as $p) {
                if (!is_array($p)) {
                    continue;
                }
                if (isset($p['text'])) {
                    $text .= ($text !== '' ? "\n" : '') . (string) $p['text'];
                } elseif (isset($p['functionCall'])) {
                    $isCall = true;
                    $callName = (string) ($p['functionCall']['name'] ?? '?');
                    $text .= json_encode($p['functionCall']['args'] ?? null, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                } elseif (isset($p['functionResponse'])) {
                    $isResp = true;
                    $text .= json_encode($p['functionResponse']['response'] ?? null, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                }
            }
            $text = trim($text);
            if ($text === '') {
                continue;
            }
            if ($isCall) {
                $turns[] = $this->turn($mtime, 'tool_use', $text, false, null, $callName);
            } elseif ($isResp) {
                $turns[] = $this->turn($mtime, 'tool_result', $text);
            } elseif ($role === 'user') {
                $prompts[] = ['ts' => $mtime, 'text' => $this->truncate($text)];
                $turns[] = $this->turn($mtime, 'user', $text);
            } else {
                $turns[] = $this->turn($mtime, 'assistant', $text);
            }
            if (count($turns) > self::MAX_TURNS) {
                break;
            }
        }

        if (empty($turns)) {
            return null;
        }

        $rawId = basename(dirname($source)) . '-' . pathinfo($source, PATHINFO_FILENAME);
        return $this->session('gemini', $user, $rawId, [
            'project' => basename(dirname($source)),
            'title' => pathinfo($source, PATHINFO_FILENAME),
            'firstTs' => $mtime,
            'lastTs' => $mtime,
            'source' => $source,
            'prompts' => $prompts,
            'turns' => $turns,
        ]);
    }
}
