<?php

namespace App\Services\DataSync;

final class DataSyncStepCatalog
{
    public const SOURCE_STEPS = [
        'validate_request',
        'discover_source_databases',
        'discover_resource_roots',
        'build_source_resource_manifests',
        'normalize_peer_address',
        'probe_peer_health',
        'negotiate_protocol',
        'create_receiver_session',
        'wait_receiver_lock',
        'discover_receiver_databases',
        'validate_database_compatibility',
        'wait_receiver_backup',
        'record_receiver_backup_directory',
        'initialize_database_checkpoints',
        'transfer_database_chunks',
        'apply_database_differences',
        'verify_database_counts',
        'verify_database_digests',
        'fetch_receiver_resource_manifests',
        'calculate_resource_differences',
        'prepare_resource_batches',
        'initialize_resource_checkpoints',
        'transfer_resource_chunks',
        'verify_resource_manifests',
        'finalize_receiver_session',
        'complete',
    ];

    public const RECEIVER_STEPS = [
        'discover_receiver_databases',
        'backup_receiver_databases',
        'record_backup_directory',
        'ready_for_transfer',
        'receive_database_chunks',
        'apply_database_differences',
        'receive_resource_chunks',
        'verify_resource_payloads',
        'apply_resource_payloads',
        'verify_received_data',
        'finalize_receiver_session',
        'complete',
    ];

    public static function create(string $role): array
    {
        $keys = $role === 'receiver' ? self::RECEIVER_STEPS : self::SOURCE_STEPS;
        $steps = [];

        foreach ($keys as $index => $key) {
            $steps[] = [
                'index' => $index + 1,
                'key' => $key,
                'status' => 'pending',
                'started_at' => null,
                'completed_at' => null,
                'detail' => null,
            ];
        }

        return $steps;
    }
}
