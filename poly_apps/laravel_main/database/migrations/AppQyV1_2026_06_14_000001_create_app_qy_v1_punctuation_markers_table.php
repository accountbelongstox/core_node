<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Books Sentence/Word Model v2 - punctuation-marker reference table.
 *
 * Single source of truth lives in pycore/pyfoundations/punctuation_markers.py
 * (the `_MARKERS` list). This table mirrors that canonical set and is seeded
 * idempotently at sys:init (keyed on `code`, upsert, never clobber). The Books
 * pipeline stores sentences WITHOUT punctuation and reconstructs a book's flow
 * as an ordered sequence of sentence content-ids interleaved with these marker
 * codes. ASCII vs full-width glyphs are DISTINCT codes (reconstruction restores
 * the exact glyph).
 *
 * Idempotent via SafeMigrationHelper - re-running sys:init only ADDS missing
 * columns/indexes and NEVER drops data.
 */
return new class extends Migration
{
    protected $connection;
    protected $appKey;
    protected $tableName;

    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'punctuation_markers');
    }

    public function up(): void
    {
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'code' => ['type' => 'string', 'length' => 40, 'nullable' => false, 'unique' => true, 'comment' => 'Stable marker slug (matches punctuation_markers.py _MARKERS code)'],
                'char' => ['type' => 'string', 'length' => 8, 'nullable' => false, 'comment' => 'Exact glyph this marker represents'],
                'type' => ['type' => 'string', 'length' => 40, 'nullable' => false, 'comment' => 'Marker type (period|comma|...)'],
                'category' => ['type' => 'string', 'length' => 20, 'nullable' => false, 'index' => true, 'comment' => 'terminal|pause|structure'],
                'terminal' => ['type' => 'boolean', 'nullable' => false, 'default' => false, 'comment' => 'Whether it closes a sentence (drives book segmentation)'],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['code'], 'unique' => true],
                ['columns' => ['category']],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $this->tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists($this->tableName);
    }
};
