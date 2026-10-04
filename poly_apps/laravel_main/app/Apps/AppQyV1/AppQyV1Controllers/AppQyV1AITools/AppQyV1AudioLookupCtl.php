<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1AudioBundleService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1AudioGateway;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * POST /api/app_qy_v1/ai_tools/tts/audio/lookup (contract endpoint audio_lookup)
 * Body: { items: [{ kind: word|sentence, language, text }] }, the clip-bundle
 * item shape, at most the contract's bundle item limit.
 *
 * Read-only audio URL lookup: no queue write, no head move, no task. Each
 * result keeps the input order and does not echo the request item (index = id):
 * { ready, url, content_id? (sentence), md5? (word), version? }. `version` (the
 * content version of the file a bundle would carry, with that file's url, see
 * AppQyV1AudioBundleService::served) is only computed when the body sets
 * with_version, for clients checking held clips.
 */
class AppQyV1AudioLookupCtl extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly AppQyV1AudioGateway $gateway,
        private readonly AppQyV1AudioBundleService $bundles = new AppQyV1AudioBundleService(),
    ) {
    }

    public function lookup(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1|max:' . AppQyV1AudioBundleService::maxItems(),
            'items.*.kind' => 'required|string|in:' . AppQyV1AudioBundleService::KIND_WORD . ',' . AppQyV1AudioBundleService::KIND_SENTENCE,
            'items.*.language' => 'required|string|max:20',
            'items.*.text' => 'required|string',
            'with_version' => 'sometimes|boolean',
        ]);
        $items = [];
        $words = [];
        $sentences = [];
        $results = [];

        if ($validator->fails()) {
            return $this->validationError($validator->errors(), $validator->errors()->first());
        }
        $items = array_values($validator->validated()['items']);
        foreach ($items as $index => $item) {
            if ($item['kind'] === AppQyV1AudioBundleService::KIND_WORD) {
                $words[$index] = ['word' => $item['text'], 'language' => $item['language']];
            } else {
                $sentences[$index] = ['text' => $item['text'], 'language' => $item['language']];
            }
        }
        foreach (array_combine(array_keys($words), $words === [] ? [] : $this->gateway->resolveWordsPassive(array_values($words))) as $index => $resolved) {
            $results[$index] = [
                'md5' => $resolved['md5'] ?? null,
                'ready' => ($resolved['audio_url'] ?? null) !== null,
                'url' => $resolved['audio_url'] ?? null,
            ];
        }
        foreach ($sentences === [] ? [] : $this->gateway->resolveSentencesPassive($sentences) as $index => $resolved) {
            $results[$index] = [
                'content_id' => $resolved['content_id'] ?? null,
                'ready' => (bool) ($resolved['exists'] ?? false),
                'url' => $resolved['url'] ?? null,
            ];
        }

        $served = ($validator->validated()['with_version'] ?? false) ? $this->bundles->served($items) : null;

        return $this->success([
            'results' => array_map(
                static function (int $index) use ($results, $served): array {
                    $result = $results[$index] ?? ['ready' => false, 'url' => null];
                    if ($served === null) {
                        return $result;
                    }

                    // The URL of the file a bundle would carry (a quality variant), with its content version.
                    return array_merge($result, [
                        'url' => $served[$index]['url'] ?? $result['url'],
                        'version' => $served[$index]['version'] ?? null,
                    ]);
                },
                array_keys($items)
            ),
        ], __('app_qy_v1.messages.audio_lookup_completed'));
    }
}
