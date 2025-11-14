<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('VipClubV1')->create('vipclubv1_articles', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('summary')->nullable();
            $table->longText('content');
            $table->enum('category', ['news', 'events', 'tips', 'promotions', 'announcements'])->default('news');
            $table->string('cover_image_url')->nullable();
            $table->string('author')->default('VIP Club Admin');
            $table->timestamp('publish_date')->nullable();
            $table->integer('read_count')->default(0);
            $table->json('tags')->nullable();
            $table->boolean('is_featured')->default(false);
            $table->boolean('is_published')->default(true);
            $table->timestamps();

            $table->index('category');
            $table->index('is_featured');
            $table->index('is_published');
            $table->index('publish_date');
        });
    }

    public function down(): void
    {
        Schema::connection('VipClubV1')->dropIfExists('vipclubv1_articles');
    }
};
