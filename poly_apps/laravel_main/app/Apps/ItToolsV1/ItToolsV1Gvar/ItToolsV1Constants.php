<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\ItToolsV1\ItToolsV1Gvar;

class ItToolsV1Constants
{
    const ERR_PROCESSING_ERROR = 'PROCESSING_ERROR';
    const ERR_VALIDATION_ERROR = 'VALIDATION_ERROR';
    const ERR_INVALID_INPUT = 'INVALID_INPUT';

    const APP_NAME = 'ItToolsV1';
    const APP_VERSION = '1.0.0';
    const APP_PREFIX = '/api/ittools/v1';

    const ENCODING_TYPES = [
        'base64',
        'url',
        'html',
        'hex',
        'binary'
    ];

    const HASH_ALGORITHMS = [
        'md5',
        'sha1',
        'sha256',
        'sha512'
    ];

    const COLOR_FORMATS = [
        'hex',
        'rgb',
        'rgba',
        'hsl',
        'hsla'
    ];

    const TIMESTAMP_FORMATS = [
        'unix',
        'iso8601',
        'rfc2822',
        'mysql'
    ];
}
