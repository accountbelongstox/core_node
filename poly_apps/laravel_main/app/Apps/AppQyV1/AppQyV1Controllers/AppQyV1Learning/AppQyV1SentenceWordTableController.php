<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Learning;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1SentenceWordTableService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Validator;

class AppQyV1SentenceWordTableController extends Controller
{
    private AppQyV1SentenceWordTableService $service;

    public function __construct(AppQyV1SentenceWordTableService $service)
    {
        $this->service = $service;
    }

    public function resolve(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'sentence' => 'required|string|max:10000',
            'language' => 'required|string|max:16',
            'target_language' => 'nullable|string|max:16',
            'client_key' => 'required|string|max:64',
            'max_read_count' => 'nullable|integer|min:0|max:100',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => $validator->errors()->first()], 422);
        }

        $rows = $this->service->resolve(
            (string) $request->input('sentence'),
            (string) $request->input('language'),
            $request->input('target_language'),
            (string) $request->input('client_key'),
            $request->user('sanctum')?->id,
            (int) $request->input('max_read_count', 0)
        );
        return response()->json(['success' => true, 'data' => ['words' => $rows]]);
    }

    public function markPlayed(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'words' => 'required|array|max:400',
            'words.*' => 'required|string|max:255',
            'language' => 'required|string|max:16',
            'client_key' => 'required|string|max:64',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => $validator->errors()->first()], 422);
        }

        $count = $this->service->markPlayed(
            $request->input('words'),
            (string) $request->input('language'),
            (string) $request->input('client_key'),
            $request->user('sanctum')?->id
        );
        return response()->json(['success' => true, 'data' => ['updated' => $count]]);
    }
}
