<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

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
        if (!Schema::connection('codemartv1')->hasTable('codemart_email_verifications')) {
            Schema::connection('codemartv1')->create('codemart_email_verifications', function (Blueprint $table) {
                $table->id();
                $table->string('email')->unique();
                $table->string('token');
                $table->timestamp('verified_at')->nullable();
                $table->timestamps();
                $table->index('token');
                $table->index('email');
            });
        }

        if (!Schema::connection('codemartv1')->hasTable('codemart_phone_verifications')) {
            Schema::connection('codemartv1')->create('codemart_phone_verifications', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
                $table->string('phone')->unique();
                $table->string('otp_code');
                $table->integer('otp_attempts')->default(0);
                $table->timestamp('otp_expires_at');
                $table->timestamp('verified_at')->nullable();
                $table->timestamps();
                $table->index('phone');
                $table->index('user_id');
            });
        }

        if (!Schema::connection('codemartv1')->hasTable('codemart_kyc_verifications')) {
            Schema::connection('codemartv1')->create('codemart_kyc_verifications', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
                $table->string('identity_type'); // ID_CARD, PASSPORT, DRIVING_LICENSE
                $table->string('identity_number')->unique();
                $table->string('real_name');
                $table->date('date_of_birth')->nullable();
                $table->string('id_front_image_path')->nullable();
                $table->string('id_back_image_path')->nullable();
                $table->string('selfie_image_path')->nullable();
                $table->string('verification_status')->default('pending'); // pending, approved, rejected
                $table->text('verification_notes')->nullable();
                $table->timestamp('verified_at')->nullable();
                $table->string('verified_by')->nullable();
                $table->timestamps();
                $table->index('user_id');
                $table->index('verification_status');
            });
        }

        if (!Schema::connection('codemartv1')->hasTable('codemart_user_roles')) {
            Schema::connection('codemartv1')->create('codemart_user_roles', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
                $table->string('role_type'); // developer, client, architect, reviewer
                $table->string('role_status')->default('pending'); // pending, approved, active, suspended
                $table->decimal('deposit_amount', 15, 2)->default(0);
                $table->timestamp('role_activated_at')->nullable();
                $table->timestamps();
                $table->unique(['user_id', 'role_type']);
                $table->index('role_type');
                $table->index('role_status');
            });
        }

        if (!Schema::connection('codemartv1')->hasTable('codemart_developer_profiles')) {
            Schema::connection('codemartv1')->create('codemart_developer_profiles', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
                $table->string('company_name')->nullable();
                $table->text('bio')->nullable();
                $table->json('skills')->nullable();
                $table->json('certifications')->nullable();
                $table->integer('completed_projects')->default(0);
                $table->decimal('average_rating', 3, 2)->default(0);
                $table->integer('followers_count')->default(0);
                $table->timestamp('profile_completed_at')->nullable();
                $table->timestamps();
                $table->unique('user_id');
            });
        }

        if (!Schema::connection('codemartv1')->hasTable('codemart_client_profiles')) {
            Schema::connection('codemartv1')->create('codemart_client_profiles', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
                $table->string('company_name');
                $table->string('company_registration_number')->nullable();
                $table->string('industry')->nullable();
                $table->text('company_description')->nullable();
                $table->string('contact_person')->nullable();
                $table->string('contact_phone')->nullable();
                $table->string('company_website')->nullable();
                $table->integer('posted_projects')->default(0);
                $table->decimal('average_rating', 3, 2)->default(0);
                $table->timestamp('profile_completed_at')->nullable();
                $table->timestamps();
                $table->unique('user_id');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::connection('codemartv1')->dropIfExists('codemart_client_profiles');
        Schema::connection('codemartv1')->dropIfExists('codemart_developer_profiles');
        Schema::connection('codemartv1')->dropIfExists('codemart_user_roles');
        Schema::connection('codemartv1')->dropIfExists('codemart_kyc_verifications');
        Schema::connection('codemartv1')->dropIfExists('codemart_phone_verifications');
        Schema::connection('codemartv1')->dropIfExists('codemart_email_verifications');
    }
};
