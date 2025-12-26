<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('codemartv1')->create('codemart_v1_developer_stats', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->unique();
            $table->integer('completed_projects')->default(0);
            $table->decimal('avg_code_score', 5, 2)->default(0);
            $table->decimal('avg_client_satisfaction', 3, 2)->default(0);
            $table->decimal('total_earnings', 10, 2)->default(0);
            $table->decimal('on_time_delivery_rate', 5, 2)->default(0);
            $table->timestamps();

            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::connection('codemartv1')->dropIfExists('codemart_v1_developer_stats');
    }
};
