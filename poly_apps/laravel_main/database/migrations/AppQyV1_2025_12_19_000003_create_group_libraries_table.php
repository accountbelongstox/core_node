<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

return new class extends Migration
{
    protected $connection;
    protected $appKey;
    
    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    public function up(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'group_libraries');
        if (!Schema::connection($this->connection)->hasTable($tableName)) {
            Schema::connection($this->connection)->create($tableName, function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('group_id')->comment('Group ID from word_groups table');
                $table->unsignedBigInteger('library_id')->comment('Library ID from vocabulary_libraries');
                $table->timestamp('added_at')->useCurrent()->comment('When library was added to group');
                $table->timestamps();

                $table->unique(['group_id', 'library_id'], 'unique_group_library');
                $table->index('group_id', 'idx_group_lib_group');
                $table->index('library_id', 'idx_group_lib_library');
            });
        }
    }

    public function down(): void
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'group_libraries');
        Schema::connection($this->connection)->dropIfExists($tableName);
    }
};
