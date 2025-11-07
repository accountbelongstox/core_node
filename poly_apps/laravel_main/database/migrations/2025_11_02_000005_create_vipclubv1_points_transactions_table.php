<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vipclubv1_points_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->integer('points');
            $table->enum('type', ['earn', 'redeem']);
            $table->text('description')->nullable();
            $table->foreignId('related_booking_id')->nullable()->constrained('vipclubv1_bookings')->onDelete('set null');
            $table->timestamps();

            $table->index('user_id');
            $table->index('type');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vipclubv1_points_transactions');
    }
};
