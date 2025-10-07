// Tools Data and Implementations

function getToolsData() {
    return [
        // ==================== CRYPTO & SECURITY ====================
        {
            id: 'token_generator',
            name: 'Token Generator',
            description: 'Generate random tokens with custom length and charset',
            category: 'crypto',
            icon: '<i class="fas fa-key"></i>',
            endpoint: '/crypto/token/generate',
            keywords: ['random', 'token', 'password', 'generate']
        },
        {
            id: 'hash_text',
            name: 'Hash Text',
            description: 'Generate MD5, SHA1, SHA256, SHA512 hashes',
            category: 'crypto',
            icon: '<i class="fas fa-hashtag"></i>',
            endpoint: '/crypto/hash',
            keywords: ['hash', 'md5', 'sha256', 'checksum']
        },
        {
            id: 'bcrypt',
            name: 'Bcrypt',
            description: 'Hash and verify passwords with bcrypt',
            category: 'crypto',
            icon: '<i class="fas fa-lock"></i>',
            endpoint: '/crypto/bcrypt/hash',
            keywords: ['bcrypt', 'password', 'hash', 'verify']
        },
        {
            id: 'uuid_generator',
            name: 'UUID Generator',
            description: 'Generate v4 UUIDs',
            category: 'crypto',
            icon: '<i class="fas fa-fingerprint"></i>',
            endpoint: '/crypto/uuid/generate',
            keywords: ['uuid', 'guid', 'unique', 'identifier']
        },
        {
            id: 'ulid_generator',
            name: 'ULID Generator',
            description: 'Generate ULIDs (Universally Unique Lexicographically Sortable Identifiers)',
            category: 'crypto',
            icon: '<i class="fas fa-barcode"></i>',
            endpoint: '/crypto/ulid/generate',
            keywords: ['ulid', 'unique', 'sortable']
        },
        {
            id: 'encryption',
            name: 'Encryption',
            description: 'Encrypt and decrypt text using various algorithms',
            category: 'crypto',
            icon: '<i class="fas fa-user-secret"></i>',
            endpoint: '/crypto/encrypt',
            keywords: ['encrypt', 'decrypt', 'aes', 'cipher']
        },
        {
            id: 'bip39_generator',
            name: 'BIP39 Generator',
            description: 'Generate BIP39 mnemonic phrases',
            category: 'crypto',
            icon: '<i class="fas fa-wallet"></i>',
            endpoint: '/crypto/bip39/generate',
            keywords: ['bip39', 'mnemonic', 'seed', 'wallet']
        },
        {
            id: 'basic_auth_generator',
            name: 'Basic Auth Generator',
            description: 'Generate basic authentication headers',
            category: 'crypto',
            icon: '<i class="fas fa-user-lock"></i>',
            endpoint: '/crypto/basic-auth',
            keywords: ['basic', 'auth', 'authorization', 'header']
        },
        {
            id: 'rsa_key_pair',
            name: 'RSA Key Pair Generator',
            description: 'Generate RSA public/private key pairs',
            category: 'crypto',
            icon: '<i class="fas fa-key"></i>',
            endpoint: '/crypto/rsa/generate',
            keywords: ['rsa', 'public key', 'private key', 'keypair']
        },
        {
            id: 'hmac_generator',
            name: 'HMAC Generator',
            description: 'Generate HMAC signatures',
            category: 'crypto',
            icon: '<i class="fas fa-signature"></i>',
            endpoint: '/crypto/hmac',
            keywords: ['hmac', 'signature', 'hash']
        },
        {
            id: 'otp_generator',
            name: 'OTP Code Generator',
            description: 'Generate and validate OTP codes (TOTP/HOTP)',
            category: 'crypto',
            icon: '<i class="fas fa-mobile-alt"></i>',
            endpoint: '/crypto/otp/generate',
            keywords: ['otp', 'totp', 'hotp', '2fa', 'authenticator']
        },
        {
            id: 'password_strength',
            name: 'Password Strength Analyzer',
            description: 'Analyze password strength and get improvement suggestions',
            category: 'crypto',
            icon: '<i class="fas fa-shield-alt"></i>',
            endpoint: '/crypto/password/analyze',
            keywords: ['password', 'strength', 'security', 'analyze']
        },

        // ==================== CONVERTERS ====================
        {
            id: 'base64_string',
            name: 'Base64 String Converter',
            description: 'Encode/decode base64 strings',
            category: 'converter',
            icon: '<i class="fas fa-exchange-alt"></i>',
            endpoint: '/converter/base64/encode',
            keywords: ['base64', 'encode', 'decode']
        },
        {
            id: 'base64_file',
            name: 'Base64 File Converter',
            description: 'Convert files to/from base64',
            category: 'converter',
            icon: '<i class="fas fa-file-code"></i>',
            endpoint: '/converter/base64/file/encode',
            keywords: ['base64', 'file', 'convert']
        },
        {
            id: 'color_converter',
            name: 'Color Converter',
            description: 'Convert between HEX, RGB, HSL, HSV, CMYK',
            category: 'converter',
            icon: '<i class="fas fa-palette"></i>',
            endpoint: '/converter/color',
            keywords: ['color', 'hex', 'rgb', 'hsl', 'cmyk']
        },
        {
            id: 'case_converter',
            name: 'Case Converter',
            description: 'Convert text case (camelCase, snake_case, etc.)',
            category: 'converter',
            icon: '<i class="fas fa-font"></i>',
            endpoint: '/converter/case',
            keywords: ['case', 'camel', 'snake', 'kebab', 'pascal']
        },
        {
            id: 'datetime_converter',
            name: 'Date Time Converter',
            description: 'Convert between date formats and timestamps',
            category: 'converter',
            icon: '<i class="fas fa-calendar-alt"></i>',
            endpoint: '/converter/datetime',
            keywords: ['date', 'time', 'timestamp', 'unix']
        },
        {
            id: 'base_converter',
            name: 'Integer Base Converter',
            description: 'Convert between binary, octal, decimal, hexadecimal',
            category: 'converter',
            icon: '<i class="fas fa-calculator"></i>',
            endpoint: '/converter/base',
            keywords: ['binary', 'hex', 'octal', 'decimal', 'base']
        },
        {
            id: 'roman_numeral',
            name: 'Roman Numeral Converter',
            description: 'Convert between Roman and Arabic numerals',
            category: 'converter',
            icon: '<i class="fas fa-font"></i>',
            endpoint: '/converter/roman/to-arabic',
            keywords: ['roman', 'numeral', 'arabic', 'number']
        },
        {
            id: 'temperature',
            name: 'Temperature Converter',
            description: 'Convert Celsius, Fahrenheit, Kelvin',
            category: 'converter',
            icon: '<i class="fas fa-thermometer-half"></i>',
            endpoint: '/converter/temperature',
            keywords: ['temperature', 'celsius', 'fahrenheit', 'kelvin']
        },
        {
            id: 'json_to_yaml',
            name: 'JSON to YAML',
            description: 'Convert JSON to YAML format',
            category: 'converter',
            icon: '<i class="fas fa-code"></i>',
            endpoint: '/converter/json-to-yaml',
            keywords: ['json', 'yaml', 'convert']
        },
        {
            id: 'yaml_to_json',
            name: 'YAML to JSON',
            description: 'Convert YAML to JSON format',
            category: 'converter',
            icon: '<i class="fas fa-code"></i>',
            endpoint: '/converter/yaml-to-json',
            keywords: ['yaml', 'json', 'convert']
        },
        {
            id: 'json_to_xml',
            name: 'JSON to XML',
            description: 'Convert JSON to XML format',
            category: 'converter',
            icon: '<i class="fas fa-code"></i>',
            endpoint: '/converter/json-to-xml',
            keywords: ['json', 'xml', 'convert']
        },
        {
            id: 'xml_to_json',
            name: 'XML to JSON',
            description: 'Convert XML to JSON format',
            category: 'converter',
            icon: '<i class="fas fa-code"></i>',
            endpoint: '/converter/xml-to-json',
            keywords: ['xml', 'json', 'convert']
        },
        {
            id: 'json_to_csv',
            name: 'JSON to CSV',
            description: 'Convert JSON arrays to CSV',
            category: 'converter',
            icon: '<i class="fas fa-table"></i>',
            endpoint: '/converter/json-to-csv',
            keywords: ['json', 'csv', 'convert', 'excel']
        },
        {
            id: 'json_to_toml',
            name: 'JSON to TOML',
            description: 'Convert JSON to TOML format',
            category: 'converter',
            icon: '<i class="fas fa-code"></i>',
            endpoint: '/converter/json-to-toml',
            keywords: ['json', 'toml', 'convert']
        },
        {
            id: 'toml_to_json',
            name: 'TOML to JSON',
            description: 'Convert TOML to JSON format',
            category: 'converter',
            icon: '<i class="fas fa-code"></i>',
            endpoint: '/converter/toml-to-json',
            keywords: ['toml', 'json', 'convert']
        },
        {
            id: 'toml_to_yaml',
            name: 'TOML to YAML',
            description: 'Convert TOML to YAML format',
            category: 'converter',
            icon: '<i class="fas fa-code"></i>',
            endpoint: '/converter/toml-to-yaml',
            keywords: ['toml', 'yaml', 'convert']
        },
        {
            id: 'yaml_to_toml',
            name: 'YAML to TOML',
            description: 'Convert YAML to TOML format',
            category: 'converter',
            icon: '<i class="fas fa-code"></i>',
            endpoint: '/converter/yaml-to-toml',
            keywords: ['yaml', 'toml', 'convert']
        },
        {
            id: 'docker_run_to_compose',
            name: 'Docker Run to Compose',
            description: 'Convert docker run commands to docker-compose.yml',
            category: 'converter',
            icon: '<i class="fab fa-docker"></i>',
            endpoint: '/converter/docker-run-to-compose',
            keywords: ['docker', 'compose', 'convert']
        },
        {
            id: 'text_to_binary',
            name: 'Text to Binary',
            description: 'Convert text to binary representation',
            category: 'converter',
            icon: '<i class="fas fa-binary"></i>',
            endpoint: '/converter/text-to-binary',
            keywords: ['text', 'binary', 'convert']
        },
        {
            id: 'text_to_unicode',
            name: 'Text to Unicode',
            description: 'Convert text to Unicode code points',
            category: 'converter',
            icon: '<i class="fas fa-code"></i>',
            endpoint: '/converter/text-to-unicode',
            keywords: ['text', 'unicode', 'codepoint']
        },
        {
            id: 'text_to_nato',
            name: 'Text to NATO Alphabet',
            description: 'Convert text to NATO phonetic alphabet',
            category: 'converter',
            icon: '<i class="fas fa-flag"></i>',
            endpoint: '/converter/text-to-nato',
            keywords: ['nato', 'phonetic', 'alphabet']
        },
        {
            id: 'url_encoder',
            name: 'URL Encoder',
            description: 'Encode/decode URLs',
            category: 'converter',
            icon: '<i class="fas fa-link"></i>',
            endpoint: '/converter/url/encode',
            keywords: ['url', 'encode', 'decode', 'percent']
        },
        {
            id: 'html_entities',
            name: 'HTML Entities',
            description: 'Encode/decode HTML entities',
            category: 'converter',
            icon: '<i class="fas fa-code"></i>',
            endpoint: '/converter/html/encode',
            keywords: ['html', 'entities', 'encode', 'decode']
        },
        {
            id: 'list_converter',
            name: 'List Converter',
            description: 'Convert between different list formats',
            category: 'converter',
            icon: '<i class="fas fa-list"></i>',
            endpoint: '/converter/list',
            keywords: ['list', 'array', 'convert', 'delimiter']
        },
        {
            id: 'slugify',
            name: 'Slugify String',
            description: 'Convert text to URL-friendly slugs',
            category: 'converter',
            icon: '<i class="fas fa-link"></i>',
            endpoint: '/converter/slugify',
            keywords: ['slug', 'url', 'seo', 'friendly']
        },

        // ==================== WEB DEVELOPMENT ====================
        {
            id: 'json_viewer',
            name: 'JSON Viewer',
            description: 'Pretty print and explore JSON data',
            category: 'web',
            icon: '<i class="fas fa-eye"></i>',
            endpoint: '/web/json/prettify',
            keywords: ['json', 'pretty', 'format', 'view']
        },
        {
            id: 'json_minify',
            name: 'JSON Minify',
            description: 'Minify JSON data',
            category: 'web',
            icon: '<i class="fas fa-compress"></i>',
            endpoint: '/web/json/minify',
            keywords: ['json', 'minify', 'compress']
        },
        {
            id: 'json_diff',
            name: 'JSON Diff',
            description: 'Compare two JSON objects',
            category: 'web',
            icon: '<i class="fas fa-not-equal"></i>',
            endpoint: '/web/json/diff',
            keywords: ['json', 'diff', 'compare', 'difference']
        },
        {
            id: 'jwt_parser',
            name: 'JWT Parser',
            description: 'Decode and validate JWT tokens',
            category: 'web',
            icon: '<i class="fas fa-id-card"></i>',
            endpoint: '/web/jwt/parse',
            keywords: ['jwt', 'token', 'decode', 'parse']
        },
        {
            id: 'html_wysiwyg',
            name: 'HTML WYSIWYG Editor',
            description: 'Rich text HTML editor',
            category: 'web',
            icon: '<i class="fas fa-edit"></i>',
            endpoint: '/web/html/render',
            keywords: ['html', 'editor', 'wysiwyg', 'rich text']
        },
        {
            id: 'markdown_to_html',
            name: 'Markdown to HTML',
            description: 'Convert Markdown to HTML',
            category: 'web',
            icon: '<i class="fab fa-markdown"></i>',
            endpoint: '/web/markdown/to-html',
            keywords: ['markdown', 'html', 'convert']
        },
        {
            id: 'sql_prettify',
            name: 'SQL Prettify',
            description: 'Format and prettify SQL queries',
            category: 'web',
            icon: '<i class="fas fa-database"></i>',
            endpoint: '/web/sql/format',
            keywords: ['sql', 'format', 'pretty', 'query']
        },
        {
            id: 'xml_formatter',
            name: 'XML Formatter',
            description: 'Format and validate XML',
            category: 'web',
            icon: '<i class="fas fa-code"></i>',
            endpoint: '/web/xml/format',
            keywords: ['xml', 'format', 'validate']
        },
        {
            id: 'yaml_viewer',
            name: 'YAML Viewer',
            description: 'View and validate YAML files',
            category: 'web',
            icon: '<i class="fas fa-file-alt"></i>',
            endpoint: '/web/yaml/validate',
            keywords: ['yaml', 'validate', 'view']
        },
        {
            id: 'http_status',
            name: 'HTTP Status Codes',
            description: 'Reference for HTTP status codes',
            category: 'web',
            icon: '<i class="fas fa-server"></i>',
            endpoint: '/web/http-status',
            keywords: ['http', 'status', 'code', '404', '200']
        },
        {
            id: 'mime_types',
            name: 'MIME Types',
            description: 'Database of MIME types',
            category: 'web',
            icon: '<i class="fas fa-file"></i>',
            endpoint: '/web/mime-types',
            keywords: ['mime', 'type', 'content-type']
        },
        {
            id: 'meta_tags',
            name: 'Meta Tag Generator',
            description: 'Generate SEO meta tags',
            category: 'web',
            icon: '<i class="fas fa-tags"></i>',
            endpoint: '/web/meta-tags/generate',
            keywords: ['meta', 'seo', 'og', 'tags']
        },
        {
            id: 'qr_code',
            name: 'QR Code Generator',
            description: 'Generate QR codes from text/URLs',
            category: 'web',
            icon: '<i class="fas fa-qrcode"></i>',
            endpoint: '/web/qr-code/generate',
            keywords: ['qr', 'code', 'generate', 'barcode']
        },
        {
            id: 'wifi_qr',
            name: 'WiFi QR Code Generator',
            description: 'Generate WiFi connection QR codes',
            category: 'web',
            icon: '<i class="fas fa-wifi"></i>',
            endpoint: '/web/wifi-qr-code/generate',
            keywords: ['wifi', 'qr', 'wireless', 'network']
        },
        {
            id: 'svg_placeholder',
            name: 'SVG Placeholder Generator',
            description: 'Generate SVG placeholder images',
            category: 'web',
            icon: '<i class="fas fa-image"></i>',
            endpoint: '/web/svg/placeholder',
            keywords: ['svg', 'placeholder', 'image']
        },

        // ==================== MATHEMATICS ====================
        {
            id: 'math_evaluator',
            name: 'Math Evaluator',
            description: 'Evaluate mathematical expressions',
            category: 'math',
            icon: '<i class="fas fa-square-root-alt"></i>',
            endpoint: '/math/evaluate',
            keywords: ['math', 'calculate', 'evaluate', 'expression']
        },
        {
            id: 'percentage',
            name: 'Percentage Calculator',
            description: 'Calculate percentages',
            category: 'math',
            icon: '<i class="fas fa-percent"></i>',
            endpoint: '/math/percentage',
            keywords: ['percentage', 'percent', 'calculate']
        },
        {
            id: 'eta',
            name: 'ETA Calculator',
            description: 'Calculate estimated time of arrival',
            category: 'math',
            icon: '<i class="fas fa-clock"></i>',
            endpoint: '/math/eta',
            keywords: ['eta', 'time', 'estimate', 'arrival']
        },
        {
            id: 'chronometer',
            name: 'Chronometer',
            description: 'Simple stopwatch and timer',
            category: 'math',
            icon: '<i class="fas fa-stopwatch"></i>',
            endpoint: '/math/chronometer/start',
            keywords: ['timer', 'stopwatch', 'chronometer']
        },
        {
            id: 'benchmark',
            name: 'Benchmark Builder',
            description: 'Build and run performance benchmarks',
            category: 'math',
            icon: '<i class="fas fa-tachometer-alt"></i>',
            endpoint: '/math/benchmark',
            keywords: ['benchmark', 'performance', 'speed']
        },

        // ==================== NETWORK & SYSTEM ====================
        {
            id: 'ipv4_converter',
            name: 'IPv4 Address Converter',
            description: 'Convert IPv4 addresses to different formats',
            category: 'network',
            icon: '<i class="fas fa-network-wired"></i>',
            endpoint: '/network/ipv4/convert',
            keywords: ['ipv4', 'ip', 'address', 'convert']
        },
        {
            id: 'ipv4_subnet',
            name: 'IPv4 Subnet Calculator',
            description: 'Calculate subnet information',
            category: 'network',
            icon: '<i class="fas fa-project-diagram"></i>',
            endpoint: '/network/ipv4/subnet',
            keywords: ['subnet', 'cidr', 'netmask', 'ipv4']
        },
        {
            id: 'ipv4_range',
            name: 'IPv4 Range Expander',
            description: 'Expand IP ranges to individual IPs',
            category: 'network',
            icon: '<i class="fas fa-expand-arrows-alt"></i>',
            endpoint: '/network/ipv4/expand',
            keywords: ['ipv4', 'range', 'expand']
        },
        {
            id: 'ipv6_ula',
            name: 'IPv6 ULA Generator',
            description: 'Generate IPv6 Unique Local Addresses',
            category: 'network',
            icon: '<i class="fas fa-network-wired"></i>',
            endpoint: '/network/ipv6/ula',
            keywords: ['ipv6', 'ula', 'generate']
        },
        {
            id: 'mac_generator',
            name: 'MAC Address Generator',
            description: 'Generate random MAC addresses',
            category: 'network',
            icon: '<i class="fas fa-ethernet"></i>',
            endpoint: '/network/mac/generate',
            keywords: ['mac', 'address', 'generate', 'ethernet']
        },
        {
            id: 'mac_lookup',
            name: 'MAC Address Lookup',
            description: 'Look up MAC address vendor information',
            category: 'network',
            icon: '<i class="fas fa-search"></i>',
            endpoint: '/network/mac/lookup',
            keywords: ['mac', 'lookup', 'vendor', 'oui']
        },
        {
            id: 'user_agent',
            name: 'User Agent Parser',
            description: 'Parse and analyze user agent strings',
            category: 'network',
            icon: '<i class="fas fa-user-tag"></i>',
            endpoint: '/network/user-agent/parse',
            keywords: ['user agent', 'browser', 'parse']
        },
        {
            id: 'device_info',
            name: 'Device Information',
            description: 'Display current device information',
            category: 'network',
            icon: '<i class="fas fa-mobile-alt"></i>',
            endpoint: '/network/device-info',
            keywords: ['device', 'info', 'browser', 'system']
        },
        {
            id: 'chmod',
            name: 'Chmod Calculator',
            description: 'Calculate Unix file permissions',
            category: 'network',
            icon: '<i class="fas fa-user-shield"></i>',
            endpoint: '/network/chmod',
            keywords: ['chmod', 'permissions', 'unix', 'linux']
        },
        {
            id: 'port_generator',
            name: 'Random Port Generator',
            description: 'Generate random port numbers',
            category: 'network',
            icon: '<i class="fas fa-door-open"></i>',
            endpoint: '/network/port/random',
            keywords: ['port', 'random', 'generate']
        },
        {
            id: 'keycode',
            name: 'Keycode Info',
            description: 'Display keyboard key codes',
            category: 'network',
            icon: '<i class="fas fa-keyboard"></i>',
            endpoint: '/network/keycode',
            keywords: ['keycode', 'keyboard', 'key']
        },

        // ==================== TEXT PROCESSING ====================
        {
            id: 'text_stats',
            name: 'Text Statistics',
            description: 'Analyze text (word count, character count, etc.)',
            category: 'text',
            icon: '<i class="fas fa-chart-bar"></i>',
            endpoint: '/text/statistics',
            keywords: ['text', 'statistics', 'word count', 'analyze']
        },
        {
            id: 'text_diff',
            name: 'Text Diff',
            description: 'Compare two texts and show differences',
            category: 'text',
            icon: '<i class="fas fa-not-equal"></i>',
            endpoint: '/text/diff',
            keywords: ['text', 'diff', 'compare', 'difference']
        },
        {
            id: 'lorem_ipsum',
            name: 'Lorem Ipsum Generator',
            description: 'Generate placeholder text',
            category: 'text',
            icon: '<i class="fas fa-paragraph"></i>',
            endpoint: '/text/lorem-ipsum',
            keywords: ['lorem', 'ipsum', 'placeholder', 'dummy']
        },
        {
            id: 'ascii_art',
            name: 'ASCII Text Drawer',
            description: 'Draw text with ASCII art fonts',
            category: 'text',
            icon: '<i class="fas fa-font"></i>',
            endpoint: '/text/ascii-art',
            keywords: ['ascii', 'art', 'text', 'banner']
        },
        {
            id: 'obfuscator',
            name: 'String Obfuscator',
            description: 'Obfuscate strings for code protection',
            category: 'text',
            icon: '<i class="fas fa-user-secret"></i>',
            endpoint: '/text/obfuscate',
            keywords: ['obfuscate', 'encode', 'protect']
        },
        {
            id: 'regex_tester',
            name: 'Regex Tester',
            description: 'Test regular expressions with real-time matching',
            category: 'text',
            icon: '<i class="fas fa-search"></i>',
            endpoint: '/text/regex/test',
            keywords: ['regex', 'regexp', 'pattern', 'match']
        },
        {
            id: 'regex_memo',
            name: 'Regex Memo',
            description: 'Regular expression reference and cheat sheet',
            category: 'text',
            icon: '<i class="fas fa-book"></i>',
            endpoint: '/text/regex/cheatsheet',
            keywords: ['regex', 'reference', 'cheatsheet']
        },
        {
            id: 'crontab',
            name: 'Crontab Generator',
            description: 'Generate and explain cron expressions',
            category: 'text',
            icon: '<i class="fas fa-clock"></i>',
            endpoint: '/text/crontab/generate',
            keywords: ['cron', 'crontab', 'schedule']
        },
        {
            id: 'email_normalizer',
            name: 'Email Normalizer',
            description: 'Normalize and validate email addresses',
            category: 'text',
            icon: '<i class="fas fa-envelope"></i>',
            endpoint: '/text/email/normalize',
            keywords: ['email', 'normalize', 'validate']
        },
        {
            id: 'phone_parser',
            name: 'Phone Parser',
            description: 'Parse and format phone numbers',
            category: 'text',
            icon: '<i class="fas fa-phone"></i>',
            endpoint: '/text/phone/parse',
            keywords: ['phone', 'telephone', 'parse', 'format']
        },
        {
            id: 'numeronym',
            name: 'Numeronym Generator',
            description: 'Generate numeronyms (i18n, a11y, etc.)',
            category: 'text',
            icon: '<i class="fas fa-sort-numeric-down"></i>',
            endpoint: '/text/numeronym',
            keywords: ['numeronym', 'i18n', 'a11y', 'abbreviation']
        },
        {
            id: 'safelink',
            name: 'Safelink Decoder',
            description: 'Decode Microsoft SafeLinks',
            category: 'text',
            icon: '<i class="fas fa-link"></i>',
            endpoint: '/text/safelink/decode',
            keywords: ['safelink', 'decode', 'microsoft', 'url']
        },
        {
            id: 'iban',
            name: 'IBAN Validator',
            description: 'Validate and parse IBAN numbers',
            category: 'text',
            icon: '<i class="fas fa-university"></i>',
            endpoint: '/text/iban/validate',
            keywords: ['iban', 'bank', 'validate']
        },
        {
            id: 'url_parser',
            name: 'URL Parser',
            description: 'Parse and analyze URLs',
            category: 'text',
            icon: '<i class="fas fa-link"></i>',
            endpoint: '/text/url/parse',
            keywords: ['url', 'parse', 'analyze']
        },
        {
            id: 'emoji_picker',
            name: 'Emoji Picker',
            description: 'Browse and copy emojis',
            category: 'text',
            icon: '<i class="fas fa-smile"></i>',
            endpoint: '/text/emoji',
            keywords: ['emoji', 'emoticon', 'smiley']
        },
        {
            id: 'git_memo',
            name: 'Git Memo',
            description: 'Git commands reference and cheat sheet',
            category: 'text',
            icon: '<i class="fab fa-git-alt"></i>',
            endpoint: '/text/git/cheatsheet',
            keywords: ['git', 'reference', 'commands', 'cheatsheet']
        },
        {
            id: 'archive',
            name: 'Archive Creator',
            description: 'Create ZIP archives from files',
            category: 'text',
            icon: '<i class="fas fa-file-archive"></i>',
            endpoint: '/text/archive/create',
            keywords: ['archive', 'zip', 'compress']
        },
        {
            id: 'pdf_signature',
            name: 'PDF Signature Checker',
            description: 'Check PDF digital signatures',
            category: 'text',
            icon: '<i class="fas fa-file-pdf"></i>',
            endpoint: '/text/pdf/check-signature',
            keywords: ['pdf', 'signature', 'verify']
        },

        // ==================== MEDIA ====================
        {
            id: 'camera',
            name: 'Camera Recorder',
            description: 'Record video/audio from webcam (Client-side only)',
            category: 'media',
            icon: '<i class="fas fa-video"></i>',
            endpoint: null,
            keywords: ['camera', 'webcam', 'record', 'video']
        },
        {
            id: 'image_compressor',
            name: 'Image Compressor',
            description: 'Compress images while maintaining quality',
            category: 'media',
            icon: '<i class="fas fa-image"></i>',
            endpoint: '/media/image/compress',
            keywords: ['image', 'compress', 'optimize', 'resize']
        },
        {
            id: 'video_compressor',
            name: 'Video Compressor',
            description: 'Compress video files in the browser',
            category: 'media',
            icon: '<i class="fas fa-film"></i>',
            endpoint: '/media/video/compress',
            keywords: ['video', 'compress', 'optimize']
        }
    ];
}
