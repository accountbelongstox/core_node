<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::connection('vipclubv1')->hasTable('vipclubv1_bookings')) {
        Schema::connection('vipclubv1')->create('vipclubv1_bookings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('facility_id')->constrained('vipclubv1_facilities')->onDelete('cascade');
            $table->enum('facility_type', ['shooting', 'golf', 'hotel']);
            $table->string('facility_name');
            $table->date('booking_date');
            $table->string('time_slot');
            $table->integer('duration')->default(1);
            $table->decimal('price', 10, 2)->default(0);
            $table->decimal('discount', 10, 2)->default(0);
            $table->decimal('final_price', 10, 2)->default(0);
            $table->enum('status', ['pending', 'confirmed', 'cancelled', 'completed'])->default('pending');
            $table->json('extras')->nullable();
            $table->timestamps();

            $table->index('user_id');
            $table->index('facility_id');
            $table->index('booking_date');
            $table->index('status');
        });
        }
    }

    public function down(): void
    {
        Schema::connection('vipclubv1')->dropIfExists('vipclubv1_bookings');
    }
};
