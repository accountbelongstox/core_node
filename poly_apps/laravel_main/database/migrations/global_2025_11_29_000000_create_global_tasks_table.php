<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Skip - table creation is now handled by 2025_12_07_071446_add_worker_fields_to_global_tasks_table.php
        // This migration is kept for compatibility
    }

    public function down(): void
    {
        // Skip - table management is now handled by newer migration
    }
};
