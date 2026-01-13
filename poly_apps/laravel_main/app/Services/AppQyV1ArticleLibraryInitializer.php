<?php

namespace App\Services;

use Illuminate\Support\Facades\Schema;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * Article Library Tables Initializer
 *
 * Creates and manages article library tables for all supported languages
 * Article library stores articles for TTS generation with metadata
 */
class AppQyV1ArticleLibraryInitializer
{
    /**
     * Check if article library tables exist
     * Tables are created automatically by 'php artisan sys:init' command
     * This method only checks table existence, does not create tables
     */
    public static function ensureTablesExist(): array
    {
        $results = [];
        $appKey = AppKeys::APPQYV1;
        $connection = AppTablePrefixServiceProvider::getConnection($appKey);
        $schema = Schema::connection($connection);

        $supportedLanguages = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getSupportedLanguages();

        foreach ($supportedLanguages as $langCode) {
            $tableName = AppTablePrefixServiceProvider::buildTableName($appKey, "{$langCode}_article_library");
            $exists = $schema->hasTable($tableName);
            $results[$tableName] = $exists ? 'exists' : 'missing';
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
