<?php

namespace App\Apps\ItToolsV1;

class ApiInfo
{
    public static function getInfo(): array
    {
        return [
            'appName' => 'ItToolsV1',
            'version' => 'v1',
            'description' => 'IT Tools API - 88+ Developer Utilities',
            'baseUrl' => '/api/it-tools/v1',

            'supportedHeaders' => [
                'Content-Type' => 'application/json',
                'Accept' => 'application/json'
            ],

            'apis' => [
                // Crypto & Security APIs
                [
                    'path' => '/crypto/hash',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Generate hash (MD5, SHA1, SHA256, SHA512)',
                    'params' => ['text' => 'string (required)', 'algorithm' => 'string (required, in: md5,sha1,sha256,sha512)']
                ],
                [
                    'path' => '/crypto/bcrypt/hash',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Hash password with bcrypt',
                    'params' => ['password' => 'string (required)', 'rounds' => 'integer (optional, default: 10)']
                ],
                [
                    'path' => '/crypto/bcrypt/verify',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Verify bcrypt password',
                    'params' => ['password' => 'string (required)', 'hash' => 'string (required)']
                ],
                [
                    'path' => '/crypto/uuid/generate',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Generate UUIDs',
                    'params' => ['count' => 'integer (optional, default: 1)', 'uppercase' => 'boolean (optional)']
                ],
                [
                    'path' => '/crypto/ulid/generate',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Generate ULIDs',
                    'params' => ['count' => 'integer (optional, default: 1)']
                ],
                [
                    'path' => '/crypto/token/generate',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Generate random tokens',
                    'params' => [
                        'length' => 'integer (optional, default: 32)',
                        'charset' => 'string (optional, in: alphanumeric,alphabetic,numeric,lowercase,uppercase,hex)',
                        'includeSymbols' => 'boolean (optional)',
                        'count' => 'integer (optional, default: 1)'
                    ]
                ],
                [
                    'path' => '/crypto/basic-auth',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Generate Basic Auth header',
                    'params' => ['username' => 'string (required)', 'password' => 'string (required)']
                ],
                [
                    'path' => '/crypto/hmac',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Generate HMAC signature',
                    'params' => ['text' => 'string (required)', 'secret' => 'string (required)', 'algorithm' => 'string (required, in: sha1,sha256,sha512)']
                ],
                [
                    'path' => '/crypto/rsa/generate',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Generate RSA key pair',
                    'params' => ['keySize' => 'integer (optional, in: 1024,2048,4096)', 'format' => 'string (optional, in: pem,pkcs8)']
                ],
                [
                    'path' => '/crypto/bip39/generate',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Generate BIP39 mnemonic phrases',
                    'params' => ['strength' => 'integer (optional, in: 128,160,192,224,256)', 'count' => 'integer (optional, max: 10)']
                ],
                [
                    'path' => '/crypto/otp/generate',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Generate OTP (One-Time Password)',
                    'params' => ['secret' => 'string (optional)', 'period' => 'integer (optional, default: 30)', 'digits' => 'integer (optional, in: 6,8)']
                ],
                [
                    'path' => '/crypto/otp/verify',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Verify OTP code',
                    'params' => ['otp' => 'string (required)', 'secret' => 'string (required)', 'period' => 'integer (optional)', 'digits' => 'integer (optional)']
                ],
                [
                    'path' => '/crypto/password/analyze',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Analyze password strength',
                    'params' => ['password' => 'string (required)']
                ],
                [
                    'path' => '/crypto/encrypt',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Encrypt text with AES',
                    'params' => ['text' => 'string (required)', 'key' => 'string (required)', 'algorithm' => 'string (optional, in: aes-128-cbc,aes-256-cbc,aes-128-gcm,aes-256-gcm)']
                ],
                [
                    'path' => '/crypto/decrypt',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Decrypt AES encrypted text',
                    'params' => ['encrypted' => 'string (required)', 'key' => 'string (required)', 'algorithm' => 'string (optional)']
                ],

                // Converter APIs
                [
                    'path' => '/converter/base64/encode',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Encode string to Base64',
                    'params' => ['text' => 'string (required)']
                ],
                [
                    'path' => '/converter/base64/decode',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Decode Base64 string',
                    'params' => ['encoded' => 'string (required)']
                ],
                [
                    'path' => '/converter/case',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Convert text case (camelCase, snake_case, etc.)',
                    'params' => ['text' => 'string (required)']
                ],
                [
                    'path' => '/converter/url/encode',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Encode URL',
                    'params' => ['url' => 'string (required)']
                ],
                [
                    'path' => '/converter/url/decode',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Decode URL',
                    'params' => ['encoded' => 'string (required)']
                ],
                [
                    'path' => '/converter/color',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Convert color formats (HEX, RGB, HSL, HSV, CMYK)',
                    'params' => ['color' => 'string (required, hex or rgb format)']
                ],
                [
                    'path' => '/converter/base',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Convert number bases (binary, octal, decimal, hex)',
                    'params' => ['value' => 'string (required)', 'from' => 'integer (required, in: 2,8,10,16)']
                ],
                [
                    'path' => '/converter/slugify',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Convert text to URL-friendly slug',
                    'params' => ['text' => 'string (required)', 'separator' => 'string (optional)', 'lowercase' => 'boolean (optional)']
                ],
                [
                    'path' => '/converter/json-to-yaml',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Convert JSON to YAML',
                    'params' => ['json' => 'string (required)']
                ],
                [
                    'path' => '/converter/yaml-to-json',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Convert YAML to JSON',
                    'params' => ['yaml' => 'string (required)']
                ],
                [
                    'path' => '/converter/json-to-csv',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Convert JSON to CSV',
                    'params' => ['json' => 'string (required)', 'delimiter' => 'string (optional)', 'includeHeaders' => 'boolean (optional)']
                ],
                [
                    'path' => '/converter/temperature',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Convert temperature units',
                    'params' => ['value' => 'number (required)', 'from' => 'string (required, in: celsius,fahrenheit,kelvin)']
                ],
                [
                    'path' => '/converter/roman/to-arabic',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Convert Roman numerals to Arabic',
                    'params' => ['roman' => 'string (required)']
                ],

                // Web Development APIs
                [
                    'path' => '/web/json/prettify',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Prettify JSON',
                    'params' => ['json' => 'string (required)', 'indent' => 'integer (optional, in: 2,4,8)']
                ],
                [
                    'path' => '/web/json/minify',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Minify JSON',
                    'params' => ['json' => 'string (required)']
                ],
                [
                    'path' => '/web/jwt/parse',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Parse JWT token',
                    'params' => ['token' => 'string (required)']
                ],
                [
                    'path' => '/web/html/encode',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Encode HTML entities',
                    'params' => ['html' => 'string (required)']
                ],
                [
                    'path' => '/web/html/decode',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Decode HTML entities',
                    'params' => ['encoded' => 'string (required)']
                ],
                [
                    'path' => '/web/json/diff',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Compare two JSON objects',
                    'params' => ['json1' => 'string (required)', 'json2' => 'string (required)']
                ],
                [
                    'path' => '/web/markdown/to-html',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Convert Markdown to HTML',
                    'params' => ['markdown' => 'string (required)', 'sanitize' => 'boolean (optional)']
                ],
                [
                    'path' => '/web/sql/format',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Format SQL queries',
                    'params' => ['sql' => 'string (required)', 'indent' => 'string (optional)', 'uppercase' => 'boolean (optional)']
                ],
                [
                    'path' => '/web/qr-code/generate',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Generate QR code',
                    'params' => ['text' => 'string (required)', 'size' => 'integer (optional, min: 100, max: 1000)', 'errorCorrection' => 'string (optional, in: L,M,Q,H)']
                ],
                [
                    'path' => '/web/yaml/format',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Format YAML',
                    'params' => ['yaml' => 'string (required)', 'indent' => 'integer (optional, in: 2,4)']
                ],
                [
                    'path' => '/web/xml/format',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Format XML',
                    'params' => ['xml' => 'string (required)', 'indent' => 'integer (optional, in: 2,4)']
                ],
                [
                    'path' => '/web/http/status',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Get HTTP status code information',
                    'params' => ['code' => 'integer (required, min: 100, max: 599)']
                ],
                [
                    'path' => '/web/mime-types',
                    'method' => 'GET',
                    'feature' => 'public',
                    'description' => 'List MIME types',
                    'params' => ['search' => 'string (optional)', 'extension' => 'string (optional)']
                ],
                [
                    'path' => '/web/meta-tags/generate',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Generate meta tags for SEO',
                    'params' => ['title' => 'string (required)', 'description' => 'string (required)', 'url' => 'string (optional)', 'image' => 'string (optional)', 'type' => 'string (optional, in: website,article,product)']
                ],
                [
                    'path' => '/web/svg/optimize',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Optimize SVG code',
                    'params' => ['svg' => 'string (required)', 'precision' => 'integer (optional, min: 1, max: 5)']
                ],

                // Text Processing APIs
                [
                    'path' => '/text/statistics',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Analyze text statistics',
                    'params' => ['text' => 'string (required)']
                ],
                [
                    'path' => '/text/regex/test',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Test regular expressions',
                    'params' => ['pattern' => 'string (required)', 'text' => 'string (required)', 'flags' => 'string (optional)']
                ],
                [
                    'path' => '/text/url/parse',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Parse URL components',
                    'params' => ['url' => 'string (required)']
                ],
                [
                    'path' => '/text/lorem-ipsum',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Generate Lorem Ipsum text',
                    'params' => ['count' => 'integer (optional, max: 100)', 'unit' => 'string (optional, in: words,sentences,paragraphs)', 'startWithLorem' => 'boolean (optional)']
                ],
                [
                    'path' => '/text/email/normalize',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Normalize email address',
                    'params' => ['email' => 'string (required)']
                ],
                [
                    'path' => '/text/numeronym',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Generate numeronym from text',
                    'params' => ['text' => 'string (required)']
                ],
                [
                    'path' => '/text/diff',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Compare two texts',
                    'params' => ['text1' => 'string (required)', 'text2' => 'string (required)', 'ignoreWhitespace' => 'boolean (optional)', 'ignoreCase' => 'boolean (optional)']
                ],
                [
                    'path' => '/text/ascii-art',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Generate ASCII art',
                    'params' => ['text' => 'string (required)', 'font' => 'string (optional, in: standard,banner,block)']
                ],
                [
                    'path' => '/text/crontab/parse',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Parse crontab expression',
                    'params' => ['expression' => 'string (required)']
                ],
                [
                    'path' => '/text/phone/parse',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Parse phone number',
                    'params' => ['phone' => 'string (required)', 'country' => 'string (optional, default: US)']
                ],
                [
                    'path' => '/text/iban/validate',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Validate IBAN number',
                    'params' => ['iban' => 'string (required)']
                ],
                [
                    'path' => '/text/safelink/encode',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Encode/decode safelink',
                    'params' => ['url' => 'string (required)', 'action' => 'string (required, in: encode,decode)']
                ],
                [
                    'path' => '/text/emoji/picker',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Search emoji',
                    'params' => ['search' => 'string (optional)', 'category' => 'string (optional, in: smileys,people,animals,food,travel,activities,objects,symbols,flags)']
                ],
                [
                    'path' => '/text/git/memo',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Generate Git commit message',
                    'params' => ['type' => 'string (required, in: feat,fix,docs,style,refactor,test,chore)', 'scope' => 'string (optional)', 'subject' => 'string (required)', 'body' => 'string (optional)', 'breaking' => 'boolean (optional)']
                ],

                // Math APIs
                [
                    'path' => '/math/evaluate',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Evaluate math expression',
                    'params' => ['expression' => 'string (required)', 'precision' => 'integer (optional)']
                ],
                [
                    'path' => '/math/percentage',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Calculate percentage',
                    'params' => ['value' => 'number (required)', 'total' => 'number (required)', 'operation' => 'string (optional, in: of,increase,decrease)']
                ],
                [
                    'path' => '/math/eta',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Calculate ETA (Estimated Time of Arrival)',
                    'params' => ['completed' => 'number (required)', 'total' => 'number (required)', 'elapsed' => 'number (required)']
                ],

                // Network APIs
                [
                    'path' => '/network/ipv4/convert',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Convert IPv4 address formats',
                    'params' => ['ip' => 'string (required)']
                ],
                [
                    'path' => '/network/ipv4/subnet',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Calculate IPv4 subnet',
                    'params' => ['ip' => 'string (required)', 'cidr' => 'integer (required)']
                ],
                [
                    'path' => '/network/ipv4/expand',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Expand IPv4 CIDR range',
                    'params' => ['cidr' => 'string (required)']
                ],
                [
                    'path' => '/network/mac/generate',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Generate MAC address',
                    'params' => ['count' => 'integer (optional, default: 1)', 'separator' => 'string (optional, in: colon,hyphen,none)']
                ],
                [
                    'path' => '/network/chmod',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Convert chmod permissions',
                    'params' => ['permissions' => 'string (required)']
                ],
                [
                    'path' => '/network/port/random',
                    'method' => 'POST',
                    'feature' => 'public',
                    'description' => 'Generate random port number',
                    'params' => ['min' => 'integer (optional, default: 1024)', 'max' => 'integer (optional, default: 65535)', 'count' => 'integer (optional, default: 1)']
                ]
            ]
        ];
    }
}
