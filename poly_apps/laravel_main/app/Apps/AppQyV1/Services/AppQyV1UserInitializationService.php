<?php

namespace App\Apps\AppQyV1\Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserInitializationModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1LanguageStudyGroupService;
use App\Models\User;

class AppQyV1UserInitializationService
{
    private array $supportedLanguages;

    public function __construct()
    {
        $this->supportedLanguages = AppQyV1TableMaps::getSupportedLanguages();
    }

    public function getStatus(User $user): array
    {
        $profile = AppQyV1UserInitializationModel::query()
            ->where('user_id', $user->id)
            ->first();

        $learningLanguages = $this->normalizeLearningLanguages($user->learning_languages ?? []);
        $missingFields = $this->determineMissingFields($profile, $learningLanguages);
        $isInitialized = empty($missingFields) && $profile && $profile->is_initialized;
        $completedAt = $profile?->initialization_completed_at;

        return [
            'is_initialized' => $isInitialized,
            'missing_fields' => $missingFields,
            'initialization_completed_at' => $completedAt ? $completedAt->toIso8601String() : null,
            'learning_languages' => $learningLanguages,
            'profile' => $profile ? [
                'occupation' => $profile->occupation,
                'daily_words_target' => $profile->daily_words_target,
                'daily_study_time' => $profile->daily_study_time,
                'preferences' => $profile->preferences ?? [],
            ] : null,
        ];
    }

    public function updateInitialization(User $user, array $payload): array
    {
        $learningLanguages = $this->normalizeLearningLanguages($payload['learning_languages']);
        $user->learning_languages = $learningLanguages;
        if (isset($payload['native_language'])) {
            $user->native_language = $payload['native_language'];
        }
        $user->save();
        AppQyV1LanguageStudyGroupService::ensureLanguageGroupsExist(
            (int) $user->id,
            $learningLanguages
        );

        $profile = AppQyV1UserInitializationModel::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'occupation' => $payload['occupation'],
                'daily_words_target' => $payload['daily_words_target'],
                'daily_study_time' => $payload['daily_study_time'],
                'preferences' => $payload['preferences'],
                'is_initialized' => true,
                'initialization_completed_at' => now(),
            ]
        );

        $freshUser = $user->fresh();

        return [
            'user' => $freshUser,
            'profile' => $profile->fresh(),
            'status' => $this->getStatus($freshUser),
        ];
    }

    private function normalizeLearningLanguages(mixed $value): array
    {
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $value = $decoded;
            }
        }

        if (!is_array($value)) {
            $value = [];
        }

        $value = array_filter(array_map(fn ($code) => strtolower(trim($code)), $value));
        $value = array_values(array_unique(array_filter($value, function ($code) {
            return in_array($code, $this->supportedLanguages, true);
        })));

        return $value;
    }

    private function determineMissingFields(?AppQyV1UserInitializationModel $profile, array $learningLanguages): array
    {
        $missing = [];

        if (empty($learningLanguages)) {
            $missing[] = 'learning_languages';
        }
        if (!$profile || !$profile->occupation) {
            $missing[] = 'occupation';
        }
        if (!$profile || !$profile->daily_words_target) {
            $missing[] = 'daily_words_target';
        }
        if (!$profile || !$profile->daily_study_time) {
            $missing[] = 'daily_study_time';
        }
        if (!$profile || empty($profile->preferences)) {
            $missing[] = 'preferences';
        }

        return array_values(array_unique($missing));
    }
}
