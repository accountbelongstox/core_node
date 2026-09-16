<?php

use App\Utils\CloudClipboardInitializer;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        CloudClipboardInitializer::ensureTablesExist();
    }

    public function down(): void
    {
    }
};
