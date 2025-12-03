<?php

// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never create or update documentation (*.md).
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'bio')) {
                $table->string('bio')->nullable();
            }
            if (!Schema::hasColumn('users', 'location')) {
                $table->string('location')->nullable();
            }
            if (!Schema::hasColumn('users', 'avatar')) {
                $table->string('avatar')->nullable();
            }
            if (!Schema::hasColumn('users', 'last_login_at')) {
                $table->timestamp('last_login_at')->nullable();
            }
            if (!Schema::hasColumn('users', 'phone_verified_at')) {
                $table->timestamp('phone_verified_at')->nullable();
            }
            if (!Schema::hasColumn('users', 'email_verified_at')) {
                $table->timestamp('email_verified_at')->nullable();
            }
            if (!Schema::hasColumn('users', 'password_reset_token')) {
                $table->string('password_reset_token')->nullable();
            }
            if (!Schema::hasColumn('users', 'password_reset_expires_at')) {
                $table->timestamp('password_reset_expires_at')->nullable();
            }
            if (!Schema::hasColumn('users', 'status')) {
                $table->string('status')->default('active');
            }
            if (!Schema::hasColumn('users', 'is_online')) {
                $table->boolean('is_online')->default(false);
            }
            if (!Schema::hasColumn('users', 'last_seen_at')) {
                $table->timestamp('last_seen_at')->nullable();
            }
        });

        try {
            Schema::table('users', function (Blueprint $table) {
                $table->index('status', 'users_status');
            });
        } catch (\Exception $e) {
        }

        try {
            Schema::table('users', function (Blueprint $table) {
                $table->index('is_online', 'users_online');
            });
        } catch (\Exception $e) {
        }

        try {
            Schema::table('users', function (Blueprint $table) {
                $table->index('last_seen_at', 'users_last_seen');
            });
        } catch (\Exception $e) {
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        try {
            Schema::table('users', function (Blueprint $table) {
                $table->dropIndex('users_status');
            });
        } catch (\Exception $e) {
        }

        try {
            Schema::table('users', function (Blueprint $table) {
                $table->dropIndex('users_online');
            });
        } catch (\Exception $e) {
        }

        try {
            Schema::table('users', function (Blueprint $table) {
                $table->dropIndex('users_last_seen');
            });
        } catch (\Exception $e) {
        }

        Schema::table('users', function (Blueprint $table) {
            $columnsToRemove = [];

            if (Schema::hasColumn('users', 'bio')) {
                $columnsToRemove[] = 'bio';
            }
            if (Schema::hasColumn('users', 'location')) {
                $columnsToRemove[] = 'location';
            }
            if (Schema::hasColumn('users', 'avatar')) {
                $columnsToRemove[] = 'avatar';
            }
            if (Schema::hasColumn('users', 'last_login_at')) {
                $columnsToRemove[] = 'last_login_at';
            }
            if (Schema::hasColumn('users', 'phone_verified_at')) {
                $columnsToRemove[] = 'phone_verified_at';
            }
            if (Schema::hasColumn('users', 'email_verified_at')) {
                $columnsToRemove[] = 'email_verified_at';
            }
            if (Schema::hasColumn('users', 'password_reset_token')) {
                $columnsToRemove[] = 'password_reset_token';
            }
            if (Schema::hasColumn('users', 'password_reset_expires_at')) {
                $columnsToRemove[] = 'password_reset_expires_at';
            }
            if (Schema::hasColumn('users', 'status')) {
                $columnsToRemove[] = 'status';
            }
            if (Schema::hasColumn('users', 'is_online')) {
                $columnsToRemove[] = 'is_online';
            }
            if (Schema::hasColumn('users', 'last_seen_at')) {
                $columnsToRemove[] = 'last_seen_at';
            }

            if (!empty($columnsToRemove)) {
                $table->dropColumn($columnsToRemove);
            }
        });
    }
};