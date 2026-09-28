<?php

namespace App\Apps\DingDuoDuoV1\DingDuoDuoV1Enums;

/**
 * License resolution mode returned by DingDuoDuoV1LicenseService::resolveByToken.
 * The Chrome extension maps the `mode` value to decide its unlock state.
 */
enum DingDuoDuoV1LicenseMode: string
{
    case Super = 'super';
    case Member = 'member';
    case Locked = 'locked';
}
