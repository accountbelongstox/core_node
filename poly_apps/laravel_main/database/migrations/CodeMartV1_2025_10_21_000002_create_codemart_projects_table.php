<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::connection('codemartv1')->hasTable('codemart_v1_projects')) {
        Schema::connection('codemartv1')->create('codemart_v1_projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained('users')->onDelete('cascade');
            $table->string('title');
            $table->text('description');
            $table->enum('status', ['draft', 'open', 'in_progress', 'paused', 'completed', 'cancelled', 'archived'])->default('draft');
            $table->enum('complexity', ['simple', 'medium', 'complex', 'very_complex'])->default('medium');
            $table->decimal('budget', 15, 2);
            $table->enum('budget_type', ['fixed', 'hourly'])->default('fixed');
            $table->string('currency')->default('CNY');
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->json('skills')->nullable();
            $table->json('languages')->nullable();
            $table->json('frameworks')->nullable();
            $table->json('databases')->nullable();
            $table->json('reference_urls')->nullable();
            $table->integer('total_milestones')->default(0);
            $table->integer('completed_milestones')->default(0);
            $table->timestamps();
            $table->index('client_id');
            $table->index('status');
            $table->index('complexity');
        });
        }

        if (!Schema::connection('codemartv1')->hasTable('codemart_v1_project_proposals')) {
        Schema::connection('codemartv1')->create('codemart_v1_project_proposals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('codemart_v1_projects')->onDelete('cascade');
            $table->enum('status', ['draft', 'pending', 'approved', 'rejected', 'revised'])->default('pending');
            $table->json('recommended_tech_stack')->nullable();
            $table->json('suggested_team_composition')->nullable();
            $table->integer('estimated_duration')->nullable();
            $table->decimal('estimated_cost', 15, 2)->nullable();
            $table->json('cost_breakdown')->nullable();
            $table->text('ai_notes')->nullable();
            $table->timestamps();
            $table->unique('project_id');
        });
        }

        if (!Schema::connection('codemartv1')->hasTable('codemart_v1_milestones')) {
        Schema::connection('codemartv1')->create('codemart_v1_milestones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('codemart_v1_projects')->onDelete('cascade');
            $table->string('title');
            $table->text('description')->nullable();
            $table->enum('status', ['pending', 'in_progress', 'completed', 'failed', 'cancelled'])->default('pending');
            $table->integer('order')->default(0);
            $table->date('due_date');
            $table->decimal('budget', 15, 2);
            $table->json('deliverables')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->index(['project_id', 'order']);
            $table->index('status');
        });
        }

        if (!Schema::connection('codemartv1')->hasTable('codemart_v1_project_attachments')) {
        Schema::connection('codemartv1')->create('codemart_v1_project_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('codemart_v1_projects')->onDelete('cascade');
            $table->string('file_name');
            $table->string('original_name');
            $table->string('mime_type');
            $table->integer('size');
            $table->string('path');
            $table->foreignId('uploaded_by')->constrained('users')->onDelete('cascade');
            $table->timestamps();
            $table->index('project_id');
        });
        }
    }

    public function down(): void
    {
        Schema::connection('codemartv1')->dropIfExists('codemart_v1_project_attachments');
        Schema::connection('codemartv1')->dropIfExists('codemart_v1_milestones');
        Schema::connection('codemartv1')->dropIfExists('codemart_v1_project_proposals');
        Schema::connection('codemartv1')->dropIfExists('codemart_v1_projects');
    }
};
