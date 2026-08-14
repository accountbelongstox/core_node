<?php

namespace App\Apps\McpV1\McpV1Models;

use App\Apps\McpV1\McpV1TablesMaps\McpV1TablesMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Models\Model;
use Illuminate\Support\Facades\Schema;

class McpV1VoiceSubtitleUserSettingsModel extends Model
{
    protected $guarded = [];
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->connection = AppTablePrefixServiceProvider::getConnection(AppKeys::MCPV1);
        $this->table = McpV1TablesMaps::VOICE_SUBTITLE_USER_SETTINGS_TABLE;
    }

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
