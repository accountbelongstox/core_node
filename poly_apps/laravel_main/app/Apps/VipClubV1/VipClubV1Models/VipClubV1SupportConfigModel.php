<?php

namespace App\Apps\VipClubV1\VipClubV1Models;

use Illuminate\Database\Eloquent\Model;
use App\Apps\VipClubV1\VipClubV1TablesMaps\VipClubV1TablesMap;

class VipClubV1SupportConfigModel extends Model
{
    protected $table;

    protected $fillable = [
        'phone',
        'email',
        'wechat',
        'whatsapp',
        'hours'
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->table = VipClubV1TablesMap::getTableName('SUPPORT_CONFIG');
    }

    public static function getConfig(): ?self
    {
        return self::first();
    }

    public static function updateConfig(array $data): self
    {
        $config = self::first();
        if (!$config) {
            $config = new self();
        }
        $config->fill($data);
        $config->save();
        return $config;
    }
}
