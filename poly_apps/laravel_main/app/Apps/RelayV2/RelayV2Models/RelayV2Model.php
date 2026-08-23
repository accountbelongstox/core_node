<?php

namespace App\Apps\RelayV2\RelayV2Models;

use App\Apps\RelayV2\RelayV2TablesMaps\RelayV2TablesMaps;
use Illuminate\Database\Eloquent\Model;

abstract class RelayV2Model extends Model
{
    protected $guarded = [];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->setConnection(RelayV2TablesMaps::connection());
        $this->setTable(RelayV2TablesMaps::table(static::tableMapKey()));
    }

    abstract protected static function tableMapKey(): string;
}
