<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('VipClubV1')->create('vipclubv1_support_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->text('message');
            $table->json('attachments')->nullable();
            $table->boolean('is_from_user')->default(true);
            $table->boolean('is_read')->default(false);
            $table->timestamps();

            $table->index('user_id');
            $table->index('is_read');
            $table->index('created_at');
        });

        Schema::connection('VipClubV1')->create('vipclubv1_support_config', function (Blueprint $table) {
            $table->id();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('wechat')->nullable();
            $table->string('whatsapp')->nullable();
            $table->string('hours')->default('Mon-Fri: 9AM-6PM');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::connection('VipClubV1')->dropIfExists('vipclubv1_support_messages');
        Schema::connection('VipClubV1')->dropIfExists('vipclubv1_support_config');
    }
};
