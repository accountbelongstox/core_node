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
    public function up()
    {
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'dictionaries');
        
        if (!Schema::connection($connection)->hasTable($tableName)) {
            Schema::connection($connection)->create($tableName, function (Blueprint $table) {
            $table->id();  // Same as auto-incrementing primary key
            
            $table->text('content')->nullable(false);
            $table->text('md5')->nullable(false);
            $table->json('translation')->nullable();
            $table->boolean('isTranslation')->default(false)->nullable();
            $table->integer('translation_provider')->default(0)->nullable();
            
            // Timestamps
            $table->dateTime('lastModified')->default(DB::raw('CURRENT_TIMESTAMP'))->nullable();
            $table->dateTime('lastInsertTime')->default(DB::raw('CURRENT_TIMESTAMP'))->nullable();
            $table->dateTime('lastUpdateTime')->default(DB::raw('CURRENT_TIMESTAMP'))->nullable();
            $table->dateTime('lastQueryTime')->default(DB::raw('CURRENT_TIMESTAMP'))->nullable();
            
            $table->integer('queryCount')->default(0)->nullable();
            $table->text('usPhonetic')->nullable();
            $table->text('ukPhonetic')->nullable();
            $table->json('voice_files')->nullable();
            $table->json('image_files')->nullable();
            $table->boolean('isExistLocal')->default(false)->nullable();
            $table->integer('voice_files_provider')->default(0)->nullable();
            $table->integer('image_files_provider')->default(0)->nullable();
            $table->boolean('hasOperations')->default(true)->nullable();
            
            // Laravel's default timestamps (created_at and updated_at)
            $table->timestamps();
            
            // If you need to keep your original createdAt field
            $table->dateTime('createdAt')->default(DB::raw('CURRENT_TIMESTAMP'))->nullable();
        });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, 'dictionaries');
        Schema::connection($connection)->dropIfExists($tableName);
    }
};