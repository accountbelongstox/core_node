<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('CodeMartV1')->create('codemart_v1_ai_analyses', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('project_id');
            $table->enum('status', ['processing', 'completed', 'revising', 'failed'])->default('processing');
            $table->text('keywords')->nullable();
            $table->text('recommended_languages')->nullable();
            $table->text('recommended_frameworks')->nullable();
            $table->text('recommended_databases')->nullable();
            $table->text('team_composition')->nullable();
            $table->integer('estimated_hours')->nullable();
            $table->decimal('estimated_cost', 10, 2)->nullable();
            $table->decimal('complexity_score', 5, 2)->nullable();
            $table->text('proposal')->nullable();
            $table->text('revision_notes')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();

            $table->index('project_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::connection('CodeMartV1')->dropIfExists('codemart_v1_ai_analyses');
    }
};
