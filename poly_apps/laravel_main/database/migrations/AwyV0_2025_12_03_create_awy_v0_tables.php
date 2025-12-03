<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'awyv0';

    public function up(): void
    {
        if (!Schema::connection($this->connection)->hasTable('awy_v0_users')) {
            Schema::connection($this->connection)->create('awy_v0_users', function (Blueprint $table) {
                $table->id();
                $table->string('username')->unique();
                $table->string('email')->unique()->nullable();
                $table->string('phone', 20)->unique()->nullable();
                $table->string('password');
                $table->string('name')->nullable();
                $table->string('avatar')->nullable();
                $table->string('signature')->nullable();
                $table->enum('gender', ['male', 'female'])->nullable();
                $table->string('address')->nullable();
                $table->date('birthday')->nullable();
                $table->string('id_card')->nullable();
                $table->string('user_token')->nullable();
                $table->integer('status')->default(1);
                $table->timestamps();
                $table->softDeletes();

                $table->index('username');
                $table->index('email');
                $table->index('phone');
            });
        }

        if (!Schema::connection($this->connection)->hasTable('awy_v0_verification_codes')) {
            Schema::connection($this->connection)->create('awy_v0_verification_codes', function (Blueprint $table) {
                $table->id();
                $table->string('phone', 20);
                $table->string('code', 10);
                $table->timestamp('expires_at');
                $table->boolean('used')->default(false);
                $table->timestamps();

                $table->index('phone');
                $table->index('expires_at');
            });
        }

        if (!Schema::connection($this->connection)->hasTable('awy_v0_friend_requests')) {
            Schema::connection($this->connection)->create('awy_v0_friend_requests', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('from_user_id');
                $table->unsignedBigInteger('to_user_id');
                $table->string('message')->nullable();
                $table->string('alias')->nullable();
                $table->enum('relation', ['Partner', 'Child', 'Parent', 'Friend', 'Family'])->nullable();
                $table->enum('status', ['pending', 'accepted', 'rejected'])->default('pending');
                $table->timestamps();

                $table->index('from_user_id');
                $table->index('to_user_id');
                $table->index('status');
            });
        }

        if (!Schema::connection($this->connection)->hasTable('awy_v0_friends')) {
            Schema::connection($this->connection)->create('awy_v0_friends', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id');
                $table->unsignedBigInteger('friend_id');
                $table->enum('relation', ['Partner', 'Child', 'Parent', 'Friend', 'Family'])->nullable();
                $table->string('alias')->nullable();
                $table->integer('days_connected')->default(0);
                $table->boolean('is_monitored')->default(false);
                $table->enum('status', ['active', 'blocked'])->default('active');
                $table->timestamps();

                $table->unique(['user_id', 'friend_id']);
                $table->index('user_id');
                $table->index('friend_id');
            });
        }

        if (!Schema::connection($this->connection)->hasTable('awy_v0_devices')) {
            Schema::connection($this->connection)->create('awy_v0_devices', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id');
                $table->string('device_name');
                $table->string('device_type');
                $table->string('device_token')->nullable();
                $table->string('platform')->nullable();
                $table->string('network')->nullable();
                $table->integer('unlocks')->default(0);
                $table->integer('usage_time_minutes')->default(0);
                $table->integer('battery')->nullable();
                $table->timestamp('last_unlock')->nullable();
                $table->timestamps();

                $table->index('user_id');
                $table->index('device_token');
            });
        }

        if (!Schema::connection($this->connection)->hasTable('awy_v0_locations')) {
            Schema::connection($this->connection)->create('awy_v0_locations', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id');
                $table->decimal('lat', 10, 7);
                $table->decimal('lng', 10, 7);
                $table->string('address')->nullable();
                $table->decimal('accuracy', 8, 2)->nullable();
                $table->decimal('speed', 8, 2)->nullable();
                $table->decimal('heading', 8, 2)->nullable();
                $table->timestamp('location_timestamp');
                $table->timestamps();

                $table->index('user_id');
                $table->index('location_timestamp');
            });
        }

        if (!Schema::connection($this->connection)->hasTable('awy_v0_location_history')) {
            Schema::connection($this->connection)->create('awy_v0_location_history', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id');
                $table->string('location_name')->nullable();
                $table->string('address')->nullable();
                $table->decimal('lat', 10, 7);
                $table->decimal('lng', 10, 7);
                $table->integer('duration_minutes')->nullable();
                $table->timestamp('visited_at');
                $table->timestamp('left_at')->nullable();
                $table->timestamps();

                $table->index('user_id');
                $table->index('visited_at');
            });
        }

        if (!Schema::connection($this->connection)->hasTable('awy_v0_health_data')) {
            Schema::connection($this->connection)->create('awy_v0_health_data', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id');
                $table->integer('steps')->default(0);
                $table->integer('heart_rate')->nullable();
                $table->decimal('temperature', 4, 1)->nullable();
                $table->date('data_date');
                $table->timestamps();

                $table->unique(['user_id', 'data_date']);
                $table->index('user_id');
                $table->index('data_date');
            });
        }

        if (!Schema::connection($this->connection)->hasTable('awy_v0_chats')) {
            Schema::connection($this->connection)->create('awy_v0_chats', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('sender_id');
                $table->unsignedBigInteger('receiver_id');
                $table->text('message');
                $table->enum('message_type', ['text', 'image', 'voice', 'video'])->default('text');
                $table->boolean('read')->default(false);
                $table->enum('status', ['sent', 'delivered', 'read', 'deleted'])->default('sent');
                $table->timestamps();

                $table->index('sender_id');
                $table->index('receiver_id');
                $table->index(['sender_id', 'receiver_id']);
                $table->index('created_at');
            });
        }

        if (!Schema::connection($this->connection)->hasTable('awy_v0_products')) {
            Schema::connection($this->connection)->create('awy_v0_products', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('name_en')->nullable();
                $table->decimal('price', 10, 2);
                $table->string('currency', 10)->default('CNY');
                $table->decimal('rating', 3, 2)->default(0);
                $table->integer('reviews_count')->default(0);
                $table->string('image')->nullable();
                $table->json('images')->nullable();
                $table->text('description')->nullable();
                $table->text('description_en')->nullable();
                $table->enum('category', ['watch', 'accessory', 'health'])->default('watch');
                $table->json('specifications')->nullable();
                $table->boolean('in_stock')->default(true);
                $table->integer('stock_count')->default(0);
                $table->timestamps();

                $table->index('category');
                $table->index('in_stock');
            });
        }

        if (!Schema::connection($this->connection)->hasTable('awy_v0_ai_chat_history')) {
            Schema::connection($this->connection)->create('awy_v0_ai_chat_history', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id');
                $table->enum('role', ['user', 'assistant'])->default('user');
                $table->text('content');
                $table->json('context')->nullable();
                $table->timestamps();

                $table->index('user_id');
                $table->index('created_at');
            });
        }
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('awy_v0_ai_chat_history');
        Schema::connection($this->connection)->dropIfExists('awy_v0_products');
        Schema::connection($this->connection)->dropIfExists('awy_v0_chats');
        Schema::connection($this->connection)->dropIfExists('awy_v0_health_data');
        Schema::connection($this->connection)->dropIfExists('awy_v0_location_history');
        Schema::connection($this->connection)->dropIfExists('awy_v0_locations');
        Schema::connection($this->connection)->dropIfExists('awy_v0_devices');
        Schema::connection($this->connection)->dropIfExists('awy_v0_friends');
        Schema::connection($this->connection)->dropIfExists('awy_v0_friend_requests');
        Schema::connection($this->connection)->dropIfExists('awy_v0_verification_codes');
        Schema::connection($this->connection)->dropIfExists('awy_v0_users');
    }
};
