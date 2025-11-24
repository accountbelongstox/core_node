<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'phone')) {
                $table->string('phone')->nullable()->after('email');
            }
            if (!Schema::hasColumn('users', 'avatar_url')) {
                $table->string('avatar_url')->nullable()->after('phone');
            }
            if (!Schema::hasColumn('users', 'member_type')) {
                $table->enum('member_type', ['guest', 'regular', 'gold', 'platinum', 'diamond'])->default('guest')->after('avatar_url');
            }
            if (!Schema::hasColumn('users', 'vip_points')) {
                $table->integer('vip_points')->default(0)->after('member_type');
            }
            if (!Schema::hasColumn('users', 'member_since')) {
                $table->timestamp('member_since')->nullable()->after('vip_points');
            }
            if (!Schema::hasColumn('users', 'member_expiry')) {
                $table->timestamp('member_expiry')->nullable()->after('member_since');
            }
            if (!Schema::hasColumn('users', 'is_active')) {
                $table->boolean('is_active')->default(true)->after('member_expiry');
            }
            if (!Schema::hasColumn('users', 'preferences')) {
                $table->json('preferences')->nullable()->after('is_active');
            }
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table) {
                if (Schema::hasColumn('users', 'phone')) {
                    $table->dropColumn('phone');
                }
                if (Schema::hasColumn('users', 'avatar_url')) {
                    $table->dropColumn('avatar_url');
                }
                if (Schema::hasColumn('users', 'member_type')) {
                    $table->dropColumn('member_type');
                }
                if (Schema::hasColumn('users', 'vip_points')) {
                    $table->dropColumn('vip_points');
                }
                if (Schema::hasColumn('users', 'member_since')) {
                    $table->dropColumn('member_since');
                }
                if (Schema::hasColumn('users', 'member_expiry')) {
                    $table->dropColumn('member_expiry');
                }
                if (Schema::hasColumn('users', 'is_active')) {
                    $table->dropColumn('is_active');
                }
                if (Schema::hasColumn('users', 'preferences')) {
                    $table->dropColumn('preferences');
                }
            });
        }
    }
};
