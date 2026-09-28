<?php

namespace App\Apps\McpV1\McpV1Models;

use App\Constants\AppKeys;
use App\Models\AppModel;

abstract class McpV1Model extends AppModel
{
    protected ?string $appKey = AppKeys::MCPV1;
}
