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
        $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'conversations');
        
        if (!Schema::connection($connection)->hasTable($tableName)) {
            Schema::connection($connection)->create($tableName, function (Blueprint $table) {
            $table->id();
            $table->string('conversation_id', 100)->unique();
            $table->string('type')->default('direct'); // direct, group
            $table->string('title')->nullable();
            $table->unsignedBigInteger('created_by')->index();
            $table->timestamps();

            $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
            $table->index('created_by', 'awy_v0_conversations_created_by');
            $table->index('type', 'awy_v0_conversations_type');
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
        $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'conversations');
        Schema::connection($connection)->dropIfExists($tableName);
    }
};