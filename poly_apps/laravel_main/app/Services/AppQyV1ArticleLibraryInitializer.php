<?php

namespace App\Services;

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Article Library Tables Initializer
 *
 * Creates and manages the per-language article library tables
 * ({prefix}_{lang}_article_library) used for article TTS generation, storage and
 * management. Schema mirrors App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleLibraryModel.
 */
class AppQyV1ArticleLibraryInitializer
{
    /**
     * Idempotently CREATE the per-language article library tables (one per
     * supported language). hasTable() guard makes this safe to run on every
     * sys:init; existing tables are left untouched (no data loss). Mirrors
     * UserSyncService::ensureMultiLangDictionaryTablesExist().
     *
     * @return array<string,string> table => 'created' | 'exists'
     */
    public static function ensureTablesExist(): array
    {
        $results = [];
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $schema = Schema::connection($connection);

        $supportedLanguages = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getSupportedLanguages();

        // Canonical structure (mirrors AppQyV1ArticleLibraryModel $fillable + $casts).
        // One spec, reused for every language table -> the shared helper creates it
        // when missing AND ALTER-adds any column/index added later in code, on every
        // already-existing table, add-only (never drop/rewrite/touch existing rows).
        $structure = [
            'columns' => [
                'id'           => ['type' => 'bigIncrements'],
                'content'      => ['type' => 'text'],
                'md5'          => ['type' => 'string', 'length' => 32, 'unique' => true],
                'title'        => ['type' => 'string', 'nullable' => true],
                'source'       => ['type' => 'string', 'nullable' => true, 'index' => true],
                'owner'        => ['type' => 'string', 'nullable' => true, 'index' => true],
                'has_audio'    => ['type' => 'boolean', 'default' => false, 'index' => true],
                'audio_files'  => ['type' => 'text', 'nullable' => true],
                'tts_provider' => ['type' => 'string', 'nullable' => true],
                'metadata'     => ['type' => 'text', 'nullable' => true],
                'added_at'     => ['type' => 'dateTime', 'nullable' => true],
                'created_at'   => ['type' => 'timestamp', 'nullable' => true],
                'updated_at'   => ['type' => 'timestamp', 'nullable' => true],
            ],
        ];

        foreach ($supportedLanguages as $langCode) {
            $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, "{$langCode}_article_library");

            $result = SafeMigrationHelper::alignTableStructureFromArray(
                $connection,
                $tableName,
                $structure,
                ['shrink_columns' => false, 'modify_columns' => false, 'add_indexes' => true]
            );

            $status = $result['status'] ?? 'error';
            $results[$tableName] = $status === 'aligned' ? 'exists' : $status; // created|updated|exists
        }

        return $results;
    }

    public static function getTableStats(): array
    {
        try {
            $appKey = AppKeys::APPQYV1;
            $connection = AppTablePrefixServiceProvider::getConnection($appKey);
            $supportedLanguages = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getSupportedLanguages();

            $byLanguage = [];
            $totalArticles = 0;
            $totalWithAudio = 0;
            $totalWithoutAudio = 0;

            foreach ($supportedLanguages as $langCode) {
                $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, "{$langCode}_article_library");

                if (!Schema::connection($connection)->hasTable($tableName)) {
                    continue;
                }

                $articleModel = \App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleLibraryModel::forLanguage($langCode);
                $total = $articleModel->count();
                $withAudio = $articleModel->where('has_audio', true)->count();

                $withoutAudio = $total - $withAudio;

                $byLanguage[$langCode] = [
                    'total' => $total,
                    'with_audio' => $withAudio,
                    'without_audio' => $withoutAudio,
                ];

                $totalArticles += $total;
                $totalWithAudio += $withAudio;
                $totalWithoutAudio += $withoutAudio;
            }

            return [
                'by_language' => $byLanguage,
                'total_articles' => $totalArticles,
                'total_with_audio' => $totalWithAudio,
                'total_without_audio' => $totalWithoutAudio,
            ];
        } catch (\Exception $e) {
            return ['error' => $e->getMessage()];
        }
    }

    public static function getLanguageSummary(string $langCode): array
    {
        try {
            $appKey = AppKeys::APPQYV1;
            $connection = AppTablePrefixServiceProvider::getConnection($appKey);
            $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, "{$langCode}_article_library");

            if (!Schema::connection($connection)->hasTable($tableName)) {
                return ['error' => 'Table not found'];
            }

            $articleModel = \App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleLibraryModel::forLanguage($langCode);
            $total = $articleModel->count();
            $withAudio = $articleModel->where('has_audio', true)->count();

            $byOwner = $articleModel->select('owner')
                ->selectRaw('COUNT(*) as count')
                ->groupBy('owner')
                ->pluck('count', 'owner')
                ->toArray();

            $bySource = $articleModel->select('source')
                ->selectRaw('COUNT(*) as count')
                ->groupBy('source')
                ->limit(10)
                ->pluck('count', 'source')
                ->toArray();

            return [
                'language' => $langCode,
                'total' => $total,
                'with_audio' => $withAudio,
                'without_audio' => $total - $withAudio,
                'by_owner' => $byOwner,
                'by_source' => $bySource,
            ];
        } catch (\Exception $e) {
            return ['error' => $e->getMessage()];
        }
    }
}
