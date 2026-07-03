<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

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
