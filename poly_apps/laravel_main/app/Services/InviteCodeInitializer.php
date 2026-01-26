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
            if (!Schema::connection($connection)->hasTable('invite_codes')) {
                Schema::connection($connection)->create('invite_codes', function ($table) {
                    $table->id();
                    $table->string('code', 32)->unique();
                    $table->string('type')->default('user');
                    $table->integer('max_uses')->default(1);
                    $table->integer('used_count')->default(0);
                    $table->timestamp('expires_at')->nullable();
                    $table->boolean('is_active')->default(true);
                    $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
                    $table->text('description')->nullable();
                    $table->timestamps();

                    $table->index('code');
                    $table->index('is_active');
                    $table->index('type');
                });

                $results['invite_codes'] = 'created';
                Log::info('[InviteCodeInitializer] Created invite_codes table');
            } else {
                $results['invite_codes'] = 'exists';
            }

            if (!Schema::connection($connection)->hasTable('invite_code_usage')) {
                Schema::connection($connection)->create('invite_code_usage', function ($table) {
                    $table->id();
                    $table->foreignId('invite_code_id')->constrained('invite_codes')->onDelete('cascade');
                    $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
                    $table->string('device_id')->nullable();
                    $table->timestamp('used_at');
                    $table->ipAddress('ip_address')->nullable();
                    $table->text('user_agent')->nullable();
                    $table->timestamps();

                    $table->index(['invite_code_id', 'user_id']);
                    $table->index('used_at');
                });

                $results['invite_code_usage'] = 'created';
                Log::info('[InviteCodeInitializer] Created invite_code_usage table');
            } else {
                $results['invite_code_usage'] = 'exists';
            }

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
                    'by_type' => $dbConnection->table('invite_codes')
                        ->select('type', DB::raw('count(*) as count'))
                        ->groupBy('type')
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
