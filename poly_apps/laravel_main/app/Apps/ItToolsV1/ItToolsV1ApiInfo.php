<?php

namespace App\Apps\ItToolsV1;

use App\Apps\ItToolsV1\ItToolsV1Gvar\ItToolsV1ApiInfo as ItToolsV1GvarApiInfo;

/**
 * Per-app ApiInfo shell required by the main-layer aggregator
 * (App\Http\EnvironmentApiInfo\ApiInfoIndex resolves {App}\{App}ApiInfo).
 * Payload lives in the canonical ItToolsV1Gvar\ItToolsV1ApiInfo.
 */
class ItToolsV1ApiInfo
{
    public static function getApiInfo(): array
    {
        return ItToolsV1GvarApiInfo::getApiInfo();
    }
}
