/** Declarative UI schemas for local tools. */
import { AlignLeft, ArrowLeftRight, BarChart, Binary, Calculator, Check, CheckCircle, Clock, Code2, Download, Edit3, FileText, Globe, Hash, Key, Link, Lock, Phone, Play, QrCode, RefreshCcw, Search, Shield, Type, Upload, Wifi, Wrench } from 'lucide-react';
import type { ToolUISchema } from '../uiTypes';

// --- TOOL UI SCHEMAS ---
export const TOOL_UI_SCHEMAS: Record<string, ToolUISchema> = {
/* --- converters --- */
'conv_base': {
  id: 'conv_base', title: 'Base Converter', description: 'Convert a number between binary, octal, decimal and hexadecimal.',
  inputs: [
    { id: 'value', label: 'Value', type: 'text', placeholder: 'e.g. FF' },
    { id: 'from', label: 'From Base', type: 'select', defaultValue: '10', options: [{ label: 'Binary (2)', value: '2' }, { label: 'Octal (8)', value: '8' }, { label: 'Decimal (10)', value: '10' }, { label: 'Hexadecimal (16)', value: '16' }] },
    { id: 'to', label: 'To Base', type: 'select', defaultValue: '16', options: [{ label: 'Binary (2)', value: '2' }, { label: 'Octal (8)', value: '8' }, { label: 'Decimal (10)', value: '10' }, { label: 'Hexadecimal (16)', value: '16' }] },
  ],
  actions: [{ id: 'run', label: 'Convert', icon: Binary, apiPath: '/api/ittools/v1/converter/base' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'conv_base64_file_encode': {
  id: 'conv_base64_file_encode', title: 'Base64 File Encode', description: 'Encode raw file data to a Base64 string and data URI.',
  inputs: [
    { id: 'fileData', label: 'File Data', type: 'textarea', placeholder: 'Raw file content...' },
    { id: 'fileName', label: 'File Name', type: 'text', placeholder: 'file' },
  ],
  actions: [{ id: 'run', label: 'Encode', icon: Upload, apiPath: '/api/ittools/v1/converter/base64/file/encode' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'conv_base64_file_decode': {
  id: 'conv_base64_file_decode', title: 'Base64 File Decode', description: 'Decode a Base64 string back to file data with detected MIME type.',
  inputs: [
    { id: 'encoded', label: 'Base64', type: 'textarea', placeholder: 'Base64 string...' },
  ],
  actions: [{ id: 'run', label: 'Decode', icon: Download, apiPath: '/api/ittools/v1/converter/base64/file/decode' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'conv_json_csv': {
  id: 'conv_json_csv', title: 'JSON to CSV', description: 'Convert a JSON array of objects to CSV.',
  inputs: [
    { id: 'json', label: 'JSON', type: 'textarea', placeholder: '[{"a":1,"b":2}]' },
    { id: 'delimiter', label: 'Delimiter', type: 'text', defaultValue: ',', placeholder: ',' },
    { id: 'includeHeaders', label: 'Include Headers', type: 'checkbox', defaultValue: true },
  ],
  actions: [{ id: 'run', label: 'Convert', icon: ArrowLeftRight, apiPath: '/api/ittools/v1/converter/json-to-csv' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'conv_json_xml': {
  id: 'conv_json_xml', title: 'JSON to XML', description: 'Convert JSON to XML.',
  inputs: [
    { id: 'json', label: 'JSON', type: 'textarea', placeholder: '{"key":"value"}' },
  ],
  actions: [{ id: 'run', label: 'Convert', icon: ArrowLeftRight, apiPath: '/api/ittools/v1/converter/json-to-xml' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'conv_json_toml': {
  id: 'conv_json_toml', title: 'JSON to TOML', description: 'Convert JSON to TOML.',
  inputs: [
    { id: 'json', label: 'JSON', type: 'textarea', placeholder: '{"key":"value"}' },
  ],
  actions: [{ id: 'run', label: 'Convert', icon: ArrowLeftRight, apiPath: '/api/ittools/v1/converter/json-to-toml' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'conv_toml_json': {
  id: 'conv_toml_json', title: 'TOML to JSON', description: 'Convert TOML to JSON.',
  inputs: [
    { id: 'toml', label: 'TOML', type: 'textarea', placeholder: 'key = "value"' },
  ],
  actions: [{ id: 'run', label: 'Convert', icon: ArrowLeftRight, apiPath: '/api/ittools/v1/converter/toml-to-json' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'conv_toml_yaml': {
  id: 'conv_toml_yaml', title: 'TOML to YAML', description: 'Convert TOML to YAML.',
  inputs: [
    { id: 'toml', label: 'TOML', type: 'textarea', placeholder: 'key = "value"' },
  ],
  actions: [{ id: 'run', label: 'Convert', icon: ArrowLeftRight, apiPath: '/api/ittools/v1/converter/toml-to-yaml' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'conv_xml_json': {
  id: 'conv_xml_json', title: 'XML to JSON', description: 'Convert XML to JSON.',
  inputs: [
    { id: 'xml', label: 'XML', type: 'textarea', placeholder: '<root><key>value</key></root>' },
  ],
  actions: [{ id: 'run', label: 'Convert', icon: ArrowLeftRight, apiPath: '/api/ittools/v1/converter/xml-to-json' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'conv_yaml_toml': {
  id: 'conv_yaml_toml', title: 'YAML to TOML', description: 'Convert YAML to TOML.',
  inputs: [
    { id: 'yaml', label: 'YAML', type: 'textarea', placeholder: 'key: value' },
  ],
  actions: [{ id: 'run', label: 'Convert', icon: ArrowLeftRight, apiPath: '/api/ittools/v1/converter/yaml-to-toml' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'conv_list': {
  id: 'conv_list', title: 'List Converter', description: 'Convert a list between separators (comma, newline, etc.).',
  inputs: [
    { id: 'list', label: 'List', type: 'textarea', placeholder: 'a, b, c' },
    { id: 'from', label: 'From', type: 'select', defaultValue: 'comma', options: [{ label: 'Comma', value: 'comma' }, { label: 'Semicolon', value: 'semicolon' }, { label: 'Pipe', value: 'pipe' }, { label: 'Space', value: 'space' }, { label: 'Tab', value: 'tab' }, { label: 'Newline', value: 'newline' }] },
    { id: 'to', label: 'To', type: 'select', defaultValue: 'newline', options: [{ label: 'Comma', value: 'comma' }, { label: 'Semicolon', value: 'semicolon' }, { label: 'Pipe', value: 'pipe' }, { label: 'Space', value: 'space' }, { label: 'Tab', value: 'tab' }, { label: 'Newline', value: 'newline' }] },
  ],
  actions: [{ id: 'run', label: 'Convert', icon: AlignLeft, apiPath: '/api/ittools/v1/converter/list' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'conv_slugify': {
  id: 'conv_slugify', title: 'Slug Generator', description: 'Generate a URL-friendly slug from text.',
  inputs: [
    { id: 'text', label: 'Text', type: 'text', placeholder: 'Hello World' },
    { id: 'separator', label: 'Separator', type: 'text', defaultValue: '-', placeholder: '-' },
    { id: 'lowercase', label: 'Lowercase', type: 'checkbox', defaultValue: true },
  ],
  actions: [{ id: 'run', label: 'Slugify', icon: Link, apiPath: '/api/ittools/v1/converter/slugify' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'conv_text_binary': {
  id: 'conv_text_binary', title: 'Text to Binary', description: 'Convert text to a binary representation.',
  inputs: [
    { id: 'text', label: 'Text', type: 'textarea', placeholder: 'Enter text...' },
  ],
  actions: [{ id: 'run', label: 'Convert', icon: Binary, apiPath: '/api/ittools/v1/converter/text-to-binary' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'conv_text_unicode': {
  id: 'conv_text_unicode', title: 'Text to Unicode', description: 'Convert text to Unicode code points (U+XXXX).',
  inputs: [
    { id: 'text', label: 'Text', type: 'textarea', placeholder: 'Enter text...' },
  ],
  actions: [{ id: 'run', label: 'Convert', icon: Type, apiPath: '/api/ittools/v1/converter/text-to-unicode' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'conv_text_nato': {
  id: 'conv_text_nato', title: 'Text to NATO', description: 'Convert text to the NATO phonetic alphabet.',
  inputs: [
    { id: 'text', label: 'Text', type: 'text', placeholder: 'Enter text...' },
  ],
  actions: [{ id: 'run', label: 'Convert', icon: Type, apiPath: '/api/ittools/v1/converter/text-to-nato' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
/* --- text_adv --- */
'txt_regex': {
  id: 'txt_regex', title: 'Regex Tester', description: 'Test a regular expression against text and list matches.',
  inputs: [
    { id: 'pattern', label: 'Pattern', type: 'text', placeholder: '\\d+' },
    { id: 'text', label: 'Text', type: 'textarea', placeholder: 'Enter text to search...' },
    { id: 'flags', label: 'Flags', type: 'text', placeholder: 'gims', defaultValue: 'g' },
  ],
  actions: [{ id: 'run', label: 'Test', icon: Search, apiPath: '/api/ittools/v1/text/regex/test' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'txt_diff': {
  id: 'txt_diff', title: 'Text Diff', description: 'Compare two texts line by line.',
  inputs: [
    { id: 'text1', label: 'Text 1', type: 'textarea', placeholder: 'Original text...' },
    { id: 'text2', label: 'Text 2', type: 'textarea', placeholder: 'Changed text...' },
    { id: 'ignoreWhitespace', label: 'Ignore Whitespace', type: 'checkbox' },
    { id: 'ignoreCase', label: 'Ignore Case', type: 'checkbox' },
  ],
  actions: [{ id: 'run', label: 'Compare', icon: ArrowLeftRight, apiPath: '/api/ittools/v1/text/diff' }],
  outputs: [{ id: 'result', label: 'Diff', type: 'json' }],
},
'txt_email_normalize': {
  id: 'txt_email_normalize', title: 'Email Normalizer', description: 'Normalize an email address (strip plus-tags, lowercase).',
  inputs: [
    { id: 'email', label: 'Email', type: 'text', placeholder: 'user+tag@Example.com' },
  ],
  actions: [{ id: 'run', label: 'Normalize', icon: Type, apiPath: '/api/ittools/v1/text/email/normalize' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'txt_numeronym': {
  id: 'txt_numeronym', title: 'Numeronym Generator', description: 'Generate a numeronym from a word (e.g. i18n).',
  inputs: [
    { id: 'text', label: 'Text', type: 'text', placeholder: 'internationalization' },
  ],
  actions: [{ id: 'run', label: 'Generate', icon: Hash, apiPath: '/api/ittools/v1/text/numeronym' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'txt_ascii_art': {
  id: 'txt_ascii_art', title: 'ASCII Art', description: 'Render text as ASCII art.',
  inputs: [
    { id: 'text', label: 'Text', type: 'text', placeholder: 'Hello' },
    { id: 'font', label: 'Font', type: 'select', defaultValue: 'standard', options: [{ label: 'Standard', value: 'standard' }, { label: 'Banner', value: 'banner' }, { label: 'Block', value: 'block' }] },
  ],
  actions: [{ id: 'run', label: 'Generate', icon: Type, apiPath: '/api/ittools/v1/text/ascii-art' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'txt_crontab': {
  id: 'txt_crontab', title: 'Crontab Parser', description: 'Parse and describe a crontab expression.',
  inputs: [
    { id: 'expression', label: 'Expression', type: 'text', placeholder: '*/5 * * * *' },
  ],
  actions: [{ id: 'run', label: 'Parse', icon: Clock, apiPath: '/api/ittools/v1/text/crontab/parse' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'txt_phone': {
  id: 'txt_phone', title: 'Phone Parser', description: 'Parse and format a phone number.',
  inputs: [
    { id: 'phone', label: 'Phone', type: 'text', placeholder: '+1 415 555 0123' },
    { id: 'country', label: 'Country', type: 'text', placeholder: 'US', defaultValue: 'US' },
  ],
  actions: [{ id: 'run', label: 'Parse', icon: Phone, apiPath: '/api/ittools/v1/text/phone/parse' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'txt_iban': {
  id: 'txt_iban', title: 'IBAN Validator', description: 'Validate an IBAN and break out its parts.',
  inputs: [
    { id: 'iban', label: 'IBAN', type: 'text', placeholder: 'DE89 3704 0044 0532 0130 00' },
  ],
  actions: [{ id: 'run', label: 'Validate', icon: CheckCircle, apiPath: '/api/ittools/v1/text/iban/validate' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'txt_safelink': {
  id: 'txt_safelink', title: 'Safelink Encoder', description: 'Encode or decode a URL for safe-link wrapping.',
  inputs: [
    { id: 'url', label: 'URL', type: 'text', placeholder: 'https://example.com/path?q=1' },
    { id: 'action', label: 'Action', type: 'select', defaultValue: 'encode', options: [{ label: 'Encode', value: 'encode' }, { label: 'Decode', value: 'decode' }] },
  ],
  actions: [{ id: 'run', label: 'Run', icon: Link, apiPath: '/api/ittools/v1/text/safelink/encode' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'txt_emoji': {
  id: 'txt_emoji', title: 'Emoji Picker', description: 'Search and browse emojis by category.',
  inputs: [
    { id: 'search', label: 'Search', type: 'text', placeholder: 'happy' },
    { id: 'category', label: 'Category', type: 'select', options: [{ label: 'Smileys', value: 'smileys' }, { label: 'People', value: 'people' }, { label: 'Animals', value: 'animals' }, { label: 'Food', value: 'food' }, { label: 'Travel', value: 'travel' }, { label: 'Activities', value: 'activities' }, { label: 'Objects', value: 'objects' }, { label: 'Symbols', value: 'symbols' }, { label: 'Flags', value: 'flags' }] },
  ],
  actions: [{ id: 'run', label: 'Search', icon: Search, apiPath: '/api/ittools/v1/text/emoji/picker' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'txt_git_memo': {
  id: 'txt_git_memo', title: 'Git Commit Memo', description: 'Build a Conventional Commits message.',
  inputs: [
    { id: 'type', label: 'Type', type: 'select', defaultValue: 'feat', options: [{ label: 'feat', value: 'feat' }, { label: 'fix', value: 'fix' }, { label: 'docs', value: 'docs' }, { label: 'style', value: 'style' }, { label: 'refactor', value: 'refactor' }, { label: 'test', value: 'test' }, { label: 'chore', value: 'chore' }] },
    { id: 'scope', label: 'Scope', type: 'text', placeholder: 'auth' },
    { id: 'subject', label: 'Subject', type: 'text', placeholder: 'add login flow' },
    { id: 'body', label: 'Body', type: 'textarea', placeholder: 'Detailed description...' },
    { id: 'breaking', label: 'Breaking Change', type: 'checkbox' },
  ],
  actions: [{ id: 'run', label: 'Generate', icon: Edit3, apiPath: '/api/ittools/v1/text/git/memo' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'txt_obfuscate': {
  id: 'txt_obfuscate', title: 'Text Obfuscator', description: 'Obfuscate text using a chosen method.',
  inputs: [
    { id: 'text', label: 'Text', type: 'textarea', placeholder: 'Enter text...' },
    { id: 'method', label: 'Method', type: 'select', defaultValue: 'unicode', options: [{ label: 'Unicode', value: 'unicode' }, { label: 'Hex', value: 'hex' }, { label: 'ROT13', value: 'rot13' }, { label: 'Base64', value: 'base64' }, { label: 'Reverse', value: 'reverse' }] },
  ],
  actions: [{ id: 'run', label: 'Obfuscate', icon: Shield, apiPath: '/api/ittools/v1/text/obfuscate' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'txt_lorem': {
  id: 'txt_lorem', title: 'Lorem Ipsum', description: 'Generate placeholder Lorem Ipsum text.',
  inputs: [
    { id: 'count', label: 'Count', type: 'number', defaultValue: 3, placeholder: '3' },
    { id: 'unit', label: 'Unit', type: 'select', defaultValue: 'paragraphs', options: [{ label: 'Words', value: 'words' }, { label: 'Sentences', value: 'sentences' }, { label: 'Paragraphs', value: 'paragraphs' }] },
    { id: 'startWithLorem', label: 'Start With Lorem', type: 'checkbox', defaultValue: true },
  ],
  actions: [{ id: 'run', label: 'Generate', icon: AlignLeft, apiPath: '/api/ittools/v1/text/lorem-ipsum' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
/* --- network --- */
'net_ipv4_convert': {
  id: 'net_ipv4_convert', title: 'IPv4 Converter', description: 'Convert an IPv4 address to decimal, hexadecimal and binary.',
  inputs: [
    { id: 'ip', label: 'IPv4 Address', type: 'text', placeholder: '192.168.1.1', defaultValue: '192.168.1.1' },
  ],
  actions: [{ id: 'run', label: 'Convert', icon: ArrowLeftRight, apiPath: '/api/ittools/v1/network/ipv4/convert' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'net_ipv4_subnet': {
  id: 'net_ipv4_subnet', title: 'IPv4 Subnet Calculator', description: 'Compute network, broadcast, mask and host range from an IP and CIDR.',
  inputs: [
    { id: 'ip', label: 'IPv4 Address', type: 'text', placeholder: '192.168.1.10', defaultValue: '192.168.1.10' },
    { id: 'cidr', label: 'CIDR Prefix', type: 'number', placeholder: '0-32', defaultValue: 24 },
  ],
  actions: [{ id: 'run', label: 'Calculate', icon: Calculator, apiPath: '/api/ittools/v1/network/ipv4/subnet' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'net_ipv4_expand': {
  id: 'net_ipv4_expand', title: 'IPv4 Range Expander', description: 'Expand a start-end IPv4 range into a list of addresses (max 1000).',
  inputs: [
    { id: 'range', label: 'IP Range', type: 'text', placeholder: '192.168.1.1-192.168.1.20', defaultValue: '192.168.1.1-192.168.1.20' },
  ],
  actions: [{ id: 'run', label: 'Expand', icon: AlignLeft, apiPath: '/api/ittools/v1/network/ipv4/expand' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'net_ipv6_ula': {
  id: 'net_ipv6_ula', title: 'IPv6 ULA Generator', description: 'Generate random IPv6 unique local addresses (fd00::/8).',
  inputs: [
    { id: 'count', label: 'Count', type: 'number', placeholder: '1-50', defaultValue: 1 },
  ],
  actions: [{ id: 'run', label: 'Generate', icon: RefreshCcw, apiPath: '/api/ittools/v1/network/ipv6/ula' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'net_mac_generate': {
  id: 'net_mac_generate', title: 'MAC Address Generator', description: 'Generate random MAC addresses.',
  inputs: [
    { id: 'count', label: 'Count', type: 'number', placeholder: '1-50', defaultValue: 1 },
    { id: 'separator', label: 'Separator', type: 'select', defaultValue: ':', options: [{ label: 'Colon (:)', value: ':' }, { label: 'Hyphen (-)', value: '-' }] },
    { id: 'uppercase', label: 'Uppercase', type: 'checkbox', defaultValue: true },
  ],
  actions: [{ id: 'run', label: 'Generate', icon: RefreshCcw, apiPath: '/api/ittools/v1/network/mac/generate' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'net_mac_lookup': {
  id: 'net_mac_lookup', title: 'MAC Address Lookup', description: 'Look up the vendor for a MAC address OUI prefix.',
  inputs: [
    { id: 'mac', label: 'MAC Address', type: 'text', placeholder: '00:01:C8:00:00:00', defaultValue: '00:01:C8:00:00:00' },
  ],
  actions: [{ id: 'run', label: 'Lookup', icon: Search, apiPath: '/api/ittools/v1/network/mac/lookup' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'net_user_agent': {
  id: 'net_user_agent', title: 'User-Agent Parser', description: 'Parse a User-Agent string into browser, OS and device.',
  inputs: [
    { id: 'userAgent', label: 'User-Agent String', type: 'textarea', placeholder: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...' },
  ],
  actions: [{ id: 'run', label: 'Parse', icon: Globe, apiPath: '/api/ittools/v1/network/user-agent/parse' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'net_chmod': {
  id: 'net_chmod', title: 'Chmod Calculator', description: 'Convert an octal file mode to symbolic permissions.',
  inputs: [
    { id: 'mode', label: 'Octal Mode', type: 'text', placeholder: '755', defaultValue: '755' },
  ],
  actions: [{ id: 'run', label: 'Calculate', icon: Calculator, apiPath: '/api/ittools/v1/network/chmod' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'net_port_random': {
  id: 'net_port_random', title: 'Random Port Generator', description: 'Generate random port numbers within a range.',
  inputs: [
    { id: 'count', label: 'Count', type: 'number', placeholder: '1-50', defaultValue: 1 },
    { id: 'min', label: 'Min Port', type: 'number', placeholder: '1024-65535', defaultValue: 1024 },
    { id: 'max', label: 'Max Port', type: 'number', placeholder: '1024-65535', defaultValue: 65535 },
  ],
  actions: [{ id: 'run', label: 'Generate', icon: RefreshCcw, apiPath: '/api/ittools/v1/network/port/random' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
/* --- web --- */
'web_html_encode': {
  id: 'web_html_encode', title: 'HTML Encode', description: 'Encode text into HTML entities.',
  inputs: [
    { id: 'html', label: 'Text / HTML', type: 'textarea', placeholder: 'Enter text to encode...' },
  ],
  actions: [{ id: 'run', label: 'Encode', icon: Code2, apiPath: '/api/ittools/v1/web/html/encode' }],
  outputs: [{ id: 'encoded', label: 'Encoded', type: 'text' }],
},
'web_html_decode': {
  id: 'web_html_decode', title: 'HTML Decode', description: 'Decode HTML entities back into text.',
  inputs: [
    { id: 'encoded', label: 'Encoded HTML', type: 'textarea', placeholder: 'Enter HTML entities...' },
  ],
  actions: [{ id: 'run', label: 'Decode', icon: Code2, apiPath: '/api/ittools/v1/web/html/decode' }],
  outputs: [{ id: 'decoded', label: 'Decoded', type: 'text' }],
},
'web_json_diff': {
  id: 'web_json_diff', title: 'JSON Diff', description: 'Compare two JSON documents and list differences.',
  inputs: [
    { id: 'json1', label: 'JSON A', type: 'textarea', placeholder: '{ "a": 1 }' },
    { id: 'json2', label: 'JSON B', type: 'textarea', placeholder: '{ "a": 2 }' },
  ],
  actions: [{ id: 'run', label: 'Compare', icon: ArrowLeftRight, apiPath: '/api/ittools/v1/web/json/diff' }],
  outputs: [{ id: 'differences', label: 'Differences', type: 'json' }],
},
'web_http_status': {
  id: 'web_http_status', title: 'HTTP Status Lookup', description: 'Look up the meaning of an HTTP status code.',
  inputs: [
    { id: 'code', label: 'Status Code', type: 'number', placeholder: '404', defaultValue: 404 },
  ],
  actions: [{ id: 'run', label: 'Lookup', icon: Search, apiPath: '/api/ittools/v1/web/http/status' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'web_mime_types': {
  id: 'web_mime_types', title: 'MIME Types', description: 'Browse common MIME types and file extensions.',
  inputs: [],
  actions: [{ id: 'run', label: 'List MIME Types', icon: FileText, apiPath: '/api/ittools/v1/web/mime-types' }],
  outputs: [{ id: 'mimeTypes', label: 'MIME Types', type: 'json' }],
},
'web_meta_tags': {
  id: 'web_meta_tags', title: 'Meta Tag Generator', description: 'Generate HTML, Open Graph and Twitter meta tags.',
  inputs: [
    { id: 'title', label: 'Title', type: 'text', placeholder: 'Page title' },
    { id: 'description', label: 'Description', type: 'textarea', placeholder: 'Page description' },
    { id: 'url', label: 'URL', type: 'text', placeholder: 'https://example.com' },
    { id: 'image', label: 'Image URL', type: 'text', placeholder: 'https://example.com/og.png' },
    { id: 'type', label: 'Type', type: 'select', defaultValue: 'website', options: [{ label: 'Website', value: 'website' }, { label: 'Article', value: 'article' }, { label: 'Product', value: 'product' }] },
  ],
  actions: [{ id: 'run', label: 'Generate', icon: Code2, apiPath: '/api/ittools/v1/web/meta-tags/generate' }],
  outputs: [{ id: 'allTags', label: 'Meta Tags', type: 'text' }],
},
'web_svg_optimize': {
  id: 'web_svg_optimize', title: 'SVG Optimizer', description: 'Minify and optimize SVG markup.',
  inputs: [
    { id: 'svg', label: 'SVG', type: 'textarea', placeholder: '<svg>...</svg>' },
    { id: 'precision', label: 'Precision', type: 'number', placeholder: '2', defaultValue: 2 },
  ],
  actions: [{ id: 'run', label: 'Optimize', icon: Wrench, apiPath: '/api/ittools/v1/web/svg/optimize' }],
  outputs: [{ id: 'optimized', label: 'Optimized SVG', type: 'text' }],
},
/* --- calc --- */
'calc_bmi': {
  id: 'calc_bmi', title: 'BMI Calculator', description: 'Calculate Body Mass Index from weight and height.',
  inputs: [
    { id: 'weight', label: 'Weight', type: 'number', placeholder: 'kg (metric) or lb (imperial)' },
    { id: 'height', label: 'Height', type: 'number', placeholder: 'cm (metric) or in (imperial)' },
    { id: 'unit', label: 'Unit System', type: 'select', defaultValue: 'metric', options: [{ label: 'Metric (kg, cm)', value: 'metric' }, { label: 'Imperial (lb, in)', value: 'imperial' }] },
  ],
  actions: [{ id: 'run', label: 'Calculate', icon: Calculator, apiPath: '/api/ittools/v1/advanced/calculator/bmi' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'calc_gst': {
  id: 'calc_gst', title: 'GST Calculator', description: 'Add or remove GST from an amount.',
  inputs: [
    { id: 'amount', label: 'Amount', type: 'number', placeholder: 'e.g. 1000' },
    { id: 'gst_rate', label: 'GST Rate (%)', type: 'number', placeholder: 'e.g. 18' },
    { id: 'operation', label: 'Operation', type: 'select', defaultValue: 'add', options: [{ label: 'Add GST', value: 'add' }, { label: 'Remove GST', value: 'remove' }] },
  ],
  actions: [{ id: 'run', label: 'Calculate', icon: Calculator, apiPath: '/api/ittools/v1/advanced/calculator/gst' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'calc_loan_emi': {
  id: 'calc_loan_emi', title: 'Loan EMI Calculator', description: 'Calculate monthly loan EMI.',
  inputs: [
    { id: 'principal', label: 'Principal', type: 'number', placeholder: 'e.g. 100000' },
    { id: 'rate', label: 'Annual Interest Rate (%)', type: 'number', placeholder: 'e.g. 7.5' },
    { id: 'months', label: 'Tenure (months)', type: 'number', placeholder: 'e.g. 60' },
  ],
  actions: [{ id: 'run', label: 'Calculate', icon: Calculator, apiPath: '/api/ittools/v1/advanced/calculator/loan-emi' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'calc_num_to_words': {
  id: 'calc_num_to_words', title: 'Number to Words', description: 'Convert a number into its English words.',
  inputs: [
    { id: 'number', label: 'Number', type: 'number', placeholder: 'e.g. 12345' },
  ],
  actions: [{ id: 'run', label: 'Convert', icon: Type, apiPath: '/api/ittools/v1/advanced/calculator/number-to-words' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'calc_math_eval': {
  id: 'calc_math_eval', title: 'Math Evaluator', description: 'Evaluate a math expression (+ - * / ^ and parentheses).',
  inputs: [
    { id: 'expression', label: 'Expression', type: 'text', placeholder: 'e.g. (2+3)*4^2' },
    { id: 'precision', label: 'Precision (decimals)', type: 'number', defaultValue: '10', placeholder: '0-20' },
  ],
  actions: [{ id: 'run', label: 'Evaluate', icon: Calculator, apiPath: '/api/ittools/v1/math/evaluate' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'calc_percentage': {
  id: 'calc_percentage', title: 'Percentage Calculator', description: 'Percentage of, change between, or what-percent calculations.',
  inputs: [
    { id: 'operation', label: 'Operation', type: 'select', defaultValue: 'percent_of', options: [{ label: 'X% of Y', value: 'percent_of' }, { label: 'Percentage change (X to Y)', value: 'percentage_change' }, { label: 'X is what % of Y', value: 'what_percent' }] },
    { id: 'value1', label: 'Value 1', type: 'number', placeholder: 'e.g. 10' },
    { id: 'value2', label: 'Value 2', type: 'number', placeholder: 'e.g. 200' },
  ],
  actions: [{ id: 'run', label: 'Calculate', icon: Calculator, apiPath: '/api/ittools/v1/math/percentage' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'calc_eta': {
  id: 'calc_eta', title: 'ETA Calculator', description: 'Estimate completion time from progress so far.',
  inputs: [
    { id: 'totalItems', label: 'Total Items', type: 'number', placeholder: 'e.g. 1000' },
    { id: 'completedItems', label: 'Completed Items', type: 'number', placeholder: 'e.g. 250' },
    { id: 'elapsedTime', label: 'Elapsed Time', type: 'number', placeholder: 'e.g. 60' },
    { id: 'unit', label: 'Time Unit', type: 'select', defaultValue: 'seconds', options: [{ label: 'Seconds', value: 'seconds' }, { label: 'Minutes', value: 'minutes' }, { label: 'Hours', value: 'hours' }] },
  ],
  actions: [{ id: 'run', label: 'Calculate', icon: Clock, apiPath: '/api/ittools/v1/math/eta' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
'calc_benchmark': {
  id: 'calc_benchmark', title: 'Benchmark', description: 'Micro-benchmark a basic operation over N iterations.',
  inputs: [
    { id: 'operation', label: 'Operation', type: 'select', defaultValue: 'math_calc', options: [{ label: 'String concat', value: 'string_concat' }, { label: 'Array push', value: 'array_push' }, { label: 'Math calc', value: 'math_calc' }, { label: 'JSON encode', value: 'json_encode' }, { label: 'Hash (MD5)', value: 'hash' }] },
    { id: 'iterations', label: 'Iterations', type: 'number', defaultValue: '1000', placeholder: '1-1000000' },
    { id: 'data', label: 'Data (optional)', type: 'text', placeholder: 'sample input string' },
  ],
  actions: [{ id: 'run', label: 'Run', icon: BarChart, apiPath: '/api/ittools/v1/math/benchmark' }],
  outputs: [{ id: 'result', label: 'Result', type: 'json' }],
},
  // --- Crypto ---
  'cry1': {
    id: 'cry1', title: 'UUID Generator', description: 'Generate UUID v4 identifiers.',
    inputs: [{ id: 'count', label: 'Count', type: 'number', defaultValue: 1 }, { id: 'uppercase', label: 'Uppercase', type: 'checkbox' }],
    actions: [{ id: 'gen', label: 'Generate', icon: Shield, apiPath: '/api/ittools/v1/crypto/uuid/generate' }],
    outputs: [{ id: 'uuids', label: 'UUIDs', type: 'json' }]
  },
  'cry_ulid': {
    id: 'cry_ulid', title: 'ULID Generator', description: 'Generate Universally Unique Lexicographically Sortable Identifiers.',
    inputs: [{ id: 'count', label: 'Count', type: 'number', defaultValue: 1 }],
    actions: [{ id: 'gen', label: 'Generate', icon: Shield, apiPath: '/api/ittools/v1/crypto/ulid/generate' }],
    outputs: [{ id: 'ulids', label: 'ULIDs', type: 'json' }]
  },
  'cry_token': {
    id: 'cry_token', title: 'Token Generator', description: 'Generate random security tokens.',
    inputs: [
        { id: 'length', label: 'Length', type: 'number', defaultValue: 32 },
        { id: 'charset', label: 'Charset', type: 'select', options: [{label:'Alphanumeric', value:'alphanumeric'}, {label:'Hex', value:'hex'}, {label:'Numeric', value:'numeric'}] }
    ],
    actions: [{ id: 'gen', label: 'Generate', icon: Key, apiPath: '/api/ittools/v1/crypto/token/generate' }],
    outputs: [{ id: 'tokens', label: 'Tokens', type: 'json' }]
  },
  'cry_hash': {
    id: 'cry_hash', title: 'Hash Generator', description: 'Calculate MD5, SHA1, SHA256, SHA512 hashes.',
    inputs: [
        { id: 'text', label: 'Text', type: 'textarea' },
        { id: 'algorithm', label: 'Algorithm', type: 'select', options: [{label:'SHA256', value:'sha256'}, {label:'MD5', value:'md5'}, {label:'SHA1', value:'sha1'}, {label:'SHA512', value:'sha512'}] }
    ],
    actions: [{ id: 'hash', label: 'Calculate Hash', icon: Hash, apiPath: '/api/ittools/v1/crypto/hash' }],
    outputs: [{ id: 'hash', label: 'Hash Value', type: 'text' }]
  },
  'cry_bcrypt': {
    id: 'cry_bcrypt', title: 'Bcrypt Hash & Verify', description: 'Generate or verify Bcrypt password hashes.',
    inputs: [
        { id: 'password', label: 'Password', type: 'text' },
        { id: 'rounds', label: 'Rounds (Hash only)', type: 'number', defaultValue: 10 },
        { id: 'hash', label: 'Existing Hash (Verify only)', type: 'text', placeholder: '$2y$10$...' }
    ],
    actions: [
        { id: 'hash', label: 'Generate Hash', icon: Lock, apiPath: '/api/ittools/v1/crypto/bcrypt/hash' },
        { id: 'verify', label: 'Verify Hash', icon: CheckCircle, apiPath: '/api/ittools/v1/crypto/bcrypt/verify' }
    ],
    outputs: [{ id: 'hash', label: 'Generated Hash', type: 'text' }, { id: 'valid', label: 'Verification Result', type: 'json' }]
  },
  'ut5': {
    id: 'ut5', title: 'Password Strength', description: 'Analyze password entropy.',
    inputs: [{ id: 'password', label: 'Password', type: 'text' }],
    actions: [{ id: 'check', label: 'Analyze', icon: Shield, apiPath: '/api/ittools/v1/crypto/password/analyze' }],
    outputs: [{ id: 'score', label: 'Analysis', type: 'json' }]
  },
  'cry_enc': {
      id: 'cry_enc', title: 'AES Encryption', description: 'Encrypt text using AES.',
      inputs: [{ id: 'text', label: 'Text', type: 'textarea' }, { id: 'key', label: 'Key', type: 'text' }],
      actions: [{ id: 'encrypt', label: 'Encrypt', icon: Lock, apiPath: '/api/ittools/v1/crypto/encrypt' }],
      outputs: [{ id: 'encrypted', label: 'Encrypted Text', type: 'text' }]
  },
  'cry_dec': {
      id: 'cry_dec', title: 'AES Decryption', description: 'Decrypt AES text.',
      inputs: [{ id: 'encrypted', label: 'Encrypted Data', type: 'textarea' }, { id: 'key', label: 'Key', type: 'text' }],
      actions: [{ id: 'decrypt', label: 'Decrypt', icon: Lock, apiPath: '/api/ittools/v1/crypto/decrypt' }],
      outputs: [{ id: 'decrypted', label: 'Decrypted Text', type: 'text' }]
  },
  'cry_hmac': {
      id: 'cry_hmac', title: 'HMAC Generator', description: 'Create Hash-based Message Authentication Codes.',
      inputs: [
          { id: 'text', label: 'Text', type: 'textarea' },
          { id: 'secret', label: 'Secret Key', type: 'text' },
          { id: 'algorithm', label: 'Algorithm', type: 'select', options: [{label:'SHA256', value:'sha256'}, {label:'SHA512', value:'sha512'}] }
      ],
      actions: [{ id: 'gen', label: 'Generate', icon: Hash, apiPath: '/api/ittools/v1/crypto/hmac' }],
      outputs: [{ id: 'hmac', label: 'HMAC', type: 'text' }]
  },
  'cry_rsa': {
      id: 'cry_rsa', title: 'RSA Key Generator', description: 'Generate RSA Key Pairs.',
      inputs: [{ id: 'key_size', label: 'Key Size', type: 'select', options: [{label:'2048 bit', value:'2048'}, {label:'4096 bit', value:'4096'}] }],
      actions: [{ id: 'gen', label: 'Generate Keys', icon: Shield, apiPath: '/api/ittools/v1/crypto/rsa/generate' }],
      outputs: [{ id: 'publicKey', label: 'Public Key', type: 'text' }, { id: 'privateKey', label: 'Private Key', type: 'text' }]
  },
  'cry_otp_gen': {
      id: 'cry_otp_gen', title: 'OTP Generator', description: 'Generate TOTP Secret and Code.',
      inputs: [],
      actions: [{ id: 'gen', label: 'Generate Secret', icon: Clock, apiPath: '/api/ittools/v1/crypto/otp/generate' }],
      outputs: [{ id: 'otp', label: 'Current OTP', type: 'text' }, { id: 'secret', label: 'Secret', type: 'text' }]
  },
  'cry_otp_ver': {
      id: 'cry_otp_ver', title: 'OTP Verifier', description: 'Verify TOTP Codes.',
      inputs: [{ id: 'otp', label: 'OTP Code', type: 'text' }, { id: 'secret', label: 'Secret Key', type: 'text' }],
      actions: [{ id: 'ver', label: 'Verify', icon: Check, apiPath: '/api/ittools/v1/crypto/otp/verify' }],
      outputs: [{ id: 'valid', label: 'Is Valid?', type: 'json' }]
  },
  'cry_bip39': {
      id: 'cry_bip39', title: 'BIP39 Generator', description: 'Generate Mnemonic Phrases.',
      inputs: [{ id: 'strength', label: 'Strength', type: 'select', options: [{label:'128 bit', value:'128'}, {label:'256 bit', value:'256'}] }],
      actions: [{ id: 'gen', label: 'Generate', icon: Key, apiPath: '/api/ittools/v1/crypto/bip39/generate' }],
      outputs: [{ id: 'mnemonics', label: 'Mnemonic', type: 'json' }]
  },
  'cry_basic_auth': {
      id: 'cry_basic_auth', title: 'Basic Auth Generator', description: 'Create HTTP Basic Auth Headers.',
      inputs: [{ id: 'username', label: 'Username', type: 'text' }, { id: 'password', label: 'Password', type: 'text' }],
      actions: [{ id: 'gen', label: 'Generate', icon: Lock, apiPath: '/api/ittools/v1/crypto/basic-auth' }],
      outputs: [{ id: 'header', label: 'Header Key', type: 'text' }, { id: 'value', label: 'Header Value', type: 'text' }]
  },

  // --- Converters ---
  'cv1': {
    id: 'cv1', title: 'Base64 Tool', description: 'Encode/Decode Base64.',
    inputs: [{ id: 'text', label: 'Input', type: 'textarea' }, { id: 'encoded', label: 'Encoded Input', type: 'textarea' }],
    actions: [
        { id: 'enc', label: 'Encode', icon: Play, apiPath: '/api/ittools/v1/converter/base64/encode' },
        { id: 'dec', label: 'Decode', icon: Play, apiPath: '/api/ittools/v1/converter/base64/decode' }
    ],
    outputs: [{ id: 'encoded', label: 'Encoded', type: 'text' }, { id: 'decoded', label: 'Decoded', type: 'text' }]
  },
  'cv2': {
      id: 'cv2', title: 'URL Tool', description: 'Encode/Decode URLs.',
      inputs: [{ id: 'url', label: 'URL', type: 'textarea' }, { id: 'encoded', label: 'Encoded URL', type: 'textarea' }],
      actions: [
          { id: 'enc', label: 'Encode', icon: Link, apiPath: '/api/ittools/v1/converter/url/encode' },
          { id: 'dec', label: 'Decode', icon: Link, apiPath: '/api/ittools/v1/converter/url/decode' }
      ],
      outputs: [{ id: 'encoded', label: 'Encoded', type: 'text' }, { id: 'decoded', label: 'Decoded', type: 'text' }]
  },
  'cv4': {
    id: 'cv4', title: 'Case Converter', description: 'Convert text casing.',
    inputs: [{ id: 'text', label: 'Text Input', type: 'textarea' }],
    actions: [{ id: 'convert', label: 'Convert', icon: Type, apiPath: '/api/ittools/v1/converter/case' }],
    outputs: [{ id: 'snake_case', label: 'Snake Case', type: 'text' }, { id: 'camelCase', label: 'Camel Case', type: 'text' }]
  },
  'cv11': {
      id: 'cv11', title: 'JSON <> YAML', description: 'Convert between JSON and YAML.',
      inputs: [{ id: 'json', label: 'JSON Input', type: 'textarea' }, { id: 'yaml', label: 'YAML Input', type: 'textarea' }],
      actions: [
          { id: 'to_yaml', label: 'To YAML', icon: RefreshCcw, apiPath: '/api/ittools/v1/converter/json-to-yaml' },
          { id: 'to_json', label: 'To JSON', icon: RefreshCcw, apiPath: '/api/ittools/v1/converter/yaml-to-json' }
      ],
      outputs: [{ id: 'yaml', label: 'YAML Result', type: 'text' }, { id: 'json', label: 'JSON Result', type: 'text' }]
  },
  'conv_temp': {
      id: 'conv_temp', title: 'Temperature Converter', description: 'Convert C/F/K.',
      inputs: [
          { id: 'value', label: 'Value', type: 'number' },
          { id: 'from', label: 'From Unit', type: 'select', options: [{label:'Celsius', value:'celsius'}, {label:'Fahrenheit', value:'fahrenheit'}, {label:'Kelvin', value:'kelvin'}] }
      ],
      actions: [{ id: 'conv', label: 'Convert', icon: RefreshCcw, apiPath: '/api/ittools/v1/converter/temperature' }],
      outputs: [{ id: 'celsius', label: 'Celsius', type: 'text' }, { id: 'fahrenheit', label: 'Fahrenheit', type: 'text' }, { id: 'kelvin', label: 'Kelvin', type: 'text' }]
  },
  'conv_roman': {
      id: 'conv_roman', title: 'Roman Numerals', description: 'Convert Roman to Arabic.',
      inputs: [{ id: 'roman', label: 'Roman Numeral', type: 'text' }],
      actions: [{ id: 'conv', label: 'Convert', icon: Hash, apiPath: '/api/ittools/v1/converter/roman/to-arabic' }],
      outputs: [{ id: 'arabic', label: 'Arabic Number', type: 'text' }]
  },
  'cv6': {
    id: 'cv6', title: 'Timestamp Converter', description: 'Convert DateTime formats.',
    inputs: [
      { id: 'input', label: 'Date String', type: 'text' },
      { id: 'inputFormat', label: 'Format', type: 'select', options: [{label: 'ISO 8601', value: 'iso8601'}, {label: 'Unix Timestamp', value: 'unix'}] }
    ],
    actions: [{ id: 'conv', label: 'Convert', icon: Clock, apiPath: '/api/ittools/v1/converter/datetime' }],
    outputs: [{ id: 'iso8601', label: 'ISO', type: 'text' }, { id: 'unix', label: 'Unix', type: 'text' }]
  },

  // --- Web Tools & Formatters ---
  'fmt1': {
    id: 'fmt1', title: 'JSON Formatter', description: 'Prettify JSON.',
    inputs: [{ id: 'json', label: 'Raw JSON', type: 'textarea' }, { id: 'indent', label: 'Indent', type: 'select', defaultValue: '2', options: [{ label: '2 spaces', value: '2' }, { label: '4 spaces', value: '4' }, { label: '8 spaces', value: '8' }] }],
    actions: [{ id: 'fmt', label: 'Beautify', icon: AlignLeft, apiPath: '/api/ittools/v1/web/json/prettify' }],
    outputs: [{ id: 'prettified', label: 'Formatted JSON', type: 'text' }]
  },
  'web_json_min': {
    id: 'web_json_min', title: 'JSON Minifier', description: 'Minify JSON.',
    inputs: [{ id: 'json', label: 'JSON', type: 'textarea' }],
    actions: [{ id: 'min', label: 'Minify', icon: AlignLeft, apiPath: '/api/ittools/v1/web/json/minify' }],
    outputs: [{ id: 'minified', label: 'Minified JSON', type: 'text' }]
  },
  'web_xml': {
      id: 'web_xml', title: 'XML Formatter', description: 'Format XML string.',
      inputs: [{ id: 'xml', label: 'XML', type: 'textarea' }],
      actions: [{ id: 'fmt', label: 'Format', icon: AlignLeft, apiPath: '/api/ittools/v1/web/xml/format' }],
      outputs: [{ id: 'formatted', label: 'Result', type: 'text' }]
  },
  'web_yaml': {
      id: 'web_yaml', title: 'YAML Formatter', description: 'Format YAML string.',
      inputs: [{ id: 'yaml', label: 'YAML', type: 'textarea' }],
      actions: [{ id: 'fmt', label: 'Format', icon: AlignLeft, apiPath: '/api/ittools/v1/web/yaml/format' }],
      outputs: [{ id: 'formatted', label: 'Result', type: 'text' }]
  },
  'fmt4': {
      id: 'fmt4', title: 'SQL Formatter', description: 'Format SQL queries.',
      inputs: [{ id: 'sql', label: 'SQL', type: 'textarea' }],
      actions: [{ id: 'fmt', label: 'Format', icon: AlignLeft, apiPath: '/api/ittools/v1/web/sql/format' }],
      outputs: [{ id: 'formatted', label: 'Formatted SQL', type: 'text' }]
  },
  'web_md': {
      id: 'web_md', title: 'Markdown to HTML', description: 'Render Markdown.',
      inputs: [{ id: 'markdown', label: 'Markdown', type: 'textarea' }],
      actions: [{ id: 'conv', label: 'Convert', icon: FileText, apiPath: '/api/ittools/v1/web/markdown/to-html' }],
      outputs: [{ id: 'html', label: 'HTML Preview', type: 'html' }]
  },
  'web_jwt': {
      id: 'web_jwt', title: 'JWT Parser', description: 'Decode JSON Web Tokens.',
      inputs: [{ id: 'token', label: 'JWT Token', type: 'textarea' }],
      actions: [{ id: 'parse', label: 'Parse', icon: Lock, apiPath: '/api/ittools/v1/web/jwt/parse' }],
      outputs: [{ id: 'header', label: 'Header', type: 'json' }, { id: 'payload', label: 'Payload', type: 'json' }]
  },
  'gen1': {
    id: 'gen1', title: 'QR Code Generator', description: 'Generate QR codes.',
    inputs: [{ id: 'text', label: 'Content', type: 'text' }, { id: 'size', label: 'Size (px)', type: 'number', defaultValue: 300 }],
    actions: [{ id: 'gen', label: 'Generate', icon: QrCode, apiPath: '/api/ittools/v1/web/qr-code/generate' }],
    outputs: [{ id: 'qrCodeUrl', label: 'QR Code', type: 'image-preview' }]
  },
  'web_wifi': {
      id: 'web_wifi', title: 'WiFi QR Code', description: 'Generate WiFi Access QR.',
      inputs: [
          { id: 'ssid', label: 'SSID', type: 'text' },
          { id: 'password', label: 'Password', type: 'text' },
          { id: 'encryption', label: 'Encryption', type: 'select', options: [{label:'WPA/WPA2', value:'WPA'}, {label:'WEP', value:'WEP'}, {label:'None', value:'nopass'}] }
      ],
      actions: [{ id: 'gen', label: 'Generate', icon: Wifi, apiPath: '/api/ittools/v1/web/wifi-qr-code/generate' }],
      outputs: [{ id: 'qrCodeUrl', label: 'WiFi QR', type: 'image-preview' }]
  },

  // --- Advanced ---
  'img2': {
    id: 'img2', title: 'Image Compressor', description: 'Reduce image size.',
    inputs: [{ id: 'image', label: 'Images', type: 'file', accept: 'image/*' }, { id: 'quality', label: 'Quality (%)', type: 'number', defaultValue: 80 }],
    actions: [{ id: 'compress', label: 'Compress', icon: Upload, apiPath: '/api/ittools/v1/advanced/image/compress' }],
    outputs: [{ id: 'image_data', label: 'Optimized Image', type: 'image-preview' }]
  },
  'adv_img_crop': {
    id: 'adv_img_crop', title: 'Image Cropper', description: 'Crop images.',
    inputs: [
        { id: 'image', label: 'Image', type: 'file', accept: 'image/*' },
        { id: 'width', label: 'Width (px)', type: 'number', defaultValue: 300 },
        { id: 'height', label: 'Height (px)', type: 'number', defaultValue: 300 }
    ],
    actions: [{ id: 'crop', label: 'Crop', icon: Upload, apiPath: '/api/ittools/v1/advanced/image/crop' }],
    outputs: [{ id: 'image_data', label: 'Result', type: 'image-preview' }]
  },
  'adv_pdf_split': {
      id: 'adv_pdf_split', title: 'PDF Splitter', description: 'Split PDF pages.',
      inputs: [{ id: 'pdf', label: 'PDF File', type: 'file', accept: 'application/pdf' }, { id: 'ranges', label: 'Ranges (1-2,5)', type: 'text' }],
      actions: [{ id: 'split', label: 'Split', icon: Upload, apiPath: '/api/ittools/v1/advanced/pdf/split' }],
      outputs: [{ id: 'files', label: 'Files', type: 'json' }]
  }
};

