<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('CodeMartV1')->create('codemart_v1_reviewer_applications', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->enum('status', ['in_progress', 'passed', 'failed'])->default('in_progress');
            $table->text('test_cases');
            $table->text('user_reviews')->nullable();
            $table->decimal('similarity_score', 5, 2)->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index('user_id');
            $table->index('status');
        });

        Schema::connection('CodeMartV1')->create('codemart_v1_code_reviews', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('submission_id');
            $table->unsignedBigInteger('reviewer_id');
            $table->tinyInteger('quality_rating');
            $table->tinyInteger('readability_rating');
            $table->tinyInteger('efficiency_rating');
            $table->text('comments');
            $table->timestamps();

            $table->index('submission_id');
            $table->index('reviewer_id');
            $table->unique(['submission_id', 'reviewer_id']);
        });
    }

    public function down(): void
    {
        Schema::connection('CodeMartV1')->dropIfExists('codemart_v1_code_reviews');
        Schema::connection('CodeMartV1')->dropIfExists('codemart_v1_reviewer_applications');
    }
};
