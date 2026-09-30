<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Learning;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DailyReadingVirtualProgressService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1SentenceWordTableService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1VirtualReadBatchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Validator;

class AppQyV1SentenceWordTableController extends Controller
{
    private AppQyV1SentenceWordTableService $service;

    private AppQyV1DailyReadingVirtualProgressService $virtualProgress;

    private AppQyV1VirtualReadBatchService $virtualBatches;

    public function __construct(
        AppQyV1SentenceWordTableService $service,
        AppQyV1DailyReadingVirtualProgressService $virtualProgress,
        AppQyV1VirtualReadBatchService $virtualBatches
    ) {
        $this->service = $service;
        $this->virtualProgress = $virtualProgress;
        $this->virtualBatches = $virtualBatches;
    }

    public function resolve(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'sentence' => 'required|string|max:10000',
            'language' => 'required|string|max:16',
            'target_language' => 'nullable|string|max:16',
            'client_key' => 'required|string|max:64',
            'max_read_count' => 'nullable|integer|min:0|max:100',
            'group_id' => 'nullable|string|max:64',
            'include_media' => 'nullable|boolean',
            'virtual_batch' => 'nullable|string|max:64',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => $validator->errors()->first()], 422);
        }

        $userId = $request->user('sanctum')?->id;
        $rows = $this->service->resolve(
            (string) $request->input('sentence'),
            (string) $request->input('language'),
            $request->input('target_language'),
            (string) $request->input('client_key'),
            $request->user('sanctum')?->id,
            (int) $request->input('max_read_count', 0),
            $request->input('group_id'),
            $request->boolean('include_media', true)
        );
        if ($userId === null || !$request->filled('virtual_batch')) {
            return response()->json(['success' => true, 'data' => ['words' => $rows]]);
        }

        // Virtual read overlay (read only, never consumed): the same projection
        // the daily-reading player uses - effective read count = group read
        // count + the batch's virtual read count (virtual_read_count per row).
        $selection = $this->virtualProgress->select(
            (int) $userId,
            (string) $request->input('virtual_batch'),
            (string) $request->input('language'),
            $rows,
            (int) $request->input('max_read_count', 0),
            static fn (array $projectedRows): array => $projectedRows,
            false
        );

        $this->virtualBatches->touch((int) $userId, (string) $request->input('virtual_batch'), (string) $request->input('language'));

        return response()->json(['success' => true, 'data' => [
            'words' => $selection['selected_words'],
            'virtual_read_batch' => $selection['batch'],
        ]]);
    }

    public function markPlayed(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'words' => 'required|array|max:400',
            'words.*' => 'required|string|max:255',
            'language' => 'required|string|max:16',
            'client_key' => 'required|string|max:64',
            'group_id' => 'nullable|string|max:64',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => $validator->errors()->first()], 422);
        }

        $count = $this->service->markPlayed(
            $request->input('words'),
            (string) $request->input('language'),
            (string) $request->input('client_key'),
            $request->user('sanctum')?->id,
            $request->input('group_id')
        );
        return response()->json(['success' => true, 'data' => ['updated' => $count]]);
    }
}
