<?php

use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection;
    protected $tableName;

    public function __construct()
    {
        $this->connection = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);
        $this->tableName = AppTablePrefixServiceProvider::buildTableName(AppKeys::APPQYV1, 'sentence_word_playbacks');
    }

    public function up(): void
    {
        if (Schema::connection($this->connection)->hasTable($this->tableName)) {
            return;
        }
        Schema::connection($this->connection)->create($this->tableName, function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->string('client_key', 64)->index();
            $table->string('language', 16);
            $table->char('word_md5', 32);
            $table->unsignedInteger('play_count')->default(0);
            $table->timestamp('last_played_at')->nullable();
            $table->timestamps();
            $table->unique(['client_key', 'language', 'word_md5'], 'uniq_sentence_word_playback');
        });
    }

    public function down(): void
    {
        // Add-only migration.
    }
};
