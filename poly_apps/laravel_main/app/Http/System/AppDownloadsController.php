<?php

namespace App\Http\System;

use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1AppDownloadsStore;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1AppDownloadsSyncJob;
use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1AppDownloadsUpload;
use App\Http\Controllers\Controller;
use App\Support\ServiceContract;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AppDownloadsController extends Controller
{
    use ApiResponse;

    private const HTTP_ACCEPTED = 202;
    private const HTTP_NOT_FOUND = 404;
    private const HTTP_CONFLICT = 409;
    private const HTTP_UNPROCESSABLE = 422;
    private const HTTP_INSUFFICIENT_STORAGE = 507;
    private const HTTP_SERVER_ERROR = 500;
    private const RECENT_MAX = 20;
    private const JOB_ID_RULE = 'nullable|string|regex:/^\d{14}-[a-f0-9]{12}$/';
    private const CONFLICT_CODES = ['busy', 'offset_mismatch', 'upload_busy'];

    public function sync(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'app' => $this->appRule(),
            'source_base_urls' => 'required|array|min:1|max:'.ServiceContract::positiveInt('app_downloads.server_sync.max_sources'),
            'source_base_urls.*' => ['required', 'string', 'max:255', 'url:http,https'],
            'platforms' => 'nullable|array',
            'platforms.*' => 'string|max:16',
            'reload_caddy' => 'nullable|boolean',
        ]);
        $result = ServerManagerV1AppDownloadsSyncJob::start(
            $validated['app'],
            array_values(array_unique(array_map(static fn (string $url): string => rtrim($url, '/'), $validated['source_base_urls']))),
            $validated['platforms'] ?? null,
            (bool) ($validated['reload_caddy'] ?? false)
        );

        if (!$result['success']) {
            return $this->error(
                __('app_downloads.errors.'.$result['error_code']),
                $this->httpCode($result['error_code']),
                isset($result['job']) ? $this->localized($result['job']) : null
            );
        }

        return $this->success(
            $this->localized($result['job']) + ['already_running' => $result['already_running']],
            __($result['already_running'] ? 'app_downloads.messages.already_running' : 'app_downloads.messages.started'),
            self::HTTP_ACCEPTED
        );
    }

    public function status(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'job_id' => self::JOB_ID_RULE,
            'limit' => 'nullable|integer|min:1|max:'.self::RECENT_MAX,
        ]);
        $job = ServerManagerV1AppDownloadsSyncJob::status($validated['job_id'] ?? null);

        if (isset($validated['limit'])) {
            return $this->success(
                array_map(fn (array $recent): array => $this->localized($recent), ServerManagerV1AppDownloadsSyncJob::recent((int) $validated['limit'])),
                __('app_downloads.messages.status_retrieved')
            );
        }

        if ($job === null) {
            return $this->error(__('app_downloads.errors.job_not_found'), self::HTTP_NOT_FOUND);
        }

        return $this->success($this->localized($job), __('app_downloads.messages.status_retrieved'));
    }

    public function upload(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'app' => $this->appRule(),
            'file' => $this->fileRule(),
            'size' => 'required|integer|min:1|max:'.ServiceContract::positiveInt('app_downloads.server_sync.max_file_bytes'),
            'sha256' => ['required', 'string', 'regex:/^[A-Fa-f0-9]{64}$/'],
            'offset' => 'required|integer|min:0',
            'chunk_b64' => 'required|string',
            'chunk_sha256' => ['required', 'string', 'regex:/^[A-Fa-f0-9]{64}$/'],
        ]);
        $result = ServerManagerV1AppDownloadsUpload::chunk(
            $validated['app'],
            $validated['file'],
            (int) $validated['size'],
            $validated['sha256'],
            (int) $validated['offset'],
            $validated['chunk_b64'],
            $validated['chunk_sha256']
        );

        if (!$result['success']) {
            return $this->error(__('app_downloads.errors.'.$result['error_code']), $this->httpCode($result['error_code']), $result);
        }

        return $this->success($result, __($result['complete'] ? 'app_downloads.messages.upload_complete' : 'app_downloads.messages.chunk_stored'));
    }

    public function commit(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'app' => $this->appRule(),
            'manifest' => 'required|array',
            'platforms' => 'nullable|array',
            'platforms.*' => 'string|max:16',
        ]);
        $result = ServerManagerV1AppDownloadsUpload::commit($validated['app'], $validated['manifest'], $validated['platforms'] ?? null);

        if (!$result['success']) {
            return $this->error(__('app_downloads.errors.'.$result['error_code']), $this->httpCode($result['error_code']), $result);
        }

        return $this->success($result, __('app_downloads.messages.commit_done'));
    }

    private function appRule(): array
    {
        return ['required', 'string', 'regex:/'.ServiceContract::string('app_downloads.server_sync.app_id_pattern').'/'];
    }

    private function fileRule(): array
    {
        return [
            'required',
            'string',
            'regex:/'.ServiceContract::string('app_downloads.server_sync.file_name_pattern').'/',
            static function (string $attribute, mixed $value, \Closure $fail): void {
                if (!ServerManagerV1AppDownloadsStore::isValidFileName((string) $value)) {
                    $fail(__('app_downloads.errors.file_name_invalid'));
                }
            },
        ];
    }

    private function httpCode(string $errorCode): int
    {
        if (in_array($errorCode, self::CONFLICT_CODES, true)) {
            return self::HTTP_CONFLICT;
        }
        if ($errorCode === 'insufficient_disk') {
            return self::HTTP_INSUFFICIENT_STORAGE;
        }
        if (in_array($errorCode, ['files_missing', 'manifest_invalid', 'manifest_entry_invalid', 'manifest_empty', 'chunk_invalid', 'chunk_sha256_mismatch', 'upload_sha256_mismatch', 'file_too_large'], true)) {
            return self::HTTP_UNPROCESSABLE;
        }

        return self::HTTP_SERVER_ERROR;
    }

    private function localized(array $job): array
    {
        if (isset($job['error_code'])) {
            $job['error'] = __('app_downloads.errors.'.$job['error_code']);
        }

        return $job;
    }
}
