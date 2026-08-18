<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Constants\AppKeys;
use App\Models\AppModel;

abstract class AppQyV1Model extends AppModel
{
    protected ?string $appKey = AppKeys::APPQYV1;

    protected function appTableFromMapKey(string $mapKey): string
    {
        return AppQyV1TableMaps::getTableName($mapKey);
    }
}
