<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1User;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\Services\AppQyV1UserInitializationService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class AppQyV1UserInitializationController extends Controller
{
    private AppQyV1UserInitializationService $service;
    private array $allowedOccupations = [
        'student',
        'teacher',
        'engineer',
        'designer',
        'self_employed',
        'manager',
        'other',
    ];

    private array $allowedThemes = ['system', 'light', 'dark'];
    private array $allowedDifficultyLevels = ['beginner', 'intermediate', 'advanced'];
    private array $defaultPreferences = [
        'theme' => 'system',
        'notifications_enabled' => true,
        'auto_play_audio' => false,
        'difficulty_level' => 'beginner',
        'daily_reminder_time' => '08:00',
    ];

    public function __construct(AppQyV1UserInitializationService $service)
    {
        $this->service = $service;
    }

    public function status(Request $request): JsonResponse
    {
        $status = $this->service->getStatus($request->user());

        return response()->json([
            'success' => true,
            'data' => $status,
        ]);
    }

    public function initialize(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'learning_languages' => 'required|array|min:1|max:5',
            'learning_languages.*' => 'string|min:2|max:5',
            'native_language' => 'nullable|string|min:2|max:5',
            'occupation' => 'required|string|in:' . implode(',', $this->allowedOccupations),
            'daily_words_target' => 'required|integer|min:5|max:1000',
            'daily_study_time' => 'required|integer|min:5|max:600',
            'preferences' => 'required|array',
            'preferences.theme' => 'nullable|string|in:' . implode(',', $this->allowedThemes),
            'preferences.notifications_enabled' => 'nullable|boolean',
            'preferences.auto_play_audio' => 'nullable|boolean',
            'preferences.difficulty_level' => 'nullable|string|in:' . implode(',', $this->allowedDifficultyLevels),
            'preferences.daily_reminder_time' => 'nullable|string|max:10',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $payload = $validator->validated();
        $languageErrors = $this->validateLearningLanguages($payload['learning_languages']);

        if (!empty($languageErrors)) {
            return response()->json([
                'success' => false,
                'message' => 'Unsupported learning languages',
                'errors' => ['learning_languages' => $languageErrors],
            ], 422);
        }

        if (!empty($payload['native_language'])) {
            $native = strtolower($payload['native_language']);
            if (!in_array($native, AppQyV1TableMaps::getSupportedLanguages(), true)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unsupported native language',
                    'errors' => ['native_language' => ['Unsupported language code']],
                ], 422);
            }
            $payload['native_language'] = $native;
        }

        $payload['preferences'] = $this->mergePreferences($payload['preferences'] ?? []);

        try {
            $result = $this->service->updateInitialization($request->user(), $payload);

            return response()->json([
                'success' => true,
                'message' => 'Initialization completed successfully',
                'data' => $result['status'],
            ]);
        } catch (\Throwable $e) {
            Log::error('[AppQyV1UserInitialization] Failed to save initialization data', [
                'user_id' => $request->user()->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to save initialization data',
            ], 500);
        }
    }

    private function validateLearningLanguages(array $languages): array
    {
        $supported = AppQyV1TableMaps::getSupportedLanguages();
        $invalid = [];

        foreach ($languages as $code) {
            $code = strtolower(trim($code));
            if (!in_array($code, $supported, true)) {
                $invalid[] = $code;
            }
        }

        return array_values(array_unique($invalid));
    }

    private function mergePreferences(array $preferences): array
    {
        $filtered = array_intersect_key($preferences, $this->defaultPreferences);

        return array_merge($this->defaultPreferences, $filtered);
    }
}
