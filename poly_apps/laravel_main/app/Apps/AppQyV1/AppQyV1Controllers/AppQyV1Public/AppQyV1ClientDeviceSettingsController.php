<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Support\Facades\Validator;
use App\Traits\ApiResponse;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1ClientDeviceSettingsService;

class AppQyV1ClientDeviceSettingsController extends BaseController
{
    use ApiResponse;

    public function __construct(
        private readonly AppQyV1ClientDeviceSettingsService $settingsService,
    ) {
    }

    public function get(Request $request): JsonResponse
    {
        $clientKey = trim((string) $request->query('client_key', ''));
        if (!$this->isValidClientKey($clientKey)) {
            return $this->error('Invalid client_key', 422);
        }

        $settings = $this->settingsService->getByClientKey($clientKey);

        return $this->success(
            ['settings' => $settings],
            'Client device settings retrieved'
        );
    }

    public function save(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'client_key' => 'required|string|min:16|max:64|regex:/^[a-zA-Z0-9_-]+$/',
            'reader' => 'nullable|array',
            'reader.readerSimul' => 'nullable|boolean',
            'reader.readerLangs' => 'nullable|array',
            'reader.readerLangs.*' => 'string|max:10',
            'reader.readerDisplayMode' => 'nullable|string|in:stacked,interleaved',
            'reader.readerPlaySequence' => 'nullable|array',
            'reader.readerPlaySequence.*.lang' => 'required_with:reader.readerPlaySequence|string|max:10',
            'reader.readerPlaySequence.*.repeat' => 'required_with:reader.readerPlaySequence|integer|min:1|max:10',
            'reader.readerSpeedByLang' => 'nullable|array',
            'reader.readerAutoAdvance' => 'nullable|boolean',
            'reader.readerRepeatOne' => 'nullable|boolean',
            'reader.readerAutoPlayOnOpen' => 'nullable|boolean',
            'reader.readerBrowserTts' => 'nullable|boolean',
            'reader.readerVariantByLang' => 'nullable|array',
            'updated_at' => 'nullable|string|max:40',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed: ' . $validator->errors()->first(), 422);
        }

        $validated = $validator->validated();
        $clientKey = $validated['client_key'];
        $payload = [];
        if (array_key_exists('reader', $validated)) {
            $payload['reader'] = $validated['reader'];
        }
        if (array_key_exists('updated_at', $validated)) {
            $payload['updated_at'] = $validated['updated_at'];
        }

        $saved = $this->settingsService->saveForClientKey($clientKey, $payload);

        return $this->success(['settings' => $saved], 'Client device settings saved');
    }

    private function isValidClientKey(string $clientKey): bool
    {
        if ($clientKey === '') {
            return false;
        }
        if (strlen($clientKey) < 16 || strlen($clientKey) > 64) {
            return false;
        }

        return (bool) preg_match('/^[a-zA-Z0-9_-]+$/', $clientKey);
    }
}
