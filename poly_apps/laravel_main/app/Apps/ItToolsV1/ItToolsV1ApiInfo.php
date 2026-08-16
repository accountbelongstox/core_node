<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

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
