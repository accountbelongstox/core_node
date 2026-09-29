<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Delivery;

use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1OrchAudio\AppQyV1OrchAudioCtl;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DeliveryBatchService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DeliveryDiffService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1ResourceIndexService;
use App\Http\Controllers\Controller;
use App\Support\LaravelServerIdentity;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * Pycore delivery (machine/worker trust level): server identity, Laravel-side
 * inventory diff and batch upload of small audio items.
 */
class AppQyV1DeliveryCtl extends Controller
{
    use ApiResponse;

    private const ERROR_VALIDATION_FAILED = 'DELIVERY_VALIDATION_FAILED';
    private const ERROR_KIND_UNSUPPORTED = 'DELIVERY_KIND_UNSUPPORTED';
    private const ERROR_BATCH_TOO_LARGE = 'DELIVERY_BATCH_TOO_LARGE';
    private const KEY_MAX_LENGTH = 512;
    private const TEXT_MAX_LENGTH = 16000;

    public function __construct(
        private readonly AppQyV1DeliveryDiffService $diffService,
        private readonly AppQyV1DeliveryBatchService $batchService,
        private readonly AppQyV1ResourceIndexService $resourceIndex
    ) {
    }

    public function info(): JsonResponse
    {
        return $this->success([
            'server_id' => LaravelServerIdentity::id(),
            'kinds' => AppQyV1DeliveryDiffService::kinds(),
            'limits' => [
                'diff' => AppQyV1DeliveryDiffService::ITEM_LIMITS,
                'batch' => [
                    'kinds' => AppQyV1DeliveryBatchService::KINDS,
                    'items' => AppQyV1DeliveryBatchService::MAX_ITEMS,
                    'item_bytes' => AppQyV1DeliveryBatchService::MAX_ITEM_BYTES,
                    'total_bytes' => AppQyV1DeliveryBatchService::MAX_TOTAL_BYTES,
                ],
            ],
            'index' => $this->resourceIndex->status(),
        ], __('delivery.info_loaded'));
    }

    public function diff(Request $request): JsonResponse
    {
        $kind = (string) $request->input('kind', '');
        $rules = [];
        $validator = null;

        if (!in_array($kind, AppQyV1DeliveryDiffService::kinds(), true)) {
            return $this->deliveryError(self::ERROR_KIND_UNSUPPORTED, 422);
        }
        $rules = match ($kind) {
            AppQyV1ResourceIndexService::KIND_ARTICLE => [
                'items.*.sha256' => ['nullable', 'string', 'regex:/^[a-fA-F0-9]{64}$/'],
            ],
            AppQyV1ResourceIndexService::KIND_STATIC_FILE => [
                'items.*.bytes' => ['nullable', 'integer', 'min:0'],
            ],
            AppQyV1DeliveryDiffService::KIND_ORCH_OUTPUT => [
                'items.*.key' => ['required', 'string', 'max:128'],
                'items.*.meta_hash' => ['required', 'string', 'max:128'],
                'items.*.segments' => ['nullable', 'array', 'max:' . AppQyV1OrchAudioCtl::SEGMENT_LIMIT],
                'items.*.segments.*.index' => ['required', 'integer', 'min:0'],
                'items.*.segments.*.sha256' => AppQyV1OrchAudioCtl::SHA256_RULE,
            ],
            default => [],
        } + [
            'machine_id' => AppQyV1OrchAudioCtl::MACHINE_ID_RULE,
            'items' => ['required', 'array', 'min:1', 'max:' . AppQyV1DeliveryDiffService::ITEM_LIMITS[$kind]],
            'items.*.key' => ['required', 'string', 'max:' . self::KEY_MAX_LENGTH],
            'session_id' => ['nullable', 'string', 'max:128'],
            'chunk_index' => ['nullable', 'integer', 'min:0'],
            'chunk_count' => ['nullable', 'integer', 'min:0'],
        ];
        $validator = Validator::make($request->all(), $rules);
        if ($validator->fails()) {
            return $this->validationFailed($validator->errors()->toArray());
        }

        return $this->success(
            $this->diffService->diff((string) $request->input('machine_id'), $kind, $request->input('items')) + array_filter([
                'session_id' => $request->input('session_id'),
                'chunk_index' => $request->input('chunk_index'),
                'chunk_count' => $request->input('chunk_count'),
            ], static fn ($value): bool => $value !== null),
            __('delivery.diff_computed')
        );
    }

