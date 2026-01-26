<?php

// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create or update documentation (*.md).
// 3. Never create or update test code.
// 4. Never create or update documentation (*.md).
// 5. Never write summaries during development or thinking process.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $appKey = AppKeys::AWYV0;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'conversation_participants');
        $conversationsTableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'conversations');
        
        if (!Schema::connection($connection)->hasTable($tableName)) {
            Schema::connection($connection)->create($tableName, function (Blueprint $table) use ($conversationsTableName) {
            $table->id();
            $table->unsignedBigInteger('conversation_id')->index();
            $table->unsignedBigInteger('user_id')->index();
            $table->enum('role', ['participant', 'admin'])->default('participant');
            $table->timestamp('joined_at')->useCurrent();
            $table->timestamp('last_read_at')->nullable();
            $table->boolean('is_active')->default(true);

            $table->foreign('conversation_id')->references('id')->on($conversationsTableName)->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->unique(['conversation_id', 'user_id'], 'awy_v0_conversation_participants_unique');
            $table->index(['user_id', 'is_active'], 'awy_v0_conversation_participants_user_active');
            $table->index('joined_at', 'awy_v0_conversation_participants_joined_at');
        });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $appKey = AppKeys::AWYV0;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'conversation_participants');
        Schema::connection($connection)->dropIfExists($tableName);
    }
};