<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Drop the orphan {prefix}_user_vocabulary_selections table.
 *
 * It is a dead duplicate of the active user_selected_libraries table: no model,
 * no reader, no writer. Removed outright (dropIfExists). The canonical
 * per-user selected-library state lives in {prefix}_user_selected_libraries
 * (DO-NOT-TOUCH).
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
        // Neutralized: initialization never drops a table (empty or not).
        // The orphan table is left in place — dead, unread, harmless.
        return;
    }

    public function down(): void
    {
        // One-way: the orphan table carried no live data and is not recreated.
    }
};