    public function registerBatch(Request $request): JsonResponse
    {
        $kind = (string) $request->input('kind', '');
        $validator = null;
        $items = [];
        $invalidKeys = [];

        if (!in_array($kind, AppQyV1DeliveryBatchService::KINDS, true)) {
            return $this->deliveryError(self::ERROR_KIND_UNSUPPORTED, 422);
        }
        $validator = Validator::make($request->all(), [
            'machine_id' => AppQyV1OrchAudioCtl::MACHINE_ID_RULE,
            'items' => ['required', 'array', 'min:1', 'max:' . AppQyV1DeliveryBatchService::MAX_ITEMS],
            'items.*.key' => ['required', 'string', 'max:' . self::KEY_MAX_LENGTH],
            'items.*.sha256' => AppQyV1OrchAudioCtl::SHA256_RULE,
            'items.*.bytes' => ['required', 'integer', 'min:' . AppQyV1DeliveryBatchService::MIN_ITEM_BYTES],
            'items.*.text' => ['nullable', 'string', 'max:' . self::TEXT_MAX_LENGTH],
            'items.*.provider' => ['nullable', 'string', 'max:64'],
            'items.*.cleaned_word' => ['nullable', 'string', 'max:255'],
        ]);
        if ($validator->fails()) {
            return $this->validationFailed($validator->errors()->toArray());
        }
        $items = $request->input('items');
        foreach ($items as $position => $item) {
            if (AppQyV1ResourceIndexService::parseMediaKey((string) $item['key']) === null) {
                $invalidKeys['items.' . $position . '.key'] = [__('delivery.invalid_key')];
            }
        }
        if ($invalidKeys !== []) {
            return $this->validationFailed($invalidKeys);
        }
        if (max(array_map(static fn (array $item): int => (int) $item['bytes'], $items)) > AppQyV1DeliveryBatchService::MAX_ITEM_BYTES
            || array_sum(array_map(static fn (array $item): int => (int) $item['bytes'], $items)) > AppQyV1DeliveryBatchService::MAX_TOTAL_BYTES) {
            return $this->deliveryError(self::ERROR_BATCH_TOO_LARGE, 422);
        }

        return $this->success(
            $this->batchService->register((string) $request->input('machine_id'), $kind, $items),
            __('delivery.batch_registered')
        );
    }

    /** offset-v1: fields in the query string, raw chunk in the body. */
    public function batchContent(Request $request, string $batchId): JsonResponse
    {
        $validator = Validator::make($request->query(), [
            'machine_id' => AppQyV1OrchAudioCtl::MACHINE_ID_RULE,
            'upload_protocol' => ['required', 'string', 'in:offset-v1'],
            'upload_offset' => ['required', 'integer', 'min:0'],
            'upload_length' => ['required', 'integer', 'min:' . AppQyV1DeliveryBatchService::MIN_ITEM_BYTES],
            'audio_sha256' => AppQyV1OrchAudioCtl::SHA256_RULE,
            'chunk_sha256' => AppQyV1OrchAudioCtl::SHA256_RULE,
        ]);
        $result = [];

        if ($validator->fails()) {
            return $this->validationFailed($validator->errors()->toArray());
        }
        $result = $this->batchService->receiveContent(
            (string) $request->query('machine_id'),
            $batchId,
            (string) $request->getContent(),
            (int) $request->query('upload_offset'),
            (int) $request->query('upload_length'),
            strtolower((string) $request->query('audio_sha256')),
            strtolower((string) $request->query('chunk_sha256'))
        );
        if (isset($result['error_code'])) {
            return $this->deliveryError($result['error_code'], (int) $result['http']);
        }

        return $this->success($result['data'], __('delivery.batch_content_received'));
    }

    public function batchStatus(Request $request, string $batchId): JsonResponse
    {
        $validator = Validator::make($request->query(), [
            'machine_id' => AppQyV1OrchAudioCtl::MACHINE_ID_RULE,
        ]);
        $status = null;

        if ($validator->fails()) {
            return $this->validationFailed($validator->errors()->toArray());
        }
        $status = $this->batchService->status((string) $request->query('machine_id'), $batchId);
        if ($status === null) {
            return $this->deliveryError(AppQyV1DeliveryBatchService::ERROR_BATCH_NOT_FOUND, 404);
        }

        return $this->success($status, __('delivery.batch_status_loaded'));
    }

    private function validationFailed(array $errors): JsonResponse
    {
        return $this->deliveryError(self::ERROR_VALIDATION_FAILED, 422, ['errors' => $errors]);
    }

    private function deliveryError(string $errorCode, int $httpCode, ?array $details = null): JsonResponse
    {
        return $this->codedError($errorCode, __('delivery.' . strtolower($errorCode)), $details, $httpCode);
    }
}
