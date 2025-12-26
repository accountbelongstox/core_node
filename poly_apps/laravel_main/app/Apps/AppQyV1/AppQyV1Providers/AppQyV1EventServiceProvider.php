<?php

namespace App\Apps\AppQyV1\AppQyV1Providers;

use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserWordProgressModel;
use App\Apps\AppQyV1\AppQyV1Observers\AppQyV1UserWordProgressObserver;

class AppQyV1EventServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        AppQyV1UserWordProgressModel::observe(AppQyV1UserWordProgressObserver::class);
    }
}
