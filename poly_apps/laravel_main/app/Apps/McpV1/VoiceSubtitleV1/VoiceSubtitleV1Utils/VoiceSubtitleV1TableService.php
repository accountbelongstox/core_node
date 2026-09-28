<?php

namespace App\Apps\McpV1\VoiceSubtitleV1\VoiceSubtitleV1Utils;

use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Services\SafeMigrationHelper;

class VoiceSubtitleV1TableService
{
    public static function ensureTablesExist(): array
    {
        $appKey = AppKeys::MCPV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'user_settings');

        $result = SafeMigrationHelper::alignTableStructureFromArray(
            $connection,
            $tableName,
            [
                'columns' => [
                    'id'              => ['type' => 'bigIncrements'],
                    'user_identifier' => ['type' => 'string', 'length' => 100, 'unique' => true, 'index' => true],
                    'target_language' => ['type' => 'text', 'default' => '["en"]'],
                    'default_voice'   => ['type' => 'string', 'length' => 100, 'default' => 'en-US-AriaNeural'],
                    'playback_rate'   => ['type' => 'decimal', 'precision' => 3, 'scale' => 2, 'default' => 1.0],
                    'auto_play'       => ['type' => 'boolean', 'default' => false],
                    'play_mode'       => ['type' => 'string', 'length' => 50, 'default' => 'all'],
                    'play_limit'      => ['type' => 'integer', 'default' => 300],
                    'play_group'      => ['type' => 'string', 'length' => 100, 'nullable' => true],
                    'play_language'   => ['type' => 'string', 'length' => 50, 'nullable' => true],
                    'created_at'      => ['type' => 'timestamp', 'nullable' => true],
                    'updated_at'      => ['type' => 'timestamp', 'nullable' => true],
                ],
            ],
            ['shrink_columns' => false, 'modify_columns' => false, 'add_indexes' => true]
        );

        $status = $result['status'] ?? 'error';

        return [$tableName => in_array($status, ['aligned', 'updated'], true) ? 'exists' : $status];
    }
}
