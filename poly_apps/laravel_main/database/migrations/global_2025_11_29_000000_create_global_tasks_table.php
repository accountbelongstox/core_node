<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('global_tasks', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('task_id')->unique();
            $table->string('app_name')->index();
            $table->string('task_type')->nullable();
            $table->string('status')->default('pending')->index();
            $table->decimal('progress', 5, 2)->default(0);
            $table->json('payload')->nullable();
            $table->json('steps')->nullable();
            $table->json('result')->nullable();
            $table->text('error')->nullable();
            $table->string('queue_item_id')->nullable()->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('global_tasks');
    }
};
