<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Model;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

class AppQyV1ClientDeviceSettingsModel extends Model
{
    protected $appKey = AppKeys::APPQYV1;

    protected $fillable = [
        'client_key',
        'settings',
    ];

    protected $casts = [
        'settings' => 'array',
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'client_device_settings');
    }
}
