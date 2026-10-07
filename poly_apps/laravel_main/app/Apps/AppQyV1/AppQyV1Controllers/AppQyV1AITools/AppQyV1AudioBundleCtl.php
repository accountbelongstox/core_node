<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1AudioBundleService;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Validator;

/**
 * POST /api/app_qy_v1/ai_tools/tts/audio/bundle
 * Body: { items: [{ kind: word|sentence|phrase, language, text }] } (at most the
 * contract's laravel_bundle_max_items)
 *
 * Many clips in one binary response (clip bundle frame, see
 * AppQyV1AudioBundleService): a client moving tens of thousands of small clips
 * pays one request per bundle instead of one per file.
 */
class AppQyV1AudioBundleCtl extends Controller
{
    use ApiResponse;

    public function __construct(private readonly AppQyV1AudioBundleService $bundles)
    {
    }

    private function itemsValidator(Request $request): \Illuminate\Contracts\Validation\Validator
    {
        return Validator::make($request->all(), [
            'items' => 'required|array|min:1|max:' . AppQyV1AudioBundleService::maxItems(),
            'items.*.kind' => 'required|string|in:' . implode(',', AppQyV1AudioBundleService::KINDS),
            'items.*.language' => 'required|string|max:20',
            'items.*.text' => 'required|string',
        ]);
    }

    public function bundle(Request $request): Response|JsonResponse
    {
        $validator = $this->itemsValidator($request);
        if ($validator->fails()) {
            return $this->validationError($validator->errors(), 'Invalid clip bundle request: ' . $validator->errors()->first());
        }

        return response($this->bundles->build((array) $request->input('items')), 200, [
            'Content-Type' => AppQyV1AudioBundleService::mediaType(),
            'Cache-Control' => 'no-store',
        ]);
    }
}
