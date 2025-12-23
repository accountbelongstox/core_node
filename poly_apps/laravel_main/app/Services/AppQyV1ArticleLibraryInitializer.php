<?php

namespace App\Services;

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;

/**
 * Article Library Tables Initializer
 *
 * Creates and manages article library tables for all supported languages
 * Article library stores articles for TTS generation with metadata
 */
class AppQyV1ArticleLibraryInitializer
{
    public static function ensureTablesExist(): array
    {
        $results = [];
        $connection = 'appqyv1';
        $schema = Schema::connection($connection);

        $supportedLanguages = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getSupportedLanguages();

        foreach ($supportedLanguages as $langCode) {
            $tableName = "app_qy_v1_{$langCode}_article_library";

            if (!$schema->hasTable($tableName)) {
                $schema->create($tableName, function (Blueprint $table) {
                    $table->id();
                    $table->text('content');
                    $table->string('md5', 32)->unique();
                    $table->string('title')->nullable();
                    $table->string('source', 255)->default('unknown');
                    $table->string('owner', 100)->default('system');
                    $table->boolean('has_audio')->default(false);
                    $table->json('audio_files')->nullable();
                    $table->string('tts_provider', 50)->nullable();
                    $table->json('metadata')->nullable();
                    $table->timestamp('added_at')->nullable();
                    $table->timestamps();

                    $table->index('md5');
                    $table->index('has_audio');
                    $table->index('owner');
                    $table->index('added_at');
                });

                $results[$tableName] = 'created';
            } else {
                if (!$schema->hasColumn($tableName, 'has_audio')) {
                    $schema->table($tableName, function (Blueprint $table) {
                        $table->boolean('has_audio')->default(false)->after('owner');
                        $table->index('has_audio');
                    });
                    $results[$tableName] = 'migrated';
                } else {
                    $results[$tableName] = 'exists';
                }
            }
        }

        return $results;
    }

    public static function getTableStats(): array
    {
        try {
            $connection = 'appqyv1';
            $supportedLanguages = \App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getSupportedLanguages();

            $byLanguage = [];
            $totalArticles = 0;
            $totalWithAudio = 0;
            $totalWithoutAudio = 0;

            foreach ($supportedLanguages as $langCode) {
                $tableName = "app_qy_v1_{$langCode}_article_library";

                if (!Schema::connection($connection)->hasTable($tableName)) {
                    continue;
                }

                $total = DB::connection($connection)
                    ->table($tableName)
                    ->count();

                $withAudio = DB::connection($connection)
                    ->table($tableName)
                    ->where('has_audio', true)
                    ->count();

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
            $connection = 'appqyv1';
            $tableName = "app_qy_v1_{$langCode}_article_library";

            if (!Schema::connection($connection)->hasTable($tableName)) {
                return ['error' => 'Table not found'];
            }

            $total = DB::connection($connection)
                ->table($tableName)
                ->count();

            $withAudio = DB::connection($connection)
                ->table($tableName)
                ->where('has_audio', true)
                ->count();

            $byOwner = DB::connection($connection)
                ->table($tableName)
                ->select('owner', DB::raw('COUNT(*) as count'))
                ->groupBy('owner')
                ->pluck('count', 'owner')
                ->toArray();

            $bySource = DB::connection($connection)
                ->table($tableName)
                ->select('source', DB::raw('COUNT(*) as count'))
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
