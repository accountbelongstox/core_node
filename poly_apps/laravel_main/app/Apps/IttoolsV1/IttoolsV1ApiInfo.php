<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\IttoolsV1;

class IttoolsV1ApiInfo
{
    public static function getApiInfo()
    {
        return [
            'supported_headers' => [
                'X-ITTools-Token' => 'ITTools authentication token (optional for most endpoints)',
                'X-Request-ID' => 'Request tracking ID for debugging'
            ],
            'endpoints' => [
                [
                    'path' => 'http://localhost/api/ittools/v1/text/encode',
                    'feature' => 'POST|Text encoding tool (Base64, URL encode, etc.)|IttoolsV1TextCtl@encode|params:text(string,required,Hello World),encoding_type(string,required,base64)|response:encoded_text(string),encoding_type(string)|tags:text,encoding,utility'
                ],
                [
                    'path' => 'http://localhost/api/ittools/v1/text/decode',
                    'feature' => 'POST|Text decoding tool|IttoolsV1TextCtl@decode|params:text(string,required,SGVsbG8gV29ybGQ=),encoding_type(string,required,base64)|response:decoded_text(string),encoding_type(string)|tags:text,decoding,utility'
                ],
                [
                    'path' => 'http://localhost/api/ittools/v1/hash/generate',
                    'feature' => 'POST|Generate hash from text|IttoolsV1HashCtl@generate|params:text(string,required,example),algorithm(string,required,md5)|response:hash(string),algorithm(string)|tags:hash,crypto,utility'
                ],
                [
                    'path' => 'http://localhost/api/ittools/v1/json/format',
                    'feature' => 'POST|Format and validate JSON|IttoolsV1JsonCtl@format|params:json_text(string,required,{"key":"value"}),indent_size(int,optional,2)|response:formatted_json(string),is_valid(boolean)|tags:json,format,utility'
                ],
                [
                    'path' => 'http://localhost/api/ittools/v1/uuid/generate',
                    'feature' => 'GET|Generate UUID|IttoolsV1UuidCtl@generate|params:version(int,optional,4),count(int,optional,1)|response:uuids(array)|tags:uuid,generator,utility'
                ],
                [
                    'path' => 'http://localhost/api/ittools/v1/timestamp/convert',
                    'feature' => 'POST|Convert timestamp formats|IttoolsV1TimestampCtl@convert|params:timestamp(string,required,1234567890),from_format(string,required,unix),to_format(string,required,iso8601)|response:converted_timestamp(string),timezone(string)|tags:timestamp,datetime,utility'
                ],
                [
                    'path' => 'http://localhost/api/ittools/v1/color/convert',
                    'feature' => 'POST|Convert color formats|IttoolsV1ColorCtl@convert|params:color(string,required,#FF5733),from_format(string,required,hex),to_format(string,required,rgb)|response:converted_color(string),formats(object)|tags:color,convert,utility'
                ],
                [
                    'path' => 'http://localhost/api/ittools/v1/regex/test',
                    'feature' => 'POST|Test regex patterns|IttoolsV1RegexCtl@test|params:pattern(string,required,^[a-z]+$),test_string(string,required,hello),flags(string,optional,i)|response:matches(boolean),matched_groups(array)|tags:regex,test,utility'
                ]
            ]
        ];
    }
}
