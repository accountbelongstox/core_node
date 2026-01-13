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

    public function up()
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'user_selected_libraries');
        $collectionsTableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'vocabulary_collections');
        
        if (!Schema::connection($this->connection)->hasTable($tableName)) {
            Schema::connection($this->connection)->create($tableName, function (Blueprint $table) use ($collectionsTableName) {
                $table->id();
                $table->unsignedBigInteger('user_id')->nullable(false);
                $table->unsignedBigInteger('collection_id')->nullable(false);
                $table->string('lang_code', 10)->nullable(false);
                $table->boolean('is_active')->default(true);
                $table->timestamp('selected_at')->useCurrent();
                $table->timestamps();

                $table->foreign('collection_id')
                    ->references('id')
                    ->on($collectionsTableName)
                    ->onDelete('cascade');

                $table->index(['user_id', 'lang_code'], 'idx_selected_lib_user_lang');
                $table->index(['user_id', 'is_active'], 'idx_selected_lib_user_active');
                $table->unique(['user_id', 'collection_id'], 'unique_user_collection');
            });
        }
    }

    public function down()
    {
        $tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'user_selected_libraries');
        Schema::connection($this->connection)->dropIfExists($tableName);
    }
};
