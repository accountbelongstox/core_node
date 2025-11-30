<?php

namespace App\Apps\McpV1\VoiceSubtitleV1\VoiceSubtitleV1Utils;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class UserSettingsManager
{
    private array $tableColumns = [];
    private array $supportedLanguageCodes = [];

    public function getUserSettings(string $userIdentifier): array
    {
        $settings = DB::connection('mcpv1')->table('voice_subtitle_user_settings')
            ->where('user_identifier', $userIdentifier)
            ->first();

        if (!$settings) {
            return $this->createDefaultSettings($userIdentifier);
        }

        $targetLanguage = $settings->target_language;
        if (is_string($targetLanguage)) {
            $decoded = json_decode($targetLanguage, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $targetLanguage = $decoded;
            }
        }

        $targetLanguage = $this->normalizeTargetLanguages($targetLanguage);

        $playGroup = property_exists($settings, 'play_group') ? $settings->play_group : null;
        $playLanguage = property_exists($settings, 'play_language') ? $settings->play_language : null;

        return [
            'user_identifier' => $settings->user_identifier,
            'target_language' => $targetLanguage,
            'default_voice' => $settings->default_voice,
            'playback_rate' => (float) $settings->playback_rate,
            'auto_play' => (bool) $settings->auto_play,
            'play_mode' => $settings->play_mode ?? 'all',
            'play_limit' => (int) ($settings->play_limit ?? 300),
            'play_group' => $playGroup,
            'play_language' => $playLanguage,
        ];
    }

    public function updateUserSettings(string $userIdentifier, array $data): array
    {
        $allFields = ['target_language', 'default_voice', 'playback_rate', 'auto_play', 'play_mode', 'play_limit', 'play_group', 'play_language'];
        $allowedFields = $this->filterAvailableColumns($allFields);
        $updateData = array_intersect_key($data, array_flip($allowedFields));

        if (empty($updateData)) {
            return [
                'success' => true,
                'message' => 'No fields from request match current schema',
                'settings' => $this->getUserSettings($userIdentifier),
            ];
        }

        if (isset($updateData['target_language'])) {
            $normalized = $this->normalizeTargetLanguages($updateData['target_language']);
            $updateData['target_language'] = json_encode($normalized, JSON_UNESCAPED_UNICODE);
        }

        if ($this->hasColumn('updated_at')) {
            $updateData['updated_at'] = now();
        }

        $exists = DB::connection('mcpv1')->table('voice_subtitle_user_settings')
            ->where('user_identifier', $userIdentifier)
            ->exists();

        if ($exists) {
            DB::connection('mcpv1')->table('voice_subtitle_user_settings')
                ->where('user_identifier', $userIdentifier)
                ->update($updateData);
        } else {
            if ($this->hasColumn('user_identifier')) {
                $updateData['user_identifier'] = $userIdentifier;
            }
            if ($this->hasColumn('created_at')) {
                $updateData['created_at'] = now();
            }
            DB::connection('mcpv1')->table('voice_subtitle_user_settings')->insert($updateData);
        }

        return [
            'success' => true,
            'settings' => $this->getUserSettings($userIdentifier),
        ];
    }

    private function createDefaultSettings(string $userIdentifier): array
    {
        $defaultSettings = [
            'user_identifier' => $userIdentifier,
            'target_language' => json_encode(['en'], JSON_UNESCAPED_UNICODE),
            'default_voice' => 'en-US-AriaNeural',
            'playback_rate' => 1.0,
            'auto_play' => false,
            'play_mode' => 'all',
            'play_limit' => 300,
            'play_group' => null,
            'play_language' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ];

        $dbSettings = $this->filterColumns($defaultSettings);
        if (!empty($dbSettings)) {
            DB::connection('mcpv1')->table('voice_subtitle_user_settings')->insert($dbSettings);
        }

        Log::info('[UserSettingsManager] Created default settings', [
            'user' => $userIdentifier,
        ]);

        return [
            'user_identifier' => $defaultSettings['user_identifier'],
            'target_language' => ['en'],
            'default_voice' => $defaultSettings['default_voice'],
            'playback_rate' => $defaultSettings['playback_rate'],
            'auto_play' => $defaultSettings['auto_play'],
            'play_mode' => $defaultSettings['play_mode'],
            'play_limit' => $defaultSettings['play_limit'],
            'play_group' => $defaultSettings['play_group'],
            'play_language' => $defaultSettings['play_language'],
        ];
    }

    public function getSupportedLanguages(): array
    {
        $allLanguages = \App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1System\AppQyV1SupportedLanguagesController::getSupportedLanguagesStatic();

        $excludedCodes = ['zh', 'wuu', 'yue'];

        $languages = [];
        foreach ($allLanguages as $code => $info) {
            if (!in_array($code, $excludedCodes)) {
                $languages[] = [
                    'code' => $code,
                    'name' => $info['name'],
                    'native_name' => $info['native_name'],
                    'voice_id' => $info['voice_id'],
                ];
            }
        }

        return $languages;
    }

    private function ensureTableColumns(): void
    {
        if (!empty($this->tableColumns)) {
            return;
        }

        try {
            $this->tableColumns = Schema::connection('mcpv1')->getColumnListing('voice_subtitle_user_settings');
        } catch (\Throwable $e) {
            Log::error('[UserSettingsManager] Failed to fetch column listing', [
                'error' => $e->getMessage(),
            ]);
            $this->tableColumns = [];
        }
    }

    private function hasColumn(string $column): bool
    {
        $this->ensureTableColumns();
        return in_array($column, $this->tableColumns, true);
    }

    private function filterAvailableColumns(array $columns): array
    {
        $this->ensureTableColumns();
        return array_values(array_intersect($columns, $this->tableColumns));
    }

    private function filterColumns(array $data): array
    {
        $this->ensureTableColumns();
        if (empty($this->tableColumns)) {
            return [];
        }

        return array_intersect_key($data, array_flip($this->tableColumns));
    }

    private function normalizeTargetLanguages(mixed $languages): array
    {
        if (is_string($languages)) {
            $decoded = json_decode($languages, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $languages = $decoded;
            } else {
                $languages = [$languages];
            }
        }

        if (!is_array($languages)) {
            $languages = [];
        }

        $languages = array_map(function ($code) {
            return strtolower(trim((string) $code));
        }, $languages);

        $languages = array_filter($languages, function ($code) {
            return $code !== '';
        });

        $allowed = $this->getAllowedLanguageCodes();
        $filtered = array_values(array_unique(array_filter($languages, function ($code) use ($allowed) {
            return in_array($code, $allowed, true);
        })));

        if (empty($filtered)) {
            $filtered = ['en'];
        }

        return $filtered;
    }

    private function getAllowedLanguageCodes(): array
    {
        if (!empty($this->supportedLanguageCodes)) {
            return $this->supportedLanguageCodes;
        }

        $languages = $this->getSupportedLanguages();
        $codes = array_map(function ($language) {
            return strtolower($language['code']);
        }, $languages);

        if (!in_array('en', $codes, true)) {
            $codes[] = 'en';
        }

        $this->supportedLanguageCodes = array_values(array_unique($codes));

        return $this->supportedLanguageCodes;
    }
}
