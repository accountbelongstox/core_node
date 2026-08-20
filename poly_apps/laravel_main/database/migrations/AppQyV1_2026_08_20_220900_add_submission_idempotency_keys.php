<?php

use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Services\SafeMigrationHelper;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    protected $connection;

    protected $uploadedDocumentsTable;

    protected $translationEventsTable;

    public function __construct()
    {
        $this->connection = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);
        $this->uploadedDocumentsTable = AppTablePrefixServiceProvider::buildTableName(
            AppKeys::APPQYV1,
            'uploaded_documents'
        );
        $this->translationEventsTable = AppTablePrefixServiceProvider::buildTableName(
            AppKeys::APPQYV1,
            'translation_events'
        );
    }

    public function up(): void
    {
        $uploadedDocumentStructure = [
            'columns' => [
                'source_type' => [
                    'type' => 'string',
                    'length' => 40,
                    'nullable' => true,
                    'comment' => 'Stable producer resource type for idempotent ingestion',
                ],
                'source_key' => [
                    'type' => 'string',
                    'length' => 128,
                    'nullable' => true,
                    'comment' => 'Stable producer resource key for idempotent ingestion',
                ],
            ],
            'indexes' => [[
                'columns' => ['source_type', 'source_key'],
                'unique' => true,
                'name' => 'uq_app_qy_v1_uploaded_doc_source',
            ]],
        ];
        $translationEventStructure = [
            'columns' => [
                'deduplication_key' => [
                    'type' => 'string',
                    'length' => 128,
                    'nullable' => true,
                    'comment' => 'Persistent producer key for idempotent outbox append',
                ],
            ],
            'indexes' => [[
                'columns' => ['event', 'deduplication_key'],
                'unique' => true,
                'name' => 'uq_app_qy_v1_translation_evt_dedupe',
            ]],
        ];
        $options = [
            'shrink_columns' => false,
            'modify_columns' => true,
            'add_indexes' => true,
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $this->uploadedDocumentsTable,
            $uploadedDocumentStructure,
            $options
        );
        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $this->translationEventsTable,
            $translationEventStructure,
            $options
        );
    }

    public function down(): void
    {
    }
};
