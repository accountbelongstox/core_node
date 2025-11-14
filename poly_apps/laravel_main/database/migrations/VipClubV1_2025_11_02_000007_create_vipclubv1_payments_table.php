<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('VipClubV1')->create('vipclubv1_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('booking_id')->nullable()->constrained('vipclubv1_bookings')->onDelete('set null');
            $table->string('payment_type')->default('booking');
            $table->string('membership_tier')->nullable();
            $table->decimal('amount', 10, 2);
            $table->string('currency', 3)->default('USD');
            $table->enum('payment_method', ['stripe', 'paypal', 'wechat', 'alipay', 'credit_card'])->default('credit_card');
            $table->enum('payment_status', ['pending', 'processing', 'completed', 'failed', 'refunded'])->default('pending');
            $table->string('transaction_id')->unique()->nullable();
            $table->string('payment_intent_id')->nullable();
            $table->string('client_secret')->nullable();
            $table->text('receipt_url')->nullable();
            $table->json('payment_details')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->index('user_id');
            $table->index('booking_id');
            $table->index('payment_status');
            $table->index('payment_type');
        });
    }

    public function down(): void
    {
        Schema::connection('VipClubV1')->dropIfExists('vipclubv1_payments');
    }
};
