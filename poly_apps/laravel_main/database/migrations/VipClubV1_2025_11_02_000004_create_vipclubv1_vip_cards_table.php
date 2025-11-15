<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('VipClubV1')->create('vipclubv1_vip_cards', function (Blueprint $table) {
            $table->id();
            $table->string('card_number')->unique();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->enum('member_type', ['guest', 'regular', 'gold', 'platinum', 'diamond'])->default('regular');
            $table->timestamp('issue_date')->nullable();
            $table->timestamp('expiry_date')->nullable();
            $table->integer('points')->default(0);
            $table->json('benefits')->nullable();
            $table->text('qr_code')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('user_id');
            $table->index('card_number');
            $table->index('member_type');
        });
    }

    public function down(): void
    {
        Schema::connection('VipClubV1')->dropIfExists('vipclubv1_vip_cards');
    }
};
