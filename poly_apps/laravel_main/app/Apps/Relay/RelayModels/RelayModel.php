<?php

namespace App\Apps\Relay\RelayModels;

use App\Apps\Relay\RelayTablesMaps\RelayTablesMaps;
use Illuminate\Database\Eloquent\Model;

abstract class RelayModel extends Model
{
    protected $guarded = [];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->setConnection(RelayTablesMaps::connection());
        $this->setTable(RelayTablesMaps::table(static::tableMapKey()));
    }

    abstract protected static function tableMapKey(): string;
}
