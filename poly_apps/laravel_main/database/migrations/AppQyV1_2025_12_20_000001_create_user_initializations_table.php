<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $connectionName = (new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserInitializationModel)->getConnectionName();
        $tableName = (new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserInitializationModel)->getTable();

        if (!Schema::connection($connectionName)->hasTable($tableName)) {
            Schema::connection($connectionName)->create($tableName, function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id')->unique();
                $table->string('occupation', 100)->nullable();
                $table->integer('daily_words_target')->default(20);
                $table->integer('daily_study_time')->default(30);
                $table->text('preferences')->nullable();
                $table->boolean('is_initialized')->default(false);
                $table->timestamp('initialization_completed_at')->nullable();
                $table->timestamps();

                $appKey = \App\Constants\AppKeys::APPQYV1;
                $table->index('user_id', 'idx_' . \App\Providers\AppTablePrefixServiceProvider::getPrefix($appKey) . '_user_init_user_id');
            });
        }
    }

    public function down(): void
    {
        $connectionName = (new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserInitializationModel)->getConnectionName();
        $tableName = (new \App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserInitializationModel)->getTable();
        Schema::connection($connectionName)->dropIfExists($tableName);
    }
};

