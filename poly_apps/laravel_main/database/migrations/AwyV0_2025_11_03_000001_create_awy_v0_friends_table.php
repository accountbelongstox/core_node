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
        $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'friends');
        
        if (!Schema::connection($connection)->hasTable($tableName)) {
            Schema::connection($connection)->create($tableName, function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->index();
            $table->unsignedBigInteger('friend_id')->index();
            $table->enum('status', ['pending', 'accepted', 'blocked'])->default('pending');
            $table->text('request_message')->nullable();
            $table->unsignedBigInteger('initiated_by')->index();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('friend_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('initiated_by')->references('id')->on('users')->onDelete('cascade');

            $table->unique(['user_id', 'friend_id'], 'awy_v0_friends_unique');
            $table->index(['user_id', 'status'], 'awy_v0_friends_user_status');
            $table->index(['friend_id', 'status'], 'awy_v0_friends_friend_status');
            $table->index('status', 'awy_v0_friends_status');
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
        $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'friends');
        Schema::connection($connection)->dropIfExists($tableName);
    }
};