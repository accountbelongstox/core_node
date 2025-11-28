<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Builder;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('placeholder_images', function ($table) {
            $table->id();
            $table->string('uuid', 36)->unique()->index();
            $table->string('filename');
            $table->integer('width');
            $table->integer('height');
            $table->text('text')->nullable();
            $table->string('type', 50)->default('simple');
            $table->string('file_path');
            $table->integer('file_size')->default(0);
            $table->boolean('downloaded')->default(false);
            $table->timestamp('downloaded_at')->nullable();
            $table->timestamps();
            $table->index(['downloaded', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('placeholder_images');
    }
};
