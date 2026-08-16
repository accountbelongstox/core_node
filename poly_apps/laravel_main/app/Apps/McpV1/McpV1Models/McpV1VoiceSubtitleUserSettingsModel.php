<?php

namespace App\Apps\McpV1\McpV1Models;

use App\Apps\McpV1\McpV1TablesMaps\McpV1TablesMaps;
use Illuminate\Support\Facades\Schema;

class McpV1VoiceSubtitleUserSettingsModel extends McpV1Model
{
    protected $guarded = [];
    protected $table = McpV1TablesMaps::VOICE_SUBTITLE_USER_SETTINGS_TABLE;

    public static function findForUser(string $userIdentifier): ?self
    {
        return self::query()->where('user_identifier', $userIdentifier)->first();
    }

    public static function saveForUser(string $userIdentifier, array $attributes): self
    {
        return self::query()->updateOrCreate(['user_identifier' => $userIdentifier], $attributes);
    }

    public static function availableColumns(): array
    {
        $model = new static();

        return Schema::connection($model->getConnectionName())->getColumnListing($model->getTable());
    }
}
