<?php

namespace App\Http\System;

use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1CodeSyncJob;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CodeSyncController extends Controller
{
    use ApiResponse;

    private const HTTP_ACCEPTED = 202;
    private const HTTP_NOT_FOUND = 404;
    private const HTTP_CONFLICT = 409;
    private const HTTP_UNPROCESSABLE = 422;
    private const HTTP_SERVER_ERROR = 500;
    private const JOB_ID_RULE = 'nullable|string|regex:/^\d{14}-[a-f0-9]{12}$/';

    public function start(): JsonResponse
    {
        $result = ServerManagerV1CodeSyncJob::start();

        if (!$result['success']) {
            return $this->error(
                __('code_sync.errors.'.$result['error_code']),
                $result['error_code'] === 'busy' ? self::HTTP_CONFLICT : self::HTTP_SERVER_ERROR
            );
        }

        return $this->success(
            $this->localized($result['job']) + ['already_running' => $result['already_running']],
            __($result['already_running'] ? 'code_sync.messages.already_running' : 'code_sync.messages.started'),
            self::HTTP_ACCEPTED
        );
    }

    public function status(Request $request): JsonResponse
    {
        $validated = $request->validate(['job_id' => self::JOB_ID_RULE]);
        $job = ServerManagerV1CodeSyncJob::status($validated['job_id'] ?? null);

        if ($job === null) {
            return $this->error(__('code_sync.errors.job_not_found'), self::HTTP_NOT_FOUND);
        }

        return $this->success($this->localized($job), __('code_sync.messages.status_retrieved'));
    }

    private function localized(array $job): array
    {
        if (isset($job['error_code'])) {
            $job['error'] = __('code_sync.errors.'.$job['error_code']);
        }

        return $job;
    }
}
