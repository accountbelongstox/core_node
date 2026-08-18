<?php

namespace App\Models;

use App\Models\Concerns\BuildsModelPagination;
use App\Models\Concerns\HasModelOperations;
use Illuminate\Database\Eloquent\Model as EloquentModel;

abstract class Model extends EloquentModel
{
    use BuildsModelPagination, HasModelOperations;
}
