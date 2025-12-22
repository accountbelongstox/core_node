<?php

namespace App\Apps\AppQyV1\AppQyV1Observers;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserWordProgressModel;

class AppQyV1UserWordProgressObserver
{
    public function creating(AppQyV1UserWordProgressModel $progress): void
    {
        if ($progress->first_read_at === null && $progress->read_count > 0) {
            $progress->first_read_at = now();
        }
    }

    public function updating(AppQyV1UserWordProgressModel $progress): void
    {
        if ($progress->isDirty('proficiency') ||
            $progress->isDirty('review_count') ||
            $progress->isDirty('read_count')) {
            $progress->calculateNextReviewTime();
        }

        if ($progress->isDirty('read_count') && $progress->read_count > 0 && $progress->first_read_at === null) {
            $progress->first_read_at = now();
        }
    }
}
