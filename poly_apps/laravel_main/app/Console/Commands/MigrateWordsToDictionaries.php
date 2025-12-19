<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class MigrateWordsToDictionaries extends Command
{
    protected $signature = 'dict:migrate {--dry-run : Show what would be migrated without actually migrating}';

    protected $description = 'Migrate app_qy_v1_words_* tables to app_qy_v1_*_dictionaries tables';

    private $tableMappings = [
        'app_qy_v1_words_english' => 'app_qy_v1_en_dictionaries',
        'app_qy_v1_words_japanese' => 'app_qy_v1_ja_dictionaries',
        'app_qy_v1_words_lao' => 'app_qy_v1_lo_dictionaries',
        'app_qy_v1_words_vietnamese' => 'app_qy_v1_vi_dictionaries',
    ];

    public function handle()
    {
        $dryRun = $this->option('dry-run');
        $connection = 'appqyv1';

        if ($dryRun) {
            $this->warn('DRY RUN MODE - No data will be migrated');
            $this->newLine();
        }

        $this->info('Starting dictionary migration...');
        $this->newLine();

        $totalProcessed = 0;

        foreach ($this->tableMappings as $oldTable => $newTable) {
            $this->line("<fg=cyan;options=bold>Migrating {$oldTable} → {$newTable}</>");

            try {
                $count = DB::connection($connection)->table($oldTable)->count();
                $this->line("  📊 Source records: <fg=yellow>{$count}</>");

                if ($count === 0) {
                    $this->line("  ⏭️  Skipped (no data)");
                    $this->newLine();
                    continue;
                }

                $existingCount = DB::connection($connection)->table($newTable)->count();
                if ($existingCount > 0) {
                    $this->warn("  ⚠️  Target table already has {$existingCount} records");
                    if (!$this->confirm("  Do you want to continue and merge data?", false)) {
                        $this->line("  ⏭️  Skipped by user");
                        $this->newLine();
                        continue;
                    }
                }

                if ($dryRun) {
                    $this->line("  ✓ Would migrate {$count} records");
                    $this->newLine();
                    continue;
                }

                $processed = $this->migrateTable($oldTable, $newTable, $connection);
                $totalProcessed += $processed;

                $this->line("  ✅ Migrated <fg=green>{$processed}</> records");
                $this->newLine();

            } catch (\Exception $e) {
                $this->error("  ❌ Error: " . $e->getMessage());
                $this->newLine();
            }
        }

        if (!$dryRun) {
            $this->info("✅ Migration completed! Total processed: {$totalProcessed} records");
        } else {
            $this->info("Dry run completed. Use without --dry-run to actually migrate data.");
        }

        return 0;
    }

    private function migrateTable(string $oldTable, string $newTable, string $connection): int
    {
        $batchSize = 1000;
        $processed = 0;

        DB::connection($connection)->table($oldTable)
            ->orderBy('id')
            ->chunk($batchSize, function ($records) use ($newTable, $connection, &$processed) {
                $insertData = [];

                foreach ($records as $record) {
                    $md5 = md5($record->word);

                    $existing = DB::connection($connection)
                        ->table($newTable)
                        ->where('content', $record->word)
                        ->where('md5', $md5)
                        ->exists();

                    if ($existing) {
                        continue;
                    }

                    $insertData[] = [
                        'content' => $record->word,
                        'md5' => $md5,
                        'translations' => $record->translation,
                        'has_translation' => !empty($record->translation) ? 1 : 0,
                        'us_phonetic' => $record->us_phonetic,
                        'uk_phonetic' => $record->uk_phonetic,
                        'image_files' => $record->sample_images,
                        'created_at' => $record->created_at ?? now(),
                        'updated_at' => $record->updated_at ?? now(),
                    ];
                }

                if (!empty($insertData)) {
                    DB::connection($connection)->table($newTable)->insert($insertData);
                    $processed += count($insertData);
                    $this->line("    Processed: {$processed}");
                }
            });

        return $processed;
    }
}
