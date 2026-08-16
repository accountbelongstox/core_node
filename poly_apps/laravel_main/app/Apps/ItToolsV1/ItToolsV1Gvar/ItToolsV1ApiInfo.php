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

/**
 * IT Tools V1 API Information
 *
 * Canonical per-app ApiInfo for ItToolsV1. Collected by the main-layer
 * aggregator through the thin shell at App\Apps\ItToolsV1\ItToolsV1ApiInfo.
 */
class ItToolsV1ApiInfo
{
    public static function getApiInfo(): array
    {
        return [
            'name' => 'IT Tools',
            'namespace' => 'ittools',
            'version' => 'v1',
            'description' => 'Collection of 88+ handy online tools for developers',
            'baseUrl' => '/api/ittools/v1',
            'supported_headers' => [
                'Authorization' => 'Bearer token for authentication (optional for most endpoints)',
                'X-Request-ID' => 'Request tracking ID for debugging',
                'X-App-Namespace' => 'ittools',
                'Content-Type' => 'application/json',
                'Accept' => 'application/json'
            ],
            'endpoints' => [
                ['path' => '/api/ittools/v1/unified/encode', 'feature' => 'POST|Unified encoding (base64, url, hex)|params:type(string,required),input(string,required)|no_auth'],
                ['path' => '/api/ittools/v1/unified/decode', 'feature' => 'POST|Unified decoding|params:type(string,required),input(string,required)|no_auth'],
                ['path' => '/api/ittools/v1/unified/hash', 'feature' => 'POST|Generate hash|params:algorithm(string,required),input(string,required)|no_auth'],
                ['path' => '/api/ittools/v1/unified/hmac', 'feature' => 'POST|Generate HMAC|params:algorithm(string,required),input(string,required),key(string,required)|no_auth'],
                ['path' => '/api/ittools/v1/unified/uuid', 'feature' => 'POST|Generate UUID|params:version(number,optional)|no_auth'],
                ['path' => '/api/ittools/v1/unified/token', 'feature' => 'POST|Generate secure token|params:length(number,optional)|no_auth'],
                ['path' => '/api/ittools/v1/unified/case', 'feature' => 'POST|Convert text case|params:text(string,required),case(string,required)|no_auth'],
                ['path' => '/api/ittools/v1/unified/slugify', 'feature' => 'POST|Slugify text|params:text(string,required)|no_auth'],
                ['path' => '/api/ittools/v1/unified/color', 'feature' => 'POST|Convert color formats|params:color(string,required),from(string,required),to(string,required)|no_auth'],
                ['path' => '/api/ittools/v1/unified/password-analyze', 'feature' => 'POST|Analyze password strength|params:password(string,required)|no_auth'],
                ['path' => '/api/ittools/v1/unified/basic-auth', 'feature' => 'POST|Generate Basic Auth header|params:username(string,required),password(string,required)|no_auth'],

                ['path' => '/api/ittools/v1/crypto/hash', 'feature' => 'POST|Hash text with algorithm|params:text(string,required),algorithm(string,required,md5|sha1|sha256|sha512)|no_auth'],
                ['path' => '/api/ittools/v1/crypto/bcrypt/hash', 'feature' => 'POST|Bcrypt password hash|params:password(string,required),rounds(integer,optional,10)|no_auth'],
                ['path' => '/api/ittools/v1/crypto/bcrypt/verify', 'feature' => 'POST|Verify bcrypt hash|params:password(string,required),hash(string,required)|no_auth'],
                ['path' => '/api/ittools/v1/crypto/uuid/generate', 'feature' => 'POST|Generate UUID|params:count(integer,optional,1),uppercase(boolean,optional)|no_auth'],
                ['path' => '/api/ittools/v1/crypto/ulid/generate', 'feature' => 'POST|Generate ULID|params:count(integer,optional,1)|no_auth'],
                ['path' => '/api/ittools/v1/crypto/token/generate', 'feature' => 'POST|Generate random token|params:length(integer,optional,32),charset(string,optional),includeSymbols(boolean,optional),count(integer,optional,1)|no_auth'],
                ['path' => '/api/ittools/v1/crypto/rsa/generate', 'feature' => 'POST|Generate RSA key pair|params:keySize(integer,optional,2048,1024|2048|4096),format(string,optional,pem)|no_auth'],
                ['path' => '/api/ittools/v1/crypto/bip39/generate', 'feature' => 'POST|Generate BIP39 mnemonic|params:strength(integer,optional,128,128|160|192|224|256),count(integer,optional,1)|no_auth'],
                ['path' => '/api/ittools/v1/crypto/otp/generate', 'feature' => 'POST|Generate OTP|params:secret(string,optional),period(integer,optional,30),digits(integer,optional,6)|no_auth'],
                ['path' => '/api/ittools/v1/crypto/otp/verify', 'feature' => 'POST|Verify OTP|params:otp(string,required),secret(string,required),period(integer,optional,30),digits(integer,optional,6)|no_auth'],
                ['path' => '/api/ittools/v1/crypto/hmac', 'feature' => 'POST|Generate HMAC|params:text(string,required),secret(string,required),algorithm(string,required,sha1|sha256|sha512)|no_auth'],
                ['path' => '/api/ittools/v1/crypto/encrypt', 'feature' => 'POST|Encrypt text|params:text(string,required),key(string,required),algorithm(string,optional,aes-256-cbc)|no_auth'],
                ['path' => '/api/ittools/v1/crypto/decrypt', 'feature' => 'POST|Decrypt text|params:encrypted(string,required),key(string,required),algorithm(string,optional,aes-256-cbc)|no_auth'],

                ['path' => '/api/ittools/v1/converter/base64/encode', 'feature' => 'POST|Base64 encode|params:text(string,required)|no_auth'],
                ['path' => '/api/ittools/v1/converter/base64/decode', 'feature' => 'POST|Base64 decode|params:text(string,required)|no_auth'],
                ['path' => '/api/ittools/v1/converter/url/encode', 'feature' => 'POST|URL encode|params:text(string,required)|no_auth'],
                ['path' => '/api/ittools/v1/converter/url/decode', 'feature' => 'POST|URL decode|params:text(string,required)|no_auth'],
                ['path' => '/api/ittools/v1/converter/color', 'feature' => 'POST|Color format conversion|params:color(string,required),from(string,required),to(string,required)|no_auth'],
                ['path' => '/api/ittools/v1/converter/base', 'feature' => 'POST|Number base conversion|params:number(string,required),from(number,required),to(number,required)|no_auth'],
                ['path' => '/api/ittools/v1/converter/temperature', 'feature' => 'POST|Temperature conversion|params:value(number,required),from(string,required),to(string,required)|no_auth'],
                ['path' => '/api/ittools/v1/converter/json-to-yaml', 'feature' => 'POST|JSON to YAML|params:json(string,required)|no_auth'],
                ['path' => '/api/ittools/v1/converter/yaml-to-json', 'feature' => 'POST|YAML to JSON|params:yaml(string,required)|no_auth'],
                ['path' => '/api/ittools/v1/converter/json-to-csv', 'feature' => 'POST|JSON to CSV|params:json(string,required)|no_auth'],
                ['path' => '/api/ittools/v1/converter/json-to-xml', 'feature' => 'POST|JSON to XML|params:json(string,required)|no_auth'],
                ['path' => '/api/ittools/v1/converter/xml-to-json', 'feature' => 'POST|XML to JSON|params:xml(string,required)|no_auth'],

                ['path' => '/api/ittools/v1/web/json/prettify', 'feature' => 'POST|Prettify JSON|params:json(string,required),indent(integer,optional,2)|no_auth'],
                ['path' => '/api/ittools/v1/web/json/minify', 'feature' => 'POST|Minify JSON|params:json(string,required)|no_auth'],
                ['path' => '/api/ittools/v1/web/jwt/parse', 'feature' => 'POST|Parse JWT token|params:token(string,required)|no_auth'],
                ['path' => '/api/ittools/v1/web/qr-code/generate', 'feature' => 'POST|Generate QR code|params:text(string,required),size(integer,optional)|no_auth'],
                ['path' => '/api/ittools/v1/web/mime-types', 'feature' => 'GET|Get MIME types list|no_auth'],

                ['path' => '/api/ittools/v1/text/statistics', 'feature' => 'POST|Text statistics|params:text(string,required)|no_auth'],
                ['path' => '/api/ittools/v1/text/regex/test', 'feature' => 'POST|Test regex|params:text(string,required),pattern(string,required),flags(string,optional)|no_auth'],
                ['path' => '/api/ittools/v1/text/lorem-ipsum', 'feature' => 'POST|Generate lorem ipsum|params:paragraphs(integer,optional),words(integer,optional)|no_auth'],

                ['path' => '/api/ittools/v1/math/evaluate', 'feature' => 'POST|Evaluate math expression|params:expression(string,required)|no_auth'],
                ['path' => '/api/ittools/v1/math/percentage', 'feature' => 'POST|Calculate percentage|params:value(number,required),total(number,required)|no_auth'],

                ['path' => '/api/ittools/v1/network/ipv4/subnet', 'feature' => 'POST|IPv4 subnet calculator|params:ip(string,required),cidr(number,required)|no_auth'],
                ['path' => '/api/ittools/v1/network/mac/generate', 'feature' => 'POST|Generate MAC address|no_auth'],

                ['path' => '/api/ittools/v1/advanced/image/resize', 'feature' => 'POST|Resize image|params:image(file,required),width(integer,required),height(integer,required)|no_auth'],
                ['path' => '/api/ittools/v1/advanced/calculator/age', 'feature' => 'POST|Calculate age|params:birthDate(string,required)|no_auth'],
                ['path' => '/api/ittools/v1/advanced/calculator/bmi', 'feature' => 'POST|Calculate BMI|params:weight(number,required),height(number,required)|no_auth'],
            ]
        ];
    }
}
