<?php

namespace App\Apps\PddToolV1\PddToolV1Models;

use App\Apps\PddToolV1\PddToolV1DBTablesBrige\PddToolV1TableMaps;
use App\Constants\AppKeys;
use App\Models\AppModel;

abstract class PddToolV1Model extends AppModel
{
    protected ?string $appKey = AppKeys::PDDTOOLV1;

    protected function appTableFromMapKey(string $mapKey): string
    {
        return PddToolV1TableMaps::getTableName($mapKey);
    }
}
