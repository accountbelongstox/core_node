<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invite_codes', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('type')->default('admin');
            $table->integer('max_uses')->default(1);
            $table->integer('used_count')->default(0);
            $table->timestamp('expires_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
            $table->text('description')->nullable();
            $table->timestamps();

            $table->index('code');
            $table->index('is_active');
        });

        Schema::create('invite_code_usage', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invite_code_id')->constrained('invite_codes')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->timestamp('used_at');
            $table->timestamps();

            $table->index('invite_code_id');
            $table->index('user_id');
        });

        // Insert default admin invite codes
        $defaultCodes = [
            [
                'code' => 'ADMIN_' . strtoupper(Str::random(20)),
                'type' => 'admin',
                'max_uses' => 10,
                'used_count' => 0,
                'expires_at' => now()->addYears(10),
                'is_active' => true,
                'description' => 'Default admin invite code',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'code' => 'SUPER_' . strtoupper(Str::random(20)),
                'type' => 'super_admin',
                'max_uses' => 1,
                'used_count' => 0,
                'expires_at' => null,
                'is_active' => true,
                'description' => 'Super admin invite code (unlimited time)',
                'created_at' => now(),
                'updated_at' => now(),
            ]
        ];

        DB::table('invite_codes')->insert($defaultCodes);

        \Log::info('[InviteCode Migration] Default invite codes created');
        foreach ($defaultCodes as $code) {
            \Log::info('[InviteCode] ' . $code['type'] . ': ' . $code['code']);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('invite_code_usage');
        Schema::dropIfExists('invite_codes');
    }
};
