<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use App\Services\SafeMigrationHelper;

/**
 * Laravel AI SDK conversation persistence (agent_conversations +
 * agent_conversation_messages) — the exact schema shipped by laravel/ai,
 * expressed through SafeMigrationHelper so sys:init stays idempotent
 * (create-if-missing, add-missing-columns, never drop).
 */
return new class extends Migration
{
    protected $connection = null;

    public function up(): void
    {
        $connection = $this->connection ?? config('database.default');

        SafeMigrationHelper::alignTableStructure(
            $connection,
            config('ai.conversations.tables.conversations', 'agent_conversations'),
            function (Blueprint $table) {
                $table->string('id', 36)->primary();
                $table->string('participant_type')->nullable();
                $table->unsignedBigInteger('participant_id')->nullable();
                $table->string('title');
                $table->timestamps();

                $table->index(['participant_type', 'participant_id', 'updated_at'], 'participant_updated_at_index');
            },
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );

        SafeMigrationHelper::alignTableStructure(
            $connection,
            config('ai.conversations.tables.messages', 'agent_conversation_messages'),
            function (Blueprint $table) {
                $table->string('id', 36)->primary();
                $table->string('conversation_id', 36)->index();
                $table->string('participant_type')->nullable();
                $table->unsignedBigInteger('participant_id')->nullable();
                $table->string('agent');
                $table->string('role', 25);
                $table->text('content');
                $table->text('attachments');
                $table->text('tool_calls');
                $table->text('tool_results');
                $table->text('usage');
                $table->text('meta');
                $table->text('approval_state')->nullable();
                $table->timestamps();

                $table->index(['conversation_id', 'participant_type', 'participant_id', 'updated_at'], 'conversation_index');
                $table->index(['participant_type', 'participant_id'], 'participant_index');
            },
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }

    public function down(): void
    {
        // Idempotent extensions never drop tables or data.
    }
};
