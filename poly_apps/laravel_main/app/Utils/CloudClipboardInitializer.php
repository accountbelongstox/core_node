<?php

namespace App\Utils;

use App\Providers\GlobalTablesMap;
use App\Providers\PathMapper;
use App\Services\SafeMigrationHelper;
use App\Support\CloudClipboardContract;

final class CloudClipboardInitializer
{
    public const TABLE_KEYS = ['CLOUD_CLIPBOARD_ROOMS', 'CLOUD_CLIPBOARD_ENTRIES'];

    public static function ensureTablesExist(): array
    {
        $connection = GlobalTablesMap::getConnection();
        $results = [];
        $alignment = [];
        $directory = PathMapper::getLaravelUploadsDir(CloudClipboardContract::get('upload_subdirectory'));
        $directoryExists = FileSystemManager::isDir($directory);
        $options = ['shrink_columns' => false, 'modify_columns' => false, 'add_indexes' => true];
        $structures = [
            'CLOUD_CLIPBOARD_ROOMS' => [
                'columns' => [
                    'id' => ['type' => 'uuid'],
                    'namespace' => ['type' => 'string', 'length' => 40],
                    'password_hash' => ['type' => 'text', 'nullable' => true],
                    'topic_key' => ['type' => 'uuid'],
                    'current_entry_id' => ['type' => 'uuid'],
                    'revision' => ['type' => 'unsignedBigInteger', 'default' => 0],
                    'created_at' => ['type' => 'timestamp', 'nullable' => true],
                    'updated_at' => ['type' => 'timestamp', 'nullable' => true],
                ],
                'indexes' => [
                    ['columns' => ['id'], 'name' => 'clipboard_rooms_id_uq', 'unique' => true],
                    ['columns' => ['namespace'], 'name' => 'clipboard_rooms_namespace_uq', 'unique' => true],
                ],
            ],
            'CLOUD_CLIPBOARD_ENTRIES' => [
                'columns' => [
                    'id' => ['type' => 'uuid'],
                    'room_id' => ['type' => 'uuid'],
                    'text' => ['type' => 'text'],
                    'files' => ['type' => 'json'],
                    'revision' => ['type' => 'unsignedBigInteger', 'default' => 0],
                    'editor_user_id' => ['type' => 'unsignedBigInteger', 'nullable' => true],
                    'created_at' => ['type' => 'timestamp', 'nullable' => true],
                    'updated_at' => ['type' => 'timestamp', 'nullable' => true],
                ],
                'indexes' => [
                    ['columns' => ['id'], 'name' => 'clipboard_entries_id_uq', 'unique' => true],
                    ['columns' => ['room_id', 'created_at'], 'name' => 'clipboard_entries_room_created_idx'],
                ],
            ],
        ];

        foreach ($structures as $key => $structure) {
            $alignment = SafeMigrationHelper::alignTableStructureFromArray(
                $connection, GlobalTablesMap::getTableName($key), $structure, $options
            );
            if (!in_array($alignment['status'], ['created', 'updated', 'aligned'], true)) {
                throw new \RuntimeException(__('cloud_clipboard.initialization_failed', ['resource' => $key]));
            }
            $results[$key] = $alignment['status'] === 'aligned' ? 'exists' : $alignment['status'];
        }
        if (!FileSystemManager::ensureDirectoryExists($directory)) {
            throw new \RuntimeException(__('cloud_clipboard.initialization_failed', ['resource' => $directory]));
        }
        $results['uploads'] = $directoryExists ? 'exists' : 'created';

        return $results;
    }
}
