<?php

namespace App\Apps\AppQyV1\AppQyV1DBTablesBrige;

use App\Apps\AppQyV1\AppQyV1Models\Concerns\AppQyV1MediaGaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Services\SafeMigrationHelper;

/**
 * The one schema of the phrase pipeline tables (docs_fix/DESIGN_PHRASE_PIPELINE.md §3):
 * {prefix}_phrases_{lang}, {prefix}_sentence_phrases_{lang} and the phrase
 * columns of {prefix}_sentences_{lang} (merged into
 * MediaIngestTablesInitializer::sentenceLangStructure()).
 *
 * Used only by sys:init (the AppQyV1 phrase pipeline step and the align
 * migration). Add-only: missing tables, columns and indexes are created;
 * nothing is dropped or modified.
 */
final class AppQyV1PhraseTableSchema
{
    private const ALIGN_OPTIONS = ['shrink_columns' => false, 'modify_columns' => false, 'add_indexes' => true];

    /** Phrase-extraction state of a sentence row (phrase_status NULL = pending gap). */
    public const SENTENCE_PHRASE_COLUMNS = [
        'phrase_status' => ['type' => 'string', 'length' => 8, 'nullable' => true, 'comment' => 'NULL pending | done | none | failed'],
        'phrase_attempts' => ['type' => 'smallInteger', 'nullable' => false, 'default' => 0],
        'phrase_lease_id' => ['type' => 'string', 'length' => 32, 'nullable' => true, 'comment' => 'phrase extraction lease'],
        'phrase_lease_expires_at' => ['type' => 'dateTime', 'nullable' => true],
        'phrase_locked_by' => ['type' => 'string', 'length' => 100, 'nullable' => true],
        'phrase_priority' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
        'phrase_generated_at' => ['type' => 'dateTime', 'nullable' => true],
    ];

    private const PHRASE_COLUMNS = [
        'id' => ['type' => 'bigIncrements'],
        'content_id' => ['type' => 'char', 'length' => 32, 'nullable' => false, 'comment' => 'media_content_id(text)'],
        'text' => ['type' => 'string', 'length' => 200, 'nullable' => false, 'comment' => 'phrase as spoken'],
        'language' => ['type' => 'string', 'length' => 8, 'nullable' => false],
        'meaning' => ['type' => 'text', 'nullable' => true, 'comment' => 'gloss in phrase_pipeline.meaning_language; fill-missing'],
        'sentence_count' => ['type' => 'integer', 'nullable' => false, 'default' => 0, 'comment' => 'linked sentences (rank)'],
        'origin' => ['type' => 'string', 'length' => 16, 'nullable' => false, 'default' => 'ai', 'comment' => 'ai | adhoc (report-created)'],
        'source_model' => ['type' => 'string', 'length' => 120, 'nullable' => true],
        'audio' => ['type' => 'string', 'nullable' => true, 'comment' => 'relative path {lang}/{content_id}.mp3'],
        'has_audio' => ['type' => 'boolean', 'nullable' => false, 'default' => false],
        'audio_files' => ['type' => 'json', 'nullable' => true],
        'tts_status' => ['type' => 'string', 'length' => 20, 'nullable' => true],
        'tts_attempts' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
        'tts_error' => ['type' => 'text', 'nullable' => true],
        'tts_locked_at' => ['type' => 'dateTime', 'nullable' => true],
        'tts_locked_by' => ['type' => 'string', 'length' => 100, 'nullable' => true],
        'tts_lease_id' => ['type' => 'string', 'length' => 32, 'nullable' => true, 'comment' => 'work lease (queue_center_contract work_leases, lane phrase_audio)'],
        'tts_lease_expires_at' => ['type' => 'dateTime', 'nullable' => true],
        'tts_priority' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
        'tts_requested_at' => ['type' => 'dateTime', 'nullable' => true],
        'tts_completed_at' => ['type' => 'dateTime', 'nullable' => true],
        'created_at' => ['type' => 'timestamp', 'nullable' => true],
        'updated_at' => ['type' => 'timestamp', 'nullable' => true],
    ];

    private const LINK_COLUMNS = [
        'id' => ['type' => 'bigIncrements'],
        'sentence_content_id' => ['type' => 'char', 'length' => 32, 'nullable' => false],
        'phrase_content_id' => ['type' => 'char', 'length' => 32, 'nullable' => false],
        'ord' => ['type' => 'smallInteger', 'nullable' => false, 'default' => 0],
        'created_at' => ['type' => 'timestamp', 'nullable' => true],
    ];

    /**
     * Ensures every supported language's phrase and link tables plus the phrase indexes.
     *
     * @return array<string,string> table => align status (created|updated|aligned|error: ...)
     */
    public static function ensureAll(): array
    {
        $connection = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);
        $results = [];

        foreach (AppQyV1TableMaps::getSupportedLanguages() as $language) {
            $results += self::ensure($connection, (string) $language);
        }

        return $results;
    }

    /** @return array<string,string> table => align status */
    public static function ensure(string $connection, string $language): array
    {
        $tables = [
            AppQyV1TableMaps::getPhraseTableName($language) => self::phraseStructure($language),
            AppQyV1TableMaps::getSentencePhraseTableName($language) => self::sentencePhraseStructure($language),
        ];
        $results = [];

        foreach ($tables as $table => $structure) {
            try {
                $results[$table] = SafeMigrationHelper::alignTableStructureFromArray($connection, $table, $structure, self::ALIGN_OPTIONS)['status'] ?? 'aligned';
            } catch (\Throwable $e) {
                $results[$table] = 'error: ' . $e->getMessage();
            }
        }
        AppQyV1MediaGaps::ensurePhraseIndexes($connection, $language);

        return $results;
    }

    public static function phraseStructure(string $language): array
    {
        $idxHash = substr(md5(AppQyV1TableMaps::getPhraseTableName($language)), 0, 16);

        return [
            'columns' => self::PHRASE_COLUMNS,
            'indexes' => [
                ['columns' => ['content_id'], 'unique' => true, 'name' => 'uniq_phr_cid_' . $idxHash],
            ],
        ];
    }

    public static function sentencePhraseStructure(string $language): array
    {
        $idxHash = substr(md5(AppQyV1TableMaps::getSentencePhraseTableName($language)), 0, 16);

        return [
            'columns' => self::LINK_COLUMNS,
            'indexes' => [
                ['columns' => ['sentence_content_id', 'phrase_content_id'], 'unique' => true, 'name' => 'uniq_sphr_pair_' . $idxHash],
                ['columns' => ['phrase_content_id'], 'name' => 'idx_sphr_phrase_' . $idxHash],
            ],
        ];
    }

    private function __construct()
    {
    }
}
