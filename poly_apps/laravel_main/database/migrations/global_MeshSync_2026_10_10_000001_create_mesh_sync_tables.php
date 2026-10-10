<?php

use App\Apps\MeshSync\MeshSyncServices\MeshSyncInitializer;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        MeshSyncInitializer::ensureTablesExist();
    }

    public function down(): void
    {
    }
};
