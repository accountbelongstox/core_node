<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ClientDeviceSettingsModel;
use App\Apps\AppQyV1\Services\AppQyV1ClientDeviceSettingsTableService;

class AppQyV1ClientDeviceSettingsService
{
    private static bool $tablesEnsured = false;

    private function ensureTables(): void
    {
        if (self::$tablesEnsured) {
            return;
        }
        AppQyV1ClientDeviceSettingsTableService::ensureTablesExist();
        self::$tablesEnsured = true;
    }

    public function getByClientKey(string $clientKey): ?array
    {
        $this->ensureTables();

        $row = AppQyV1ClientDeviceSettingsModel::findByClientKey($clientKey);

        if (!$row) {
            return null;
        }

        return $this->toPayload($row);
    }

    public function saveForClientKey(string $clientKey, array $payload): array
    {
        $this->ensureTables();

        $row = AppQyV1ClientDeviceSettingsModel::findOrNewByClientKey($clientKey);

        $current = is_array($row->settings) ? $row->settings : [];
        $merged = $this->mergeSettings($current, $payload);
        $row->settings = $merged;
        $row->saveRecord();

        return $this->toPayload($row);
    }

    private function mergeSettings(array $current, array $incoming): array
    {
        $merged = $current;

        if (array_key_exists('reader', $incoming) && is_array($incoming['reader'])) {
            $existingReader = is_array($merged['reader'] ?? null) ? $merged['reader'] : [];
            $merged['reader'] = array_merge($existingReader, $incoming['reader']);
        }

        if (array_key_exists('updated_at', $incoming)) {
            $merged['updated_at'] = $incoming['updated_at'];
        }

        return $merged;
    }

    private function toPayload(AppQyV1ClientDeviceSettingsModel $row): array
    {
        $settings = is_array($row->settings) ? $row->settings : [];

        return [
            'client_key' => $row->client_key,
            'reader' => $settings['reader'] ?? null,
            'updated_at' => $settings['updated_at'] ?? $row->updated_at?->toIso8601String(),
        ];
    }
}
