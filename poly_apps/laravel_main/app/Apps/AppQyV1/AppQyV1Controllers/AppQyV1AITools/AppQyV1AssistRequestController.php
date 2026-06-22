<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools;

use App\Http\Controllers\Controller;
use App\Models\AppQyV1AssistRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

/**
 * Record-scoped assist requests (CoreBook §6).
 *
 * A thin record-scoped request layer on top of the worker-pull assist pool. A
 * human (Task Center modal) or pycore (partial CoreBook submit) files the exact
 * missing pieces for ONE record; the existing assist/global-task workers claim
 * and finish them by request_type.
 *
 * Routes (routes/AppQyV1Router/AppQyV1Assist.php, nested under assist/requests):
 *   GET    /api/app_qy_v1/assist/requests          index (filters)
 *   POST   /api/app_qy_v1/assist/requests          create (idempotent upsert)
 *   POST   /api/app_qy_v1/assist/requests/claim    worker lease
 *   POST   /api/app_qy_v1/assist/requests/submit   report result
 *   POST   /api/app_qy_v1/assist/requests/release  release lease(s)
 *   DELETE /api/app_qy_v1/assist/requests/{id}      remove a request
 *
 * Trust level: NO-AUTH, identical to the existing assist pool surface — pycore
 * is a server-side caller without a user token.
 */
class AppQyV1AssistRequestController extends Controller
{
    private const REQUEST_TYPES = ['add_language', 'fill_audio', 'cover', 'poster'];
    private const RECORD_TYPES = ['book', 'subtitle'];

