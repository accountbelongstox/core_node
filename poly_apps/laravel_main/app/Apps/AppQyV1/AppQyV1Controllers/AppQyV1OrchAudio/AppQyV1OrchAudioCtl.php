<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1OrchAudio;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1OrchAudioService;
use App\Helpers\AuthHelper;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * Pycore audio-orchestration output: idempotent ingest (machine/worker trust
 * level) and the wordnew read API (Sanctum).
 */
class AppQyV1OrchAudioCtl extends Controller
{
    use ApiResponse;

    private const ERROR_VALIDATION_FAILED = 'ORCH_AUDIO_VALIDATION_FAILED';
    public const MACHINE_ID_RULE = ['required', 'string', 'regex:/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/'];
    public const SHA256_RULE = ['required', 'string', 'regex:/^[a-fA-F0-9]{64}$/'];
    private const INGEST_TASK_LIMIT = 50;
    private const SENTENCE_LIMIT = 5000;
    private const RESOURCE_LIMIT = 2000;
    public const SEGMENT_LIMIT = 2000;
    private const SOURCE_TEXT_LIMIT = 200000;
    private const LIST_PER_PAGE_DEFAULT = 20;
    private const LIST_PER_PAGE_MAX = 100;
    private const SENTENCE_PER_PAGE_DEFAULT = 200;
    private const SENTENCE_PER_PAGE_MAX = 500;

    private AppQyV1OrchAudioService $service;

    public function __construct(AppQyV1OrchAudioService $service)
    {
        $this->service = $service;
    }

