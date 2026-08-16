<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\DingDuoDuoV1\DingDuoDuoV1Models;

/**
 * DingDuoDuoV1 (订多多) device: one row per extension install (device_id), with
 * the bound member (nullable) and the last-seen heartbeat timestamp.
 */
class DingDuoDuoV1DeviceModel extends DingDuoDuoV1Model
{
    protected ?string $appTableMapKey = 'DEVICES';

    protected $fillable = [
        'device_id',
        'member_id',
        'last_seen_at',
        'info',
    ];

    protected $casts = [
        'member_id' => 'integer',
        'last_seen_at' => 'datetime',
        'info' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public static function findOrNewByDeviceId(string $deviceId): self
    {
        return static::query()->firstOrNew(['device_id' => $deviceId]);
    }
}
