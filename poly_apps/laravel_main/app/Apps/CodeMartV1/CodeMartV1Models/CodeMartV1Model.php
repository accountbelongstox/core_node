<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Constants\AppKeys;
use App\Models\AppModel;

abstract class CodeMartV1Model extends AppModel
{
    protected ?string $appKey = AppKeys::CODEMARTV1;
}
