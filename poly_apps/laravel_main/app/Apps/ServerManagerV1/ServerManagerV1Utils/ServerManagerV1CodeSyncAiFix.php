<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use App\Providers\PathMapper;
use App\Services\AiGateway\AiGateway;
use App\Support\ServiceContract;

/**
 * Resolves the server repository's merge conflicts with the built-in AI (code_sync.ai_fix_provider).
 *
 * Safety rules (approved by the user): only files git reports as unmerged are changed; a backup ref
 * (code_sync.ai_fix_backup_ref_prefix + job id) is written before anything changes; every AI answer
 * is validated (no conflict markers, php -l for .php, JSON parse for .json) and any failure aborts
 * the merge (git merge --abort) so the repository is exactly as before; nothing is force-pushed and
 * nothing from the prompt is executed - the prompt is only text for the AI. With no merge in progress
 * and no conflicts the call is a no-op ('nothing_to_fix').
 */
class ServerManagerV1CodeSyncAiFix
{
    private const RESULT_NOTHING = 'nothing_to_fix';
    private const RESULT_MERGE_COMMITTED = 'merge_committed';
    private const RESULT_RESOLVED = 'resolved';
    private const RESULT_FAILED = 'failed';
    private const MERGE_HEAD_REF = 'MERGE_HEAD';
    private const PHP_EXTENSION = 'php';
    private const JSON_EXTENSION = 'json';
    private const MARKER_PATTERN = '/^(<{7} |={7}$|>{7} )/m';
    private const FENCE_PATTERN = '/^```[\w-]*\R(.*)\R```\s*$/s';
    private const SOURCE = 'server_manager.code_sync.ai_fix';
    private const SYSTEM_PROMPT = 'You resolve git merge conflicts. Answer with ONLY the complete resolved file content: '
        .'no explanations, no code fences, no conflict markers. Keep every change from both sides unless they truly '
        .'contradict; then follow the operator instruction.';

    /**
     * @return array{result: string, files: array<int, array<string, mixed>>, backup_ref?: string, error?: string}
     */
    public static function resolve(string $jobId, string $prompt): array
    {
        $repoDir = rtrim((string) PathMapper::getCoreNodeDir(), '/');
        $mergeInProgress = ServerManagerV1CodeSyncJob::git(['rev-parse', '-q', '--verify', self::MERGE_HEAD_REF])['success'];
        $paths = self::conflictedPaths();
        $backupRef = ServiceContract::string('code_sync.ai_fix_backup_ref_prefix').$jobId;
        $resolved = [];
        $report = [];

        if (!$mergeInProgress && $paths === []) {
            return ['result' => self::RESULT_NOTHING, 'files' => []];
        }
        if (!ServerManagerV1CodeSyncJob::git(['update-ref', $backupRef, 'HEAD'])['success']) {
            return ['result' => self::RESULT_FAILED, 'files' => [], 'error' => 'backup_ref_failed'];
        }
        if ($paths === []) {
            $commit = ServerManagerV1CodeSyncJob::git(['commit', '--no-edit']);

            return $commit['success']
                ? ['result' => self::RESULT_MERGE_COMMITTED, 'files' => [], 'backup_ref' => $backupRef]
                : self::abort($backupRef, [], 'merge_commit_failed');
        }
        if (count($paths) > ServiceContract::positiveInt('code_sync.ai_fix_max_files')) {
            return self::abort($backupRef, [], 'too_many_conflicts');
        }

        foreach ($paths as $path) {
            $absolute = self::insideRepo($repoDir, $path);
            $content = $absolute === null ? false : @file_get_contents($absolute);
            if ($content === false || strlen($content) > ServiceContract::positiveInt('code_sync.ai_fix_max_file_bytes')) {
                $report[] = ['path' => $path, 'ok' => false, 'error' => $content === false ? 'unreadable' : 'too_large'];

                return self::abort($backupRef, $report, 'file_rejected');
            }
            $answer = self::askAi($prompt, $path, $content);
            $error = $answer['error'] ?? self::validate($path, (string) ($answer['text'] ?? ''));
            $report[] = ['path' => $path, 'ok' => $error === null, 'error' => $error, 'bytes' => strlen((string) ($answer['text'] ?? ''))];
            if ($error !== null) {
                return self::abort($backupRef, $report, 'validation_failed');
            }
            $resolved[$absolute] = $answer['text'];
        }

        foreach ($resolved as $absolute => $text) {
            if (@file_put_contents($absolute, $text) === false) {
                return self::abort($backupRef, $report, 'write_failed');
            }
        }
        if (!ServerManagerV1CodeSyncJob::git(array_merge(['add', '--'], $paths))['success']
            || !ServerManagerV1CodeSyncJob::git(['commit', '--no-edit'])['success']) {
            return self::abort($backupRef, $report, 'commit_failed');
        }

        return ['result' => self::RESULT_RESOLVED, 'files' => $report, 'backup_ref' => $backupRef];
    }

