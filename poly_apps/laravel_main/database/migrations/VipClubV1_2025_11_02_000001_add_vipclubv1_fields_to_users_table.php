<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('phone')->nullable()->after('email');
            $table->string('avatar_url')->nullable()->after('phone');
            $table->enum('member_type', ['guest', 'regular', 'gold', 'platinum', 'diamond'])->default('guest')->after('avatar_url');
            $table->integer('vip_points')->default(0)->after('member_type');
            $table->timestamp('member_since')->nullable()->after('vip_points');
            $table->timestamp('member_expiry')->nullable()->after('member_since');
            $table->boolean('is_active')->default(true)->after('member_expiry');
            $table->json('preferences')->nullable()->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'phone',
                'avatar_url',
                'member_type',
                'vip_points',
                'member_since',
                'member_expiry',
                'is_active',
                'preferences'
            ]);
        });
    }
};
