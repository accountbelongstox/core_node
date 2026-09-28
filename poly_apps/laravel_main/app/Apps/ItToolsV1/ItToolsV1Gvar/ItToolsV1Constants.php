<?php

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
