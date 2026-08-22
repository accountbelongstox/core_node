<?php

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1ArticleIdentityRepairService;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        AppQyV1ArticleIdentityRepairService::ensureSchema();
    }

    public function down(): void
    {
    }
};
