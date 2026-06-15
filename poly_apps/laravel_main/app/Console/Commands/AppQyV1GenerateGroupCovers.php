<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1WordGroupModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1CoverImageService;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

class AppQyV1GenerateGroupCovers extends Command
{
    protected $signature = 'app_qy_v1:generate-covers {--force : Regenerate even if cover already exists}';

    protected $description = 'Generate cover images for all word groups';

    public function handle(): int
    {
        $force = $this->option('force');

        $query = AppQyV1WordGroupModel::query();

        if (!$force) {
            $query->whereNull('cover_image_uuid');
        }

        $groups = $query->get();

        if ($groups->isEmpty()) {
            $this->info('No groups need cover images.');
            return 0;
        }

        $this->info("Generating cover images for {$groups->count()} groups...");

        $bar = $this->output->createProgressBar($groups->count());
        $bar->start();

        $successCount = 0;
        $errorCount = 0;

        $appKey = AppKeys::APPQYV1;
        $model = new AppQyV1WordGroupModel();
        $connection = $model->getConnection();
        // One JSON row per group: total_words caches the word-map key count.
        $progressTable = AppTablePrefixServiceProvider::buildTableName($appKey, 'group_word_progress');

        foreach ($groups as $group) {
            $category = AppQyV1CoverImageService::inferCategory($group->gname);

            $wordCount = (int) $connection
                ->table($progressTable)
                ->where('group_id', $group->id)
                ->value('total_words');

            $result = AppQyV1CoverImageService::generateGroupCover(
                $group->gname,
                $category,
                $wordCount,
                true
            );

            if ($result['success']) {
                $group->cover_image_uuid = $result['uuid'];
                $group->cover_category = $result['category'];
                $group->cover_url = $result['main']['url'];
                $group->thumbnail_url = $result['thumbnail']['url'] ?? null;
                $group->save();

                $successCount++;
            } else {
                $this->error("\nFailed for group {$group->gname}: " . ($result['error'] ?? 'Unknown error'));
                $errorCount++;
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);

        $this->info("✅ Successfully generated {$successCount} cover images");
        if ($errorCount > 0) {
            $this->warn("⚠️  {$errorCount} errors occurred");
        }

        return 0;
    }
}