    public function ingestTasks(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'machine_id' => self::MACHINE_ID_RULE,
            'tasks' => ['required', 'array', 'min:1', 'max:' . self::INGEST_TASK_LIMIT],
            'tasks.*.task_id' => ['required', 'string', 'max:128'],
            'tasks.*.meta_hash' => ['required', 'string', 'max:128'],
            'tasks.*.source' => ['required', 'string', 'max:32'],
            'tasks.*.status' => ['required', 'string', 'max:32'],
            'tasks.*.name' => ['nullable', 'string', 'max:1000'],
            'tasks.*.language' => ['nullable', 'string', 'max:20'],
            'tasks.*.source_ref' => ['nullable', 'array'],
            'tasks.*.pattern' => ['nullable', 'array'],
            'tasks.*.source_text' => ['nullable', 'string', 'max:' . self::SOURCE_TEXT_LIMIT],
            'tasks.*.sentences' => ['nullable', 'array', 'max:' . self::SENTENCE_LIMIT],
            'tasks.*.sentences.*.text' => ['required', 'string', 'max:16000'],
            'tasks.*.sentences.*.language' => ['nullable', 'string', 'max:20'],
            'tasks.*.sentences.*.seq' => ['nullable', 'integer'],
            'tasks.*.sentences.*.languages' => ['nullable', 'array'],
            'tasks.*.resources' => ['nullable', 'array', 'max:' . self::RESOURCE_LIMIT],
            'tasks.*.resources.*.kind' => ['required', 'string', 'in:word,sentence'],
            'tasks.*.resources.*.text' => ['required', 'string', 'max:16000'],
            'tasks.*.resources.*.language' => ['nullable', 'string', 'max:20'],
            'tasks.*.segments' => ['nullable', 'array', 'max:' . self::SEGMENT_LIMIT],
            'tasks.*.segments.*.index' => ['required', 'integer', 'min:0'],
            'tasks.*.segments.*.sha256' => self::SHA256_RULE,
            'tasks.*.segments.*.bytes' => ['nullable', 'integer', 'min:0'],
            'tasks.*.segments.*.duration_ms' => ['nullable', 'integer', 'min:0'],
            'tasks.*.segments.*.start' => ['nullable', 'integer'],
            'tasks.*.segments.*.end' => ['nullable', 'integer'],
            'tasks.*.segments.*.status' => ['nullable', 'string', 'max:32'],
            'tasks.*.segments.*.timeline' => ['nullable', 'array'],
            'tasks.*.segments.*.timeline.*.seq' => ['nullable', 'integer'],
            'tasks.*.segments.*.timeline.*.type' => ['required', 'string', 'in:word,sentence'],
            'tasks.*.segments.*.timeline.*.start_ms' => ['required', 'integer', 'min:0'],
            'tasks.*.segments.*.timeline.*.end_ms' => ['required', 'integer', 'min:0'],
        ]);
        if ($validator->fails()) {
            return $this->validationFailed($validator->errors()->toArray());
        }

        return $this->success(
            $this->service->ingestTasks((string) $request->input('machine_id'), $request->input('tasks')),
            __('audio_orchestration.orch_audio_tasks_ingested')
        );
    }

    /** offset-v1: fields in the query string, raw chunk in the body. */
    public function ingestSegmentAudio(Request $request): JsonResponse
    {
        $validator = Validator::make($request->query(), [
            'machine_id' => self::MACHINE_ID_RULE,
            'task_id' => ['required', 'string', 'max:128'],
            'index' => ['required', 'integer', 'min:0'],
            'upload_protocol' => ['required', 'string', 'in:offset-v1'],
            'upload_offset' => ['required', 'integer', 'min:0'],
            'upload_length' => ['required', 'integer', 'min:100'],
            'audio_sha256' => self::SHA256_RULE,
            'chunk_sha256' => self::SHA256_RULE,
        ]);
        if ($validator->fails()) {
            return $this->validationFailed($validator->errors()->toArray());
        }

        $result = $this->service->receiveSegmentChunk(
            (string) $request->query('machine_id'),
            (string) $request->query('task_id'),
            (int) $request->query('index'),
            (string) $request->getContent(),
            (int) $request->query('upload_offset'),
            (int) $request->query('upload_length'),
            strtolower((string) $request->query('audio_sha256')),
            strtolower((string) $request->query('chunk_sha256'))
        );
        if (isset($result['error_code'])) {
            return $this->serviceError($result['error_code'], (int) $result['http']);
        }

        return $this->success($result['data'], __('audio_orchestration.orch_audio_segment_received'));
    }

    public function index(Request $request): JsonResponse
    {
        $validator = null;
        $page = 1;
        $perPage = self::LIST_PER_PAGE_DEFAULT;

        if (AuthHelper::requireAuth($request) === null) {
            return $this->unauthorized();
        }
        $validator = Validator::make($request->query(), [
            'source' => ['nullable', 'string', 'max:32'],
            'q' => ['nullable', 'string', 'max:200'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:' . self::LIST_PER_PAGE_MAX],
        ]);
        if ($validator->fails()) {
            return $this->validationFailed($validator->errors()->toArray());
        }
        $page = (int) $request->query('page', 1);
        $perPage = (int) $request->query('per_page', self::LIST_PER_PAGE_DEFAULT);

        return $this->success($this->service->list(
            $request->filled('source') ? (string) $request->query('source') : null,
            $request->filled('q') ? trim((string) $request->query('q')) : null,
            $page,
            $perPage
        ), __('audio_orchestration.orch_audio_tasks_loaded'));
    }

    public function show(Request $request, string $taskKey): JsonResponse
    {
        $validator = null;
        $detail = null;

        if (AuthHelper::requireAuth($request) === null) {
            return $this->unauthorized();
        }
        $validator = Validator::make($request->query(), [
            'sentence_page' => ['nullable', 'integer', 'min:1'],
            'sentence_per_page' => ['nullable', 'integer', 'min:1', 'max:' . self::SENTENCE_PER_PAGE_MAX],
        ]);
        if ($validator->fails()) {
            return $this->validationFailed($validator->errors()->toArray());
        }

        $detail = $this->service->detail(
            $taskKey,
            (int) $request->query('sentence_page', 1),
            (int) $request->query('sentence_per_page', self::SENTENCE_PER_PAGE_DEFAULT)
        );
        if ($detail === null) {
            return $this->serviceError(AppQyV1OrchAudioService::ERROR_TASK_NOT_FOUND, 404);
        }

        return $this->success($detail, __('audio_orchestration.orch_audio_task_loaded'));
    }

    private function validationFailed(array $errors): JsonResponse
    {
        return $this->codedError(
            self::ERROR_VALIDATION_FAILED,
            __('audio_orchestration.orch_audio_validation_failed'),
            ['errors' => $errors],
            422
        );
    }

    private function serviceError(string $errorCode, int $httpCode): JsonResponse
    {
        return $this->codedError(
            $errorCode,
            __('audio_orchestration.' . strtolower($errorCode)),
            null,
            $httpCode
        );
    }
}
