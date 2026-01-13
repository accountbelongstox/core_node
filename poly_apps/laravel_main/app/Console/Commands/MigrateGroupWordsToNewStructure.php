<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1GroupWordModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserWordProgressModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyWordModel;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

class MigrateGroupWordsToNewStructure extends Command
{
    protected $signature = 'appqyv1:migrate-group-words {--dry-run : Run without making changes}';
    protected $description = 'Migrate existing gwords data from word_groups to new relational structure';

    public function handle()
    {
        $isDryRun = $this->option('dry-run');

        if ($isDryRun) {
            $this->info('Running in DRY RUN mode - no changes will be made');
        }

        $this->info('Starting migration of group words to new structure...');

        $groups = AppQyV1WordGroupModel::whereNotNull('gwords')->get();

        $this->info("Found {$groups->count()} groups with words to migrate");

        $totalWordsProcessed = 0;
        $totalProgressCreated = 0;
        $errors = [];

        foreach ($groups as $group) {
            $this->info("Processing group: {$group->gname} (GID: {$group->gid})");

            $gwords = $group->gwords;

            if (is_string($gwords)) {
                $gwords = json_decode($gwords, true);
            }

            if (!is_array($gwords) || empty($gwords)) {
                $this->warn("  Skipping - no valid words found");
                continue;
            }

            $this->info("  Found " . count($gwords) . " words in group");

            $defaultLibrary = $this->ensureDefaultLibrary($group, $isDryRun);

            if (!$defaultLibrary) {
                $errors[] = "Failed to create default library for group {$group->gid}";
                continue;
            }

            foreach ($gwords as $wordContent) {
                if (empty($wordContent) || !is_string($wordContent)) {
                    continue;
                }

                $wordContent = trim($wordContent);

                $appKey = AppKeys::APPQYV1;
                // Use model connection for query builder (Laravel best practice)
                $wordModel = new AppQyV1VocabularyWordModel();
                $dbConnection = $wordModel->getConnection();
                $vocabularyWordsTable = AppTablePrefixServiceProvider::buildTableName($appKey, 'vocabulary_words');

                $vocabularyWord = $dbConnection
                    ->table($vocabularyWordsTable)
                    ->where('word', $wordContent)
                    ->where('library_id', $defaultLibrary->id)
                    ->first();

                if (!$vocabularyWord) {
                    if (!$isDryRun) {
                        $wordId = $dbConnection
                            ->table($vocabularyWordsTable)
                            ->insertGetId([
                                'library_id' => $defaultLibrary->id,
                                'word_index' => 0,
                                'word' => $wordContent,
                                'created_at' => now(),
                            ]);
                        $vocabularyWord = (object)['id' => $wordId, 'word' => $wordContent];
                    } else {
                        $this->line("  [DRY RUN] Would create vocabulary word: {$wordContent}");
                        continue;
                    }
                }

                $existingGroupWord = AppQyV1GroupWordModel::where('group_id', $group->id)
                    ->where('word_id', $vocabularyWord->id)
                    ->first();

                if (!$existingGroupWord) {
                    if (!$isDryRun) {
                        AppQyV1GroupWordModel::create([
                            'group_id' => $group->id,
                            'word_id' => $vocabularyWord->id,
                            'language_code' => $defaultLibrary->language,
                            'added_at' => now(),
                        ]);
                    } else {
                        $this->line("  [DRY RUN] Would create group_word link for: {$wordContent}");
                    }
                    $totalWordsProcessed++;
                }

                $existingProgress = AppQyV1UserWordProgressModel::where('user_id', $group->uid)
                    ->where('word_id', $vocabularyWord->id)
                    ->where('group_id', $group->id)
                    ->first();

                if (!$existingProgress) {
                    if (!$isDryRun) {
                        AppQyV1UserWordProgressModel::create([
                            'user_id' => $group->uid,
                            'word_id' => $vocabularyWord->id,
                            'group_id' => $group->id,
                            'language_code' => $defaultLibrary->language,
                            'weight' => strlen($wordContent),
                            'proficiency' => 0,
                            'read_count' => 0,
                            'review_count' => 0,
                        ]);
                    } else {
                        $this->line("  [DRY RUN] Would create progress record for: {$wordContent}");
                    }
                    $totalProgressCreated++;
                }
            }

            $this->info("  ✓ Processed {$group->gname}");
        }

        $this->newLine();
        $this->info('Migration Summary:');
        $this->info("  Groups processed: {$groups->count()}");
        $this->info("  Words migrated: {$totalWordsProcessed}");
        $this->info("  Progress records created: {$totalProgressCreated}");

        if (!empty($errors)) {
            $this->newLine();
            $this->error('Errors encountered:');
            foreach ($errors as $error) {
                $this->error("  - {$error}");
            }
        }

        if ($isDryRun) {
            $this->newLine();
            $this->warn('DRY RUN complete - no changes were made');
            $this->info('Run without --dry-run to apply changes');
        } else {
            $this->newLine();
            $this->info('Migration complete!');
        }

        return 0;
    }

    private function ensureDefaultLibrary($group, $isDryRun)
    {
        $libraryName = "Migrated Words - {$group->gname}";

        $appKey = AppKeys::APPQYV1;
        // Use model connection for query builder (Laravel best practice)
        $libraryModel = new AppQyV1VocabularyLibraryModel();
        $dbConnection = $libraryModel->getConnection();
        $vocabularyLibrariesTable = AppTablePrefixServiceProvider::buildTableName($appKey, 'vocabulary_libraries');

        $library = $dbConnection
            ->table($vocabularyLibrariesTable)
            ->where('name', $libraryName)
            ->where('owner_user_id', $group->uid)
            ->first();

        if (!$library) {
            if (!$isDryRun) {
                $libraryId = $dbConnection
                    ->table($vocabularyLibrariesTable)
                    ->insertGetId([
                        'name' => $libraryName,
                        'description' => 'Automatically created during migration from old group structure',
                        'language' => 'english',
                        'total_words' => 0,
                        'is_public' => false,
                        'owner_user_id' => $group->uid,
                        'source' => 'migration',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);

                $library = (object)[
                    'id' => $libraryId,
                    'name' => $libraryName,
                    'language' => 'english',
                ];
            } else {
                $this->line("  [DRY RUN] Would create library: {$libraryName}");
                return (object)[
                    'id' => 999999,
                    'name' => $libraryName,
                    'language' => 'english',
                ];
            }
        }

        return $library;
    }
}
