<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Users table
        Schema::create('bankv1_users', function (Blueprint $table) {
            $table->id();
            $table->string('username')->unique();
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->string('full_name');
            $table->string('phone')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->enum('gender', ['male', 'female', 'other'])->nullable();
            $table->enum('account_status', ['active', 'inactive', 'suspended'])->default('active');
            $table->boolean('is_locked')->default(false);
            $table->string('lock_reason')->nullable();
            $table->timestamp('locked_at')->nullable();
            $table->timestamp('last_login_at')->nullable();
            $table->integer('login_attempts')->default(0);
            $table->timestamps();
            
            $table->index(['username', 'email']);
            $table->index('account_status');
            $table->index('is_locked');
        });

        // User profiles table
        Schema::create('bankv1_user_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('bankv1_users')->onDelete('cascade');
            $table->string('avatar')->nullable();
            $table->text('bio')->nullable();
            $table->json('preferences')->nullable();
            $table->json('notification_settings')->nullable();
            $table->timestamps();
            
            $table->index('user_id');
        });

        // User addresses table
        Schema::create('bankv1_user_addresses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('bankv1_users')->onDelete('cascade');
            $table->enum('type', ['primary', 'billing', 'shipping'])->default('primary');
            $table->string('street')->nullable();
            $table->string('city')->nullable();
            $table->string('state')->nullable();
            $table->string('zip_code')->nullable();
            $table->string('country')->nullable();
            $table->boolean('is_primary')->default(false);
            $table->timestamps();
            
            $table->index(['user_id', 'type']);
            $table->index('is_primary');
        });

        // Accounts table
        Schema::create('bankv1_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('bankv1_users')->onDelete('cascade');
            $table->string('account_number')->unique();
            $table->enum('account_type', ['checking', 'savings', 'credit'])->default('checking');
            $table->decimal('balance', 15, 2)->default(0.00);
            $table->string('currency', 3)->default('USD');
            $table->enum('status', ['active', 'inactive', 'closed'])->default('active');
            $table->timestamp('opened_at');
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
            
            $table->index(['user_id', 'status']);
            $table->index('account_number');
        });

        // Transactions table
        Schema::create('bankv1_transactions', function (Blueprint $table) {
            $table->id();
            $table->string('transaction_id')->unique();
            $table->foreignId('from_account_id')->nullable()->constrained('bankv1_accounts');
            $table->foreignId('to_account_id')->nullable()->constrained('bankv1_accounts');
            $table->decimal('amount', 15, 2);
            $table->decimal('fee', 15, 2)->default(0.00);
            $table->string('currency', 3)->default('USD');
            $table->enum('type', ['transfer', 'payment', 'deposit', 'withdrawal', 'fee', 'refund', 'adjustment']);
            $table->enum('status', ['pending', 'completed', 'failed', 'cancelled', 'processing'])->default('pending');
            $table->string('description')->nullable();
            $table->string('reference')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
            
            $table->index(['transaction_id', 'status']);
            $table->index(['from_account_id', 'to_account_id']);
            $table->index(['type', 'status']);
            $table->index('processed_at');
        });

        // Devices table
        Schema::create('bankv1_devices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('bankv1_users')->onDelete('cascade');
            $table->string('device_id')->unique();
            $table->string('app_signature');
            $table->string('device_name')->nullable();
            $table->enum('platform', ['android', 'ios', 'web', 'windows', 'macos', 'linux'])->default('android');
            $table->string('app_version')->nullable();
            $table->enum('status', ['active', 'locked', 'suspended', 'pending', 'revoked'])->default('pending');
            $table->boolean('is_locked')->default(false);
            $table->string('lock_reason')->nullable();
            $table->timestamp('locked_at')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('registered_at');
            $table->timestamps();
            
            $table->index(['device_id', 'status']);
            $table->index(['user_id', 'status']);
            $table->index('is_locked');
        });

        // Sessions table
        Schema::create('bankv1_sessions', function (Blueprint $table) {
            $table->id();
            $table->string('session_id')->unique();
            $table->foreignId('user_id')->nullable()->constrained('bankv1_users')->onDelete('cascade');
            $table->string('device_id')->nullable();
            $table->ipAddress('ip_address')->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('started_at');
            $table->timestamp('ended_at')->nullable();
            $table->timestamp('last_activity_at');
            $table->integer('duration')->nullable(); // in seconds
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            $table->index(['session_id', 'is_active']);
            $table->index(['user_id', 'device_id']);
            $table->index('last_activity_at');
        });

        // App logs table
        Schema::create('bankv1_app_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('bankv1_users')->onDelete('cascade');
            $table->string('device_id')->nullable();
            $table->string('session_id')->nullable();
            $table->string('event_type');
            $table->json('event_data')->nullable();
            $table->ipAddress('ip_address')->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('timestamp');
            $table->timestamp('created_at');
            
            $table->index(['user_id', 'event_type']);
            $table->index(['device_id', 'event_type']);
            $table->index(['event_type', 'timestamp']);
            $table->index('timestamp');
        });

        // Security logs table
        Schema::create('bankv1_security_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('bankv1_users')->onDelete('cascade');
            $table->string('device_id')->nullable();
            $table->string('event_type');
            $table->enum('severity', ['low', 'medium', 'high', 'critical'])->default('medium');
            $table->string('description');
            $table->json('event_data')->nullable();
            $table->ipAddress('ip_address')->nullable();
            $table->text('user_agent')->nullable();
            $table->boolean('resolved')->default(false);
            $table->timestamp('resolved_at')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('bankv1_users');
            $table->timestamp('timestamp');
            $table->timestamp('created_at');
            
            $table->index(['user_id', 'event_type']);
            $table->index(['device_id', 'event_type']);
            $table->index(['event_type', 'severity']);
            $table->index(['resolved', 'severity']);
            $table->index('timestamp');
        });

        // Registration codes table
        Schema::create('bankv1_registration_codes', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->enum('type', ['balance_bonus', 'discount', 'feature_unlock'])->default('balance_bonus');
            $table->decimal('value', 15, 2)->default(0.00);
            $table->string('description')->nullable();
            $table->integer('max_uses')->nullable();
            $table->integer('used_count')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamp('expires_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('bankv1_users');
            $table->timestamps();
            
            $table->index(['code', 'is_active']);
            $table->index(['type', 'is_active']);
            $table->index('expires_at');
        });

        // Code usage table
        Schema::create('bankv1_code_usage', function (Blueprint $table) {
            $table->id();
            $table->foreignId('code_id')->constrained('bankv1_registration_codes')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('bankv1_users')->onDelete('cascade');
            $table->string('device_id')->nullable();
            $table->timestamp('used_at');
            $table->ipAddress('ip_address')->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at');
            
            $table->index(['code_id', 'user_id']);
            $table->index('used_at');
        });

        // JWT tokens table
        Schema::create('bankv1_jwt_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('bankv1_users')->onDelete('cascade');
            $table->string('device_id')->nullable();
            $table->string('token_id')->unique();
            $table->string('token_hash');
            $table->string('refresh_token_hash');
            $table->timestamp('expires_at');
            $table->timestamp('refresh_expires_at');
            $table->boolean('is_revoked')->default(false);
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
            
            $table->index(['user_id', 'device_id']);
            $table->index(['token_hash', 'is_revoked']);
            $table->index('expires_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('bankv1_jwt_tokens');
        Schema::dropIfExists('bankv1_code_usage');
        Schema::dropIfExists('bankv1_registration_codes');
        Schema::dropIfExists('bankv1_security_logs');
        Schema::dropIfExists('bankv1_app_logs');
        Schema::dropIfExists('bankv1_sessions');
        Schema::dropIfExists('bankv1_devices');
        Schema::dropIfExists('bankv1_transactions');
        Schema::dropIfExists('bankv1_accounts');
        Schema::dropIfExists('bankv1_user_addresses');
        Schema::dropIfExists('bankv1_user_profiles');
        Schema::dropIfExists('bankv1_users');
    }
};
