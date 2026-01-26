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

        if (Schema::connection($connection)->hasTable('bankv1_user_data_submissions')) {
            Schema::connection($connection)->table('bankv1_user_data_submissions', function (Blueprint $table) {
                if (!Schema::connection($connection)->hasColumn('bankv1_user_data_submissions', 'complete_user_profile')) {
                    $table->json('complete_user_profile')->nullable()->after('additional_data');
                }
                if (!Schema::connection($connection)->hasColumn('bankv1_user_data_submissions', 'global_app_data')) {
                    $table->json('global_app_data')->nullable()->after('complete_user_profile');
                }
                if (!Schema::connection($connection)->hasColumn('bankv1_user_data_submissions', 'app_state')) {
                    $table->json('app_state')->nullable()->after('global_app_data');
                }
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

        if (Schema::connection($connection)->hasTable('bankv1_user_data_submissions')) {
            Schema::connection($connection)->table('bankv1_user_data_submissions', function (Blueprint $table) {
                if (Schema::connection($connection)->hasColumn('bankv1_user_data_submissions', 'complete_user_profile')) {
                    $table->dropColumn('complete_user_profile');
                }
                if (Schema::connection($connection)->hasColumn('bankv1_user_data_submissions', 'global_app_data')) {
                    $table->dropColumn('global_app_data');
                }
                if (Schema::connection($connection)->hasColumn('bankv1_user_data_submissions', 'app_state')) {
                    $table->dropColumn('app_state');
                }
            });
        }
    }
};
