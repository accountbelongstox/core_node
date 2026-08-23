/** Tool category catalog and default connection configuration. */
import { Calculator, Edit3, FileJson, FileText, Globe, Image as ImageIcon, RefreshCcw, Shield, Wifi } from 'lucide-react';
import type { ToolCategory, ToolConnectionConfig } from '../uiTypes';

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: 'crypto',
    name: 'Crypto & Security',
    icon: Shield,
    tools: [
      { id: 'cry1', name: 'UUID Generator', status: 'available' },
      { id: 'cry_ulid', name: 'ULID Generator', status: 'available' },
      { id: 'cry_token', name: 'Token Generator', status: 'available' },
      { id: 'ut4', name: 'Password Generator', status: 'available' },
      { id: 'ut5', name: 'Password Strength', status: 'available' },
      { id: 'cry_hash', name: 'Hash Generator', status: 'available' },
      { id: 'cry_bcrypt', name: 'Bcrypt Hash/Verify', status: 'available' },
      { id: 'cry_enc', name: 'AES Encrypt', status: 'available' },
      { id: 'cry_dec', name: 'AES Decrypt', status: 'available' },
      { id: 'cry_hmac', name: 'HMAC Generator', status: 'available' },
      { id: 'cry_rsa', name: 'RSA Key Generator', status: 'available' },
      { id: 'cry_otp_gen', name: 'OTP Generator', status: 'available' },
      { id: 'cry_otp_ver', name: 'OTP Verify', status: 'available' },
      { id: 'cry_bip39', name: 'BIP39 Passphrase', status: 'available' },
      { id: 'cry_basic_auth', name: 'Basic Auth Header', status: 'available' },
    ]
  },
  {
    id: 'converters',
    name: 'Converters',
    icon: RefreshCcw,
    tools: [
      { id: 'cv1', name: 'Base64 Converter', status: 'available' },
      { id: 'cv2', name: 'URL Encoder', status: 'available' },
      { id: 'cv4', name: 'Case Converter', status: 'available' },
      { id: 'cv11', name: 'JSON ⇄ YAML', status: 'available' },
      { id: 'cv6', name: 'Timestamp Converter', status: 'available' },
      { id: 'conv_temp', name: 'Temperature Converter', status: 'available' },
      { id: 'conv_roman', name: 'Roman Numerals', status: 'available' },
      { id: 'col1', name: 'HEX to RGB', status: 'available' },
      { id: 'conv_base', name: 'Base Converter', status: 'available' },
      { id: 'conv_base64_file_encode', name: 'Base64 File Encode', status: 'available' },
      { id: 'conv_base64_file_decode', name: 'Base64 File Decode', status: 'available' },
      { id: 'conv_json_csv', name: 'JSON to CSV', status: 'available' },
      { id: 'conv_json_xml', name: 'JSON to XML', status: 'available' },
      { id: 'conv_json_toml', name: 'JSON to TOML', status: 'available' },
      { id: 'conv_toml_json', name: 'TOML to JSON', status: 'available' },
      { id: 'conv_toml_yaml', name: 'TOML to YAML', status: 'available' },
      { id: 'conv_xml_json', name: 'XML to JSON', status: 'available' },
      { id: 'conv_yaml_toml', name: 'YAML to TOML', status: 'available' },
      { id: 'conv_list', name: 'List Converter', status: 'available' },
      { id: 'conv_slugify', name: 'Slug Generator', status: 'available' },
      { id: 'conv_text_binary', name: 'Text to Binary', status: 'available' },
      { id: 'conv_text_unicode', name: 'Text to Unicode', status: 'available' },
      { id: 'conv_text_nato', name: 'Text to NATO', status: 'available' },
    ]
  },
  {
    id: 'web',
    name: 'Web Tools',
    icon: Globe,
    tools: [
      { id: 'web_jwt', name: 'JWT Parser', status: 'available' },
      { id: 'web_md', name: 'Markdown to HTML', status: 'available' },
      { id: 'gen1', name: 'QR Code Generator', status: 'available' },
      { id: 'web_wifi', name: 'WiFi QR Code', status: 'available' },
      { id: 'web_url_parse', name: 'URL Parser', status: 'todo' }, // Placeholder
      { id: 'web_html_encode', name: 'HTML Encode', status: 'available' },
      { id: 'web_html_decode', name: 'HTML Decode', status: 'available' },
      { id: 'web_json_diff', name: 'JSON Diff', status: 'available' },
      { id: 'web_http_status', name: 'HTTP Status Lookup', status: 'available' },
      { id: 'web_mime_types', name: 'MIME Types', status: 'available' },
      { id: 'web_meta_tags', name: 'Meta Tag Generator', status: 'available' },
      { id: 'web_svg_optimize', name: 'SVG Optimizer', status: 'available' },
    ]
  },
  {
    id: 'formatters',
    name: 'Formatters',
    icon: FileJson,
    tools: [
      { id: 'fmt1', name: 'JSON Formatter', status: 'available' },
      { id: 'web_json_min', name: 'JSON Minify', status: 'available' },
      { id: 'fmt4', name: 'SQL Formatter', status: 'available' },
      { id: 'web_xml', name: 'XML Formatter', status: 'available' },
      { id: 'web_yaml', name: 'YAML Formatter', status: 'available' },
    ]
  },
  {
    id: 'image',
    name: 'Image Tools',
    icon: ImageIcon,
    tools: [
      { id: 'img2', name: 'Image Compressor', status: 'available' },
      { id: 'adv_img_crop', name: 'Image Cropper', status: 'available' },
    ]
  },
  {
    id: 'pdf',
    name: 'PDF Tools',
    icon: FileText,
    tools: [
      { id: 'adv_pdf_split', name: 'PDF Splitter', status: 'available' },
    ]
  },
  {
    id: 'calc',
    name: 'Calculators',
    icon: Calculator,
    tools: [
      { id: 'calc1', name: 'Age Calculator', status: 'available' },
      { id: 'calc_bmi', name: 'BMI Calculator', status: 'available' },
      { id: 'calc_gst', name: 'GST Calculator', status: 'available' },
      { id: 'calc_loan_emi', name: 'Loan EMI Calculator', status: 'available' },
      { id: 'calc_num_to_words', name: 'Number to Words', status: 'available' },
      { id: 'calc_math_eval', name: 'Math Evaluator', status: 'available' },
      { id: 'calc_percentage', name: 'Percentage Calculator', status: 'available' },
      { id: 'calc_eta', name: 'ETA Calculator', status: 'available' },
      { id: 'calc_benchmark', name: 'Benchmark', status: 'available' },
    ]
  },
  {
    id: 'text_adv',
    name: 'Text Advanced',
    icon: Edit3,
    tools: [
      { id: 'ta4', name: 'Word Counter', status: 'available' },
      { id: 'txt_regex', name: 'Regex Tester', status: 'available' },
      { id: 'txt_diff', name: 'Text Diff', status: 'available' },
      { id: 'txt_email_normalize', name: 'Email Normalizer', status: 'available' },
      { id: 'txt_numeronym', name: 'Numeronym Generator', status: 'available' },
      { id: 'txt_ascii_art', name: 'ASCII Art', status: 'available' },
      { id: 'txt_crontab', name: 'Crontab Parser', status: 'available' },
      { id: 'txt_phone', name: 'Phone Parser', status: 'available' },
      { id: 'txt_iban', name: 'IBAN Validator', status: 'available' },
      { id: 'txt_safelink', name: 'Safelink Encoder', status: 'available' },
      { id: 'txt_emoji', name: 'Emoji Picker', status: 'available' },
      { id: 'txt_git_memo', name: 'Git Commit Memo', status: 'available' },
      { id: 'txt_obfuscate', name: 'Text Obfuscator', status: 'available' },
      { id: 'txt_lorem', name: 'Lorem Ipsum', status: 'available' },
    ]
  },
  {
    id: 'network',
    name: 'Network',
    icon: Wifi,
    tools: [
      { id: 'net_ipv4_convert', name: 'IPv4 Converter', description: 'Convert an IPv4 address to decimal, hex and binary.', status: 'available' },
      { id: 'net_ipv4_subnet', name: 'IPv4 Subnet Calculator', description: 'Compute network, broadcast, mask and host range from IP/CIDR.', status: 'available' },
      { id: 'net_ipv4_expand', name: 'IPv4 Range Expander', description: 'Expand a start-end IPv4 range into a list of addresses.', status: 'available' },
      { id: 'net_ipv6_ula', name: 'IPv6 ULA Generator', description: 'Generate random IPv6 unique local addresses (fd00::/8).', status: 'available' },
      { id: 'net_mac_generate', name: 'MAC Address Generator', description: 'Generate random MAC addresses.', status: 'available' },
      { id: 'net_mac_lookup', name: 'MAC Address Lookup', description: 'Look up the vendor for a MAC address OUI prefix.', status: 'available' },
      { id: 'net_user_agent', name: 'User-Agent Parser', description: 'Parse a User-Agent string into browser, OS and device.', status: 'available' },
      { id: 'net_chmod', name: 'Chmod Calculator', description: 'Convert an octal file mode to symbolic permissions.', status: 'available' },
      { id: 'net_port_random', name: 'Random Port Generator', description: 'Generate random port numbers within a range.', status: 'available' },
    ],
  }
];

export const DEFAULT_API_CONFIGS: Record<string, ToolConnectionConfig> = {
  'calc1': { toolId: 'calc1', apiUrl: '', mode: 'local' }, 
  'col1': { toolId: 'col1', apiUrl: '', mode: 'local' }, 
  'ut4': { toolId: 'ut4', apiUrl: '', mode: 'local' }, 
  'ta4': { toolId: 'ta4', apiUrl: '', mode: 'local' }, 
};
