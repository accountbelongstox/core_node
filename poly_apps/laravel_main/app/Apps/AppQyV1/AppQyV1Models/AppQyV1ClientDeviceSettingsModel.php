<?php

namespace App\Apps\AppQyV1\AppQyV1Models;


class AppQyV1ClientDeviceSettingsModel extends AppQyV1Model
{

    protected $fillable = [
        'client_key',
        'settings',
    ];

    protected function casts(): array
    {
        return [
            'settings' => 'array',
        ];
    }

    protected ?string $appTableSuffix = 'client_device_settings';

    public static function findByClientKey(string $clientKey): ?self
    {
        return static::query()->where('client_key', $clientKey)->first();
    }

    public static function findOrNewByClientKey(string $clientKey): self
    {
        return static::query()->firstOrNew(['client_key' => $clientKey]);
    }
}
