<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::connection('appqyv1')->hasTable('app_qy_v1_group_libraries')) {
            Schema::connection('appqyv1')->create('app_qy_v1_group_libraries', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('group_id')->comment('Group ID from word_groups table');
                $table->unsignedBigInteger('library_id')->comment('Library ID from vocabulary_libraries');
                $table->timestamp('added_at')->useCurrent()->comment('When library was added to group');
                $table->timestamps();

                $table->unique(['group_id', 'library_id'], 'unique_group_library');
                $table->index('group_id', 'idx_group_lib_group');
                $table->index('library_id', 'idx_group_lib_library');
            });
        }
    }

    public function down(): void
    {
        Schema::connection('appqyv1')->dropIfExists('app_qy_v1_group_libraries');
    }
};
