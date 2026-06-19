<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Drop the orphan standalone {prefix}_user_languages table.
 *
 * Superseded by the users.learning_languages column (DO-NOT-TOUCH): no model,
 * no reader, no writer reference the standalone table. Removed outright
 * (dropIfExists). This does NOT touch the users.learning_languages column.
 */
return new class extends Migration
{
    protected $connection;
    protected $appKey;
    protected $prefix;

    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->prefix = AppTablePrefixServiceProvider::getPrefix($this->appKey);
    }

    public function up(): void
    {
        $table = $this->prefix . '_user_languages';
        Schema::connection($this->connection)->dropIfExists($table);
    }

    public function down(): void
    {
        // One-way: the orphan table carried no live data and is not recreated.
    }
};
