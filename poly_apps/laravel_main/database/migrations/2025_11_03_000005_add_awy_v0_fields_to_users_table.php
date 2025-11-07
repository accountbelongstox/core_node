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
            // Add AwyV0 specific fields to users table
            $table->string('bio')->nullable();
            $table->string('location')->nullable();
            $table->string('avatar')->nullable();
            $table->timestamp('last_login_at')->nullable();
            $table->timestamp('phone_verified_at')->nullable();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password_reset_token')->nullable();
            $table->timestamp('password_reset_expires_at')->nullable();
            $table->string('status')->default('active'); // active, inactive, suspended
            $table->boolean('is_online')->default(false);
            $table->timestamp('last_seen_at')->nullable();

            // Indexes
            $table->index('status', 'users_status');
            $table->index('is_online', 'users_online');
            $table->index('last_seen_at', 'users_last_seen');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('bio');
            $table->dropColumn('location');
            $table->dropColumn('avatar');
            $table->dropColumn('last_login_at');
            $table->dropColumn('phone_verified_at');
            $table->dropColumn('email_verified_at');
            $table->dropColumn('password_reset_token');
            $table->dropColumn('password_reset_expires_at');
            $table->dropColumn('status');
            $table->dropColumn('is_online');
            $table->dropColumn('last_seen_at');
        });
    }
};