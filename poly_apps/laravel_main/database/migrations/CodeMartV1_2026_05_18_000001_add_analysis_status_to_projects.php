<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Adds the `analysis_status` column to the CodeMartV1 projects table.
 *
 * `analysis_status` is the project-side state of the AI analysis flow
 * (idle -> analyzing/revising -> completed/accepted). It was referenced by
 * CodeMartV1AIAnalysisCtl and the off-queue CodeMartV1AIAnalysisTask but no
 * migration ever created it, so the analyze -> complete state machine (and the
 * `analysis_status === 'analyzing'` re-entry guard) was a silent no-op.
 *
 * Idempotent: skips if the column already exists. Nullable string (not enum) so
 * it is safe to add to an already-populated table on any driver (sqlite/mysql).
 */
return new class extends Migration
{
    protected $connection;
    protected $appKey;
    protected $tableName;

    public function __construct()
    {
        $this->appKey = AppKeys::CODEMARTV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'projects');
    }

    public function up(): void
    {
        $schema = Schema::connection($this->connection);

        if (!$schema->hasTable($this->tableName)) {
            return;
        }

        if ($schema->hasColumn($this->tableName, 'analysis_status')) {
            return;
        }

        $schema->table($this->tableName, function (Blueprint $table) {
            $table->string('analysis_status')->nullable()->default(null)->after('status')->index();
        });
    }

    public function down(): void
    {
        $schema = Schema::connection($this->connection);

        if ($schema->hasTable($this->tableName) && $schema->hasColumn($this->tableName, 'analysis_status')) {
            $schema->table($this->tableName, function (Blueprint $table) {
                $table->dropColumn('analysis_status');
            });
        }
    }
};
