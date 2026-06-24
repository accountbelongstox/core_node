<?php

namespace App\Services\DeveloperHistory\Extractors;

/**
 * Gemini CLI extractor (best-effort; layout from upstream knowledge,
 * not byte-verified on this machine).
 *
 *   <home>/.gemini/tmp/<project-hash>/logs.json   JSON array of message objects
 *
 * Each element: {sessionId, messageId, type:'user'|'gemini'|'model', message, timestamp}.
 * No first-class sub-agent concept.
 */
class GeminiExtractor extends AbstractExtractor
{
    public function tool(): string
    {
        return 'gemini';
    }

    public function extract(string $home, string $user): array
    {
        $tmp = $home . '/.gemini/tmp';
        if (!is_dir($tmp)) {
            return [];
        }
        $sessions = [];

        foreach (glob($tmp . '/*', GLOB_ONLYDIR) ?: [] as $projectDir) {
            $logs = $projectDir . '/logs.json';
            if (!is_file($logs)) {
                continue;
            }
            $rows = $this->loadJson($logs);
            if (!is_array($rows)) {
                continue;
            }
            foreach ($this->groupBySession($rows, $user, $logs) as $sess) {
                $sessions[] = $sess;
            }
        }

        return $sessions;
    }

    private function groupBySession(array $rows, string $user, string $source): array
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
            $out[] = [
                'tool' => $this->tool(),
                'os_user' => $user,
                'raw_id' => $sid,
                'project' => basename(dirname($source)),
                'title' => '',
                'started_ts' => $first,
                'started_at' => $first > 0 ? date('Y-m-d H:i:s', $first) : '',
                'ended_at' => $last > 0 ? date('Y-m-d H:i:s', $last) : '',
                'prompt_count' => count($prompts),
                'message_count' => count($turns),
                'has_subagent' => false,
                'models' => [],
                'source_path' => $source,
                'source_mtime' => (int) @filemtime($source),
                'bytes' => (int) @filesize($source),
                'prompts' => $prompts,
                'turns' => $turns,
            ];
        }
        return $out;
    }
}
