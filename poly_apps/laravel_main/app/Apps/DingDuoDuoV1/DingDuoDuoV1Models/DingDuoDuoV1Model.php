<?php

namespace App\Apps\DingDuoDuoV1\DingDuoDuoV1Models;

use App\Apps\DingDuoDuoV1\DingDuoDuoV1DBTablesBrige\DingDuoDuoV1TableMaps;
use App\Constants\AppKeys;
use App\Models\AppModel;

abstract class DingDuoDuoV1Model extends AppModel
{
    protected ?string $appKey = AppKeys::DINGDUODUOV1;

    protected function appTableFromMapKey(string $mapKey): string
    {
        return DingDuoDuoV1TableMaps::getTableName($mapKey);
    }
}
