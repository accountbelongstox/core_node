<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Tasks table
        Schema::connection('CodeMartV1')->create('codemart_v1_tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('milestone_id')->constrained('codemart_v1_milestones')->onDelete('cascade');
            $table->string('title');
            $table->text('description');
            $table->enum('status', ['pending', 'in_progress', 'review', 'completed', 'blocked'])->default('pending');
            $table->enum('priority', ['low', 'medium', 'high', 'urgent'])->default('medium');
            $table->foreignId('assigned_to')->nullable()->constrained('users')->onDelete('set null');
            $table->datetime('due_date')->nullable();
            $table->json('deliverables')->nullable(); // Array of deliverable items
            $table->decimal('budget_allocation', 15, 2)->nullable();
            $table->integer('order')->default(0);
            $table->timestamps();
            $table->index('milestone_id');
            $table->index('assigned_to');
            $table->index('status');
        });

        // Task submissions (when developers submit completed tasks)
        Schema::connection('CodeMartV1')->create('codemart_v1_task_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained('codemart_v1_tasks')->onDelete('cascade');
            $table->foreignId('submitted_by')->constrained('users')->onDelete('cascade');
            $table->text('submission_note')->nullable();
            $table->json('files')->nullable(); // Array of file paths/IDs
            $table->enum('status', ['pending', 'approved', 'rejected', 'needs_revision'])->default('pending');
            $table->timestamps();
            $table->index('task_id');
            $table->index('submitted_by');
        });

        // Task comments
        Schema::connection('CodeMartV1')->create('codemart_v1_task_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained('codemart_v1_tasks')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->text('comment');
            $table->json('mentions')->nullable(); // @mentions
            $table->timestamps();
            $table->index('task_id');
            $table->index('user_id');
        });

        // Code reviews (for task submissions)
        Schema::connection('CodeMartV1')->create('codemart_v1_code_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_submission_id')->constrained('codemart_v1_task_submissions')->onDelete('cascade');
            $table->foreignId('reviewer_id')->constrained('users')->onDelete('cascade');
            $table->text('review_notes');
            $table->enum('status', ['approved', 'needs_revision', 'rejected'])->default('needs_revision');
            $table->integer('rating')->nullable(); // 1-5 rating
            $table->json('line_comments')->nullable(); // Per-line code review comments
            $table->timestamps();
            $table->index('task_submission_id');
            $table->index('reviewer_id');
        });
    }

    public function down(): void
    {
        Schema::connection('CodeMartV1')->dropIfExists('codemart_v1_code_reviews');
        Schema::connection('CodeMartV1')->dropIfExists('codemart_v1_task_comments');
        Schema::connection('CodeMartV1')->dropIfExists('codemart_v1_task_submissions');
        Schema::connection('CodeMartV1')->dropIfExists('codemart_v1_tasks');
    }
};
