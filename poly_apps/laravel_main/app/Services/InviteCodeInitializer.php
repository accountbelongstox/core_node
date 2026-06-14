<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use App\Models\InviteCode;

class InviteCodeInitializer
{
    public static function ensureTablesExist(): array
    {
        $connection = config('database.default');
        $results = [];

        try {
            // Shared helper for both tables: create-if-missing + auto-ALTER add any
            // column/index/FK added later in code, idempotently (add-only; FK adds are
            // existence-checked so they apply on the align pass without duplication;
            // never drops/rewrites existing rows).
            $inviteCodes = SafeMigrationHelper::alignTableStructureFromArray(
                $connection,
                'invite_codes',
                [
                    'columns' => [
                        'id'          => ['type' => 'bigIncrements'],
                        'code'        => ['type' => 'string', 'length' => 32, 'unique' => true],
                        'type'        => ['type' => 'string', 'default' => 'user', 'index' => true],
                        'max_uses'    => ['type' => 'integer', 'default' => 1],
                        'used_count'  => ['type' => 'integer', 'default' => 0],
                        'expires_at'  => ['type' => 'timestamp', 'nullable' => true],
                        'is_active'   => ['type' => 'boolean', 'default' => true, 'index' => true],
                        'created_by'  => ['type' => 'unsignedBigInteger', 'nullable' => true],
                        'description' => ['type' => 'text', 'nullable' => true],
                        'created_at'  => ['type' => 'timestamp', 'nullable' => true],
                        'updated_at'  => ['type' => 'timestamp', 'nullable' => true],
                    ],
                    'foreignKeys' => [
                        ['column' => 'created_by', 'references' => 'users', 'on' => 'id', 'onDelete' => 'set null'],
                    ],
                ],
                ['shrink_columns' => false, 'modify_columns' => false, 'add_indexes' => true]
            );
            $s = $inviteCodes['status'] ?? 'error';
            $results['invite_codes'] = $s === 'aligned' ? 'exists' : $s;

            $usage = SafeMigrationHelper::alignTableStructureFromArray(
                $connection,
                'invite_code_usage',
                [
                    'columns' => [
                        'id'             => ['type' => 'bigIncrements'],
                        'invite_code_id' => ['type' => 'unsignedBigInteger'],
                        'user_id'        => ['type' => 'unsignedBigInteger'],
                        'device_id'      => ['type' => 'string', 'nullable' => true],
                        'used_at'        => ['type' => 'timestamp'],
                        'ip_address'     => ['type' => 'ipAddress', 'nullable' => true],
                        'user_agent'     => ['type' => 'text', 'nullable' => true],
                        'created_at'     => ['type' => 'timestamp', 'nullable' => true],
                        'updated_at'     => ['type' => 'timestamp', 'nullable' => true],
                    ],
                    'indexes' => [
                        ['columns' => ['invite_code_id', 'user_id']],
                        ['columns' => ['used_at']],
                    ],
                    'foreignKeys' => [
                        ['column' => 'invite_code_id', 'references' => 'invite_codes', 'on' => 'id', 'onDelete' => 'cascade'],
                        ['column' => 'user_id', 'references' => 'users', 'on' => 'id', 'onDelete' => 'cascade'],
                    ],
                ],
                ['shrink_columns' => false, 'modify_columns' => false, 'add_indexes' => true]
            );
            $s = $usage['status'] ?? 'error';
            $results['invite_code_usage'] = $s === 'aligned' ? 'exists' : $s;

            // Use model connection for query builder (Laravel best practice)
            $inviteCodeModel = new InviteCode();
            $inviteCodeModel->setConnection($connection);
            $dbConnection = $inviteCodeModel->getConnection();
            
            $existingCodes = $dbConnection->table('invite_codes')->count();
            if ($existingCodes === 0) {
                $adminCode = 'ADMIN_' . strtoupper(Str::random(20));
                $superCode = 'SUPER_' . strtoupper(Str::random(20));

                $dbConnection->table('invite_codes')->insert([
                    [
                        'code' => $adminCode,
                        'type' => 'admin',
                        'max_uses' => 10,
                        'used_count' => 0,
                        'expires_at' => now()->addYears(10),
                        'is_active' => true,
                        'description' => 'Default admin invite code (generated at installation)',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ],
                    [
                        'code' => $superCode,
                        'type' => 'super_admin',
                        'max_uses' => 1,
                        'used_count' => 0,
                        'expires_at' => null,
                        'is_active' => true,
                        'description' => 'Super admin invite code (unlimited time, single use)',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]
                ]);

                $results['default_codes'] = 'created';
                $results['codes'] = [
                    'admin' => $adminCode,
                    'super_admin' => $superCode
                ];

                Log::info('[InviteCodeInitializer] Default invite codes created', [
                    'admin_code' => $adminCode,
                    'super_code' => $superCode
                ]);
            } else {
                $results['default_codes'] = 'exists';
                $codes = $dbConnection->table('invite_codes')
                    ->select('code', 'type')
                    ->whereIn('type', ['admin', 'super_admin'])
                    ->get();

                $results['codes'] = [];
                foreach ($codes as $code) {
                    $results['codes'][$code->type] = $code->code;
                }
            }

        } catch (\Exception $e) {
            $results['error'] = $e->getMessage();
            Log::error('[InviteCodeInitializer] Error initializing tables', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
        }

        return $results;
    }

    public static function getTableStats(): array
    {
        $connection = config('database.default');

        try {
            // Use model connection for query builder (Laravel best practice)
            $inviteCodeModel = new InviteCode();
            $inviteCodeModel->setConnection($connection);
            $dbConnection = $inviteCodeModel->getConnection();
            
            $stats = [
                'invite_codes' => [
                    'total' => $dbConnection->table('invite_codes')->count(),
                    'active' => $dbConnection->table('invite_codes')->where('is_active', true)->count(),
                    'inactive' => $dbConnection->table('invite_codes')->where('is_active', false)->count(),
                    // Grouped aggregate has no native form; COUNT(*) is cross-DB safe
                    // (identical on sqlite and pgsql).
                    'by_type' => $dbConnection->table('invite_codes')
                        ->groupBy('type')
                        ->selectRaw('type, COUNT(*) as count')
                        ->get()
                        ->pluck('count', 'type')
                        ->toArray()
                ],
                'invite_code_usage' => [
                    'total' => $dbConnection->table('invite_code_usage')->count(),
                ]
            ];

            return $stats;
        } catch (\Exception $e) {
            return ['error' => $e->getMessage()];
        }
    }
}