    /** @return array<int, string> repository-relative unmerged paths */
    private static function conflictedPaths(): array
    {
        $diff = ServerManagerV1CodeSyncJob::git(['diff', '--name-only', '--diff-filter=U', '-z']);

        return $diff['success'] ? array_values(array_filter(explode("\0", (string) $diff['output']), 'strlen')) : [];
    }

    private static function insideRepo(string $repoDir, string $path): ?string
    {
        $absolute = realpath($repoDir.'/'.$path);
        $root = realpath($repoDir);

        return $absolute !== false && $root !== false && str_starts_with($absolute, $root.'/') && is_file($absolute) ? $absolute : null;
    }

    /** @return array{text?: string, error?: string} */
    private static function askAi(string $prompt, string $path, string $content): array
    {
        $instruction = mb_substr(trim($prompt), 0, ServiceContract::positiveInt('code_sync.ai_fix_prompt_max_chars'));
        $result = AiGateway::chatWith(
            ServiceContract::string('code_sync.ai_fix_provider'),
            "Operator instruction: {$instruction}\n\nFile: {$path}\n\n{$content}",
            null,
            self::SYSTEM_PROMPT,
            self::SOURCE,
            ServiceContract::positiveInt('code_sync.ai_fix_timeout_seconds')
        );
        if (empty($result['success'])) {
            return ['error' => 'ai_failed: '.(string) ($result['error'] ?? 'unknown')];
        }
        $text = (string) ($result['text'] ?? '');
        if (preg_match(self::FENCE_PATTERN, trim($text), $matches) === 1) {
            $text = $matches[1]."\n";
        }

        return ['text' => $text];
    }

    /** Null when the answer is acceptable, else the reason. */
    private static function validate(string $path, string $text): ?string
    {
        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $temp = '';
        $lint = [];

        if (trim($text) === '') {
            return 'empty_answer';
        }
        if (preg_match(self::MARKER_PATTERN, $text) === 1) {
            return 'conflict_markers_left';
        }
        if ($extension === self::JSON_EXTENSION) {
            json_decode($text);

            return json_last_error() === JSON_ERROR_NONE ? null : 'invalid_json';
        }
        if ($extension === self::PHP_EXTENSION) {
            $temp = tempnam(sys_get_temp_dir(), 'code-sync-ai-fix-');
            if ($temp === false || @file_put_contents($temp, $text) === false) {
                return 'lint_unavailable';
            }
            $lint = ServerManagerV1Utils::executeCommand(ServerManagerV1FrankenPhpReloadJob::phpCliBinary(), ['-l', $temp], 30);
            @unlink($temp);

            return $lint['success'] ? null : 'php_lint_failed';
        }

        return null;
    }

    /** Restores the repository (git merge --abort) and reports the failure. */
    private static function abort(string $backupRef, array $report, string $error): array
    {
        $abort = ServerManagerV1CodeSyncJob::git(['merge', '--abort']);

        return [
            'result' => self::RESULT_FAILED,
            'files' => $report,
            'backup_ref' => $backupRef,
            'error' => $error,
            'merge_aborted' => $abort['success'],
        ];
    }
}
