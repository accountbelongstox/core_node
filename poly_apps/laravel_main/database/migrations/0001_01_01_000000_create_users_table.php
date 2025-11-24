<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###


use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('users')) {
            Schema::create('users', function (Blueprint $table) {
                $table->id();
                $table->string(column: 'name')->nullable();
                $table->string('nickname')->nullable();
                $table->string('username')->unique();
                $table->string('avatar')->nullable();
                $table->text('about')->nullable();
                $table->string('flollwers')->nullable();
                $table->string('website')->nullable();
                $table->string('github')->nullable();
                $table->string('wechat')->nullable();
                $table->string('weibo')->nullable();
                $table->string('qq')->nullable();
                $table->string('age')->nullable();
                $table->string('gender')->nullable();
                $table->string('birthday')->nullable();
                $table->string('city')->nullable();
                $table->string('education')->nullable();
                $table->string('occupation')->nullable();
                $table->string('language')->nullable();
                $table->string('religion')->nullable();
                $table->integer('rolelevel')->default(0);
                $table->string('rolename')->default('user');
                $table->string('email')->nullable();
                $table->timestamp('email_verified_at')->nullable();
                $table->string('password');
                $table->string('user_token')->nullable();
                $table->rememberToken();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('password_reset_tokens')) {
            Schema::create('password_reset_tokens', function (Blueprint $table) {
                $table->string('email')->primary();
                $table->string('token');
                $table->timestamp('created_at')->nullable();
            });
        }

        if (!Schema::hasTable('sessions')) {
            Schema::create('sessions', function (Blueprint $table) {
                $table->string('id')->primary();
                $table->foreignId('user_id')->nullable()->index();
                $table->string('ip_address', 45)->nullable();
                $table->text('user_agent')->nullable();
                $table->longText('payload');
                $table->integer('last_activity')->index();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};