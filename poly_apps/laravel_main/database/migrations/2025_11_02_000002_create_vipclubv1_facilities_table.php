<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vipclubv1_facilities', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->enum('type', ['shooting', 'golf', 'hotel']);
            $table->text('description')->nullable();
            $table->string('image_url')->nullable();
            $table->decimal('base_price', 10, 2)->default(0);
            $table->json('available_times')->nullable();
            $table->json('features')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('vip_only')->default(false);
            $table->json('specific_data')->nullable();
            $table->timestamps();

            $table->index('type');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vipclubv1_facilities');
    }
};