    /**
     * GET /api/app_qy_v1/assist/requests
     * Query: record_type?, source_key?, status?, request_type?, per_page? (1..200)
     * Response: { success, items, total, per_page, current_page, last_page }
     */
    public function index(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'record_type' => 'nullable|string|in:book,subtitle',
            'source_key' => 'nullable|string|max:64',
            'status' => 'nullable|string|in:pending,claimed,processing,completed,failed',
            'request_type' => 'nullable|string|in:add_language,fill_audio,cover,poster',
            'per_page' => 'nullable|integer|min:1|max:200',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed: ' . $validator->errors()->first(),
            ], 422);
        }

        $query = AppQyV1AssistRequest::query();

        if ($request->filled('record_type')) {
            $query->where('record_type', $request->input('record_type'));
        }
        if ($request->filled('source_key')) {
            $query->where('source_key', $request->input('source_key'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('request_type')) {
            $query->where('request_type', $request->input('request_type'));
        }

        $perPage = (int) $request->input('per_page', 50);
        $page = $query->orderByDesc('priority')
            ->orderByDesc('id')
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'items' => $page->items(),
            'total' => $page->total(),
            'per_page' => $page->perPage(),
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
        ]);
    }

    /**
     * POST /api/app_qy_v1/assist/requests
     * Body: { record_type, source_key, priority?,
     *         items: [{ request_type, language?, payload? }] }
     * Idempotent upsert via the unique (record_type, source_key, request_type,
     * language) key.
     * Response: { success, created, existing, items }
     */
    public function create(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'record_type' => 'required|string|in:book,subtitle',
            'source_key' => 'required|string|min:1|max:64',
            'priority' => 'nullable|integer',
            'items' => 'required|array|min:1',
            'items.*.request_type' => 'required|string|in:add_language,fill_audio,cover,poster',
            'items.*.language' => 'nullable|string|max:20',
            'items.*.payload' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed: ' . $validator->errors()->first(),
            ], 422);
        }

        $recordType = $request->input('record_type');
        $sourceKey = trim((string) $request->input('source_key'));
        $priority = (int) $request->input('priority', 0);
        $items = $request->input('items');

        $created = 0;
        $existing = 0;
        $rows = [];

        try {
            foreach ($items as $item) {
                $requestType = $item['request_type'];
                // cover/poster are record-level, never language-scoped.
                $language = in_array($requestType, ['cover', 'poster'], true)
                    ? null
                    : (isset($item['language']) && $item['language'] !== '' ? (string) $item['language'] : null);
                $payload = $item['payload'] ?? null;

                $row = AppQyV1AssistRequest::query()
                    ->where('record_type', $recordType)
                    ->where('source_key', $sourceKey)
                    ->where('request_type', $requestType)
                    ->where(function ($q) use ($language) {
                        $language === null ? $q->whereNull('language') : $q->where('language', $language);
                    })
                    ->first();

                if ($row) {
                    // Idempotent: re-filing the same gap leaves a live row alone
                    // but re-queues a previously failed one.
                    if ($row->status === AppQyV1AssistRequest::STATUS_FAILED) {
                        $row->status = AppQyV1AssistRequest::STATUS_PENDING;
                        $row->error = null;
                        $row->claimed_at = null;
                        $row->claimed_by = null;
                        if ($payload !== null) {
                            $row->payload = $payload;
                        }
                        $row->save();
                    }
                    $existing++;
                    $rows[] = $row;
                    continue;
                }

                $row = AppQyV1AssistRequest::create([
                    'record_type' => $recordType,
                    'source_key' => $sourceKey,
                    'request_type' => $requestType,
                    'language' => $language,
                    'status' => AppQyV1AssistRequest::STATUS_PENDING,
                    'priority' => $priority,
                    'payload' => $payload,
                ]);
                $created++;
                $rows[] = $row;
            }
        } catch (\Throwable $e) {
            Log::error('[AssistRequest] create failed', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => 'Internal error during create'], 500);
        }

        return response()->json([
            'success' => true,
            'created' => $created,
            'existing' => $existing,
            'items' => $rows,
        ]);
    }

    /**
     * POST /api/app_qy_v1/assist/requests/claim
     * Body: { types: request_type[], limit? 1..10 = 3, claimer }
     * Atomically leases up to $limit pending rows (60-minute lease).
     * Response: { success, items, lease_minutes }
     */
    public function claim(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'types' => 'required|array|min:1',
            'types.*' => 'string|in:add_language,fill_audio,cover,poster',
            'limit' => 'nullable|integer|min:1|max:10',
            'claimer' => 'required|string|min:1|max:64',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed: ' . $validator->errors()->first(),
            ], 422);
        }

        $types = array_values(array_unique($request->input('types')));
        $limit = max(1, min(10, (int) $request->input('limit', 3)));
        $claimer = trim((string) $request->input('claimer'));

        $items = [];
        try {
            $probe = new AppQyV1AssistRequest();
            $items = $probe->getConnection()->transaction(function () use ($types, $limit, $claimer) {
                $leaseFloor = now()->subMinutes(AppQyV1AssistRequest::LEASE_MINUTES);

                $rows = AppQyV1AssistRequest::query()
                    ->whereIn('request_type', $types)
                    ->where('status', AppQyV1AssistRequest::STATUS_PENDING)
                    ->where(function ($q) use ($leaseFloor) {
                        $q->whereNull('claimed_at')
                            ->orWhere('claimed_at', '<', $leaseFloor);
                    })
                    ->orderByDesc('priority')
                    ->orderBy('id')
                    ->limit($limit)
                    ->lockForUpdate()
                    ->get();

                $claimed = [];
                foreach ($rows as $row) {
                    $row->claim($claimer);
                    $claimed[] = $row;
                }
                return $claimed;
            }, 1);
        } catch (\Throwable $e) {
            Log::error('[AssistRequest] claim failed', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => 'Internal error during claim'], 500);
        }

        return response()->json([
            'success' => true,
            'items' => $items,
            'lease_minutes' => AppQyV1AssistRequest::LEASE_MINUTES,
        ]);
    }

    /**
     * POST /api/app_qy_v1/assist/requests/submit
     * Body: { id, status: 'completed'|'failed'|'processing', result?, error? }
     * Idempotent: an already-completed row is acknowledged without rewriting.
     * Response: { ok, status, already_done?, error? }
     */
    public function submit(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'id' => 'required|integer|min:1',
            'status' => 'required|string|in:completed,failed,processing',
            'result' => 'nullable|array',
            'error' => 'nullable|string|max:2000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'ok' => false,
                'status' => 'invalid',
                'error' => 'Validation failed: ' . $validator->errors()->first(),
            ], 422);
        }

        $id = (int) $request->input('id');
        $status = $request->input('status');

        try {
            $row = AppQyV1AssistRequest::query()->find($id);
            if (!$row) {
                return response()->json(['ok' => false, 'status' => 'not_found', 'error' => 'Request not found'], 404);
            }

            // Fill-missing, never clobber: already completed -> ack only.
            if ($row->status === AppQyV1AssistRequest::STATUS_COMPLETED) {
                return response()->json(['ok' => true, 'status' => 'completed', 'already_done' => true]);
            }

            if ($status === 'completed') {
                $row->complete($request->input('result'));
            } elseif ($status === 'failed') {
                $row->fail($request->input('error'));
            } else {
                $row->markProcessing();
            }
        } catch (\Throwable $e) {
            Log::error('[AssistRequest] submit failed', ['id' => $id, 'error' => $e->getMessage()]);
            return response()->json(['ok' => false, 'status' => 'error', 'error' => 'Internal error during submit'], 500);
        }

        return response()->json(['ok' => true, 'status' => $row->status]);
    }

    /**
     * POST /api/app_qy_v1/assist/requests/release
     * Body: { ids: int[], error? }
     * Releases leased rows back to pending.
     * Response: { success, released }
     */
    public function release(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|min:1',
            'error' => 'nullable|string|max:2000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed: ' . $validator->errors()->first(),
            ], 422);
        }

        $ids = array_values(array_filter(array_map('intval', $request->input('ids')), static fn ($id) => $id > 0));
        $error = $request->input('error');

        $released = 0;
        try {
            $rows = AppQyV1AssistRequest::query()
                ->whereIn('id', $ids)
                ->whereIn('status', [AppQyV1AssistRequest::STATUS_CLAIMED, AppQyV1AssistRequest::STATUS_PROCESSING])
                ->get();

            foreach ($rows as $row) {
                $row->release($error);
                $released++;
            }
        } catch (\Throwable $e) {
            Log::error('[AssistRequest] release failed', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => 'Internal error during release'], 500);
        }

        return response()->json([
            'success' => true,
            'released' => $released,
        ]);
    }

    /**
     * DELETE /api/app_qy_v1/assist/requests/{id}
     * Response: { success, deleted }
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $id = (int) $id;
        if ($id <= 0) {
            return response()->json(['success' => false, 'error' => 'Invalid id'], 422);
        }

        try {
            $deleted = AppQyV1AssistRequest::query()->where('id', $id)->delete();
        } catch (\Throwable $e) {
            Log::error('[AssistRequest] destroy failed', ['id' => $id, 'error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => 'Internal error during delete'], 500);
        }

        return response()->json([
            'success' => true,
            'deleted' => (int) $deleted,
        ]);
    }
}
