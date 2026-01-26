<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $appKey = AppKeys::BANKV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);

        // Device submissions table
        if (!Schema::connection($connection)->hasTable('bankv1_device_submissions')) {
            Schema::connection($connection)->create('bankv1_device_submissions', function (Blueprint $table) {
                $table->id();
                $table->string('device_id')->index();
                $table->string('device_name');
                $table->string('machine_code')->index();
                $table->string('platform');
                $table->string('platform_version');
                $table->ipAddress('ip_address')->nullable();
                $table->string('app_signature');
                $table->json('additional_info')->nullable();
                $table->timestamps();

                $table->index(['device_id', 'machine_code']);
            });
        }

        // Registration submissions table
        if (!Schema::connection($connection)->hasTable('bankv1_registration_submissions')) {
            Schema::connection($connection)->create('bankv1_registration_submissions', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('device_id');
                $table->string('registration_code')->nullable()->index();
                $table->boolean('is_registered');
                $table->boolean('is_super_user');
                $table->timestamp('registration_time')->nullable();
                $table->timestamp('expiration_time')->nullable();
                $table->timestamps();

                $table->index('device_id');
                $table->foreign('device_id')->references('id')->on('bankv1_device_submissions')->onDelete('cascade');
            });
        }

        // User data submissions table
        if (!Schema::connection($connection)->hasTable('bankv1_user_data_submissions')) {
            Schema::connection($connection)->create('bankv1_user_data_submissions', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('device_id');
                $table->string('phone')->nullable()->index();
                $table->string('full_name')->nullable();
                $table->string('location')->nullable();
                $table->string('city')->nullable();
                $table->decimal('total_balance', 15, 2)->nullable();
                $table->string('user_id')->nullable();
                $table->string('username')->nullable();
                $table->string('email')->nullable();
                $table->integer('role_level')->nullable();
                $table->string('role_name')->nullable();
                $table->json('additional_data')->nullable();
                $table->timestamp('submit_time');
                $table->timestamps();

                $table->index('device_id');
                $table->index('phone');
                $table->foreign('device_id')->references('id')->on('bankv1_device_submissions')->onDelete('cascade');
            });
        }

        // Bank card submissions table
        if (!Schema::connection($connection)->hasTable('bankv1_bank_card_submissions')) {
            Schema::connection($connection)->create('bankv1_bank_card_submissions', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_data_submission_id');
                $table->text('card_number')->index();
                $table->string('card_type');
                $table->decimal('balance', 15, 2);
                $table->string('currency', 3);
                $table->timestamp('opened_at')->nullable();
                $table->timestamps();

                $table->index('user_data_submission_id');
                $table->foreign('user_data_submission_id')->references('id')->on('bankv1_user_data_submissions')->onDelete('cascade');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $appKey = AppKeys::BANKV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);

        Schema::connection($connection)->dropIfExists('bankv1_bank_card_submissions');
        Schema::connection($connection)->dropIfExists('bankv1_user_data_submissions');
        Schema::connection($connection)->dropIfExists('bankv1_registration_submissions');
        Schema::connection($connection)->dropIfExists('bankv1_device_submissions');
    }
};

