import { defineAsyncComponent } from 'vue';

// Complete Tool Component Registry
// Maps all tool IDs to their Vue component loaders
// Synced with Laravel ittools-menu-config.js
const TOOL_COMPONENT_MAP: Record<string, () => Promise<any>> = {
  // ================== CRYPTO TOOLS (12 tools) ==================
  hash_text: () => import('./crypto/HashTextTool.vue'),
  token_generator: () => import('./crypto/TokenGeneratorTool.vue'),
  bcrypt: () => import('./crypto/BcryptTool.vue'),
  uuid_generator: () => import('./crypto/UUIDGeneratorTool.vue'),
  ulid_generator: () => import('./crypto/ULIDGeneratorTool.vue'),
  bip39_generator: () => import('./crypto/Bip39GeneratorTool.vue'),
  hmac_generator: () => import('./crypto/HmacGeneratorTool.vue'),
  rsa_key_pair_generator: () => import('./crypto/RsaKeyPairGeneratorTool.vue'),
  otp_code_generator_and_validator: () => import('./crypto/OtpTool.vue'),
  encryption: () => import('./crypto/EncryptionTool.vue'),
  password_strength_analyser: () => import('./crypto/PasswordStrengthTool.vue'),
  basic_auth_generator: () => import('./crypto/BasicAuthTool.vue'),

  // ================== CONVERTER TOOLS (22 tools) ==================
  base64_string_converter: () => import('./converter/Base64ConverterTool.vue'),
  base64_file_converter: () => import('./converter/Base64FileConverterTool.vue'),
  url_encoder: () => import('./converter/UrlConverterTool.vue'),
  case_converter: () => import('./converter/CaseConverterTool.vue'),
  color_converter: () => import('./converter/ColorConverterTool.vue'),
  slugify_string: () => import('./converter/SlugifyTool.vue'),
  temperature_converter: () => import('./converter/TemperatureConverterTool.vue'),
  date_time_converter: () => import('./converter/DateTimeConverterTool.vue'),
  json_to_yaml_converter: () => import('./converter/JsonToYamlTool.vue'),
  yaml_to_json_converter: () => import('./converter/YamlToJsonTool.vue'),
  json_to_xml_converter: () => import('./converter/JsonToXmlTool.vue'),
  xml_to_json_converter: () => import('./converter/XmlToJsonTool.vue'),
  markdown_to_html_converter: () => import('./converter/MarkdownToHtmlTool.vue'),
  list_converter: () => import('./converter/ListConverterTool.vue'),
  text_to_binary: () => import('./converter/TextEncodingTool.vue'),
  text_to_unicode: () => import('./converter/TextEncodingTool.vue'),
  text_to_nato_alphabet: () => import('./converter/TextEncodingTool.vue'),
  integer_base_converter: () => import('./converter/IntegerBaseConverterTool.vue'),
  roman_numeral_converter: () => import('./converter/RomanNumeralConverterTool.vue'),
  json_to_toml_converter: () => import('./converter/JsonToTomlTool.vue'),
  toml_to_json_converter: () => import('./converter/TomlToJsonTool.vue'),
  toml_to_yaml_converter: () => import('./converter/TomlToYamlTool.vue'),
  yaml_to_toml_converter: () => import('./converter/YamlToTomlTool.vue'),
  html_entities: () => import('./converter/HtmlEntitiesTool.vue'),

  // ================== WEB TOOLS (18 tools) ==================
  json_prettify: () => import('./web/JsonPrettifyTool.vue'),
  json_minify: () => import('./web/JsonMinifyTool.vue'),
  json_diff: () => import('./web/JsonDiffTool.vue'),
  json_to_csv_converter: () => import('./web/JsonToCsvTool.vue'),
  url_parser: () => import('./web/UrlParserTool.vue'),
  jwt_parser: () => import('./web/JwtParserTool.vue'),
  qr_code_generator: () => import('./web/QrCodeGeneratorTool.vue'),
  wifi_qr_code_generator: () => import('./web/WifiQrCodeGeneratorTool.vue'),
  meta_tag_generator: () => import('./web/MetaTagGeneratorTool.vue'),
  http_status_codes: () => import('./web/HttpStatusCodesTool.vue'),
  mime_types: () => import('./web/MimeTypesTool.vue'),
  html_wysiwyg_editor: () => import('./web/HtmlWysiwygEditorTool.vue'),
  sql_prettify: () => import('./web/SqlPrettifyTool.vue'),
  xml_formatter: () => import('./web/XmlFormatterTool.vue'),
  yaml_viewer: () => import('./web/YamlViewerTool.vue'),
  user_agent_parser: () => import('./web/UserAgentParserTool.vue'),
  query_string_parser: () => import('./web/QueryStringParserTool.vue'),

  // ================== FORMATTER TOOLS (2 new) ==================
  html_formatter: () => import('./formatter/HtmlFormatterTool.vue'),
  css_formatter: () => import('./formatter/CssFormatterTool.vue'),

  // ================== MATH TOOLS (5 tools) ==================
  math_evaluator: () => import('./math/MathEvaluatorTool.vue'),
  percentage_calculator: () => import('./math/PercentageCalculatorTool.vue'),
  eta_calculator: () => import('./math/EtaCalculatorTool.vue'),
  benchmark_builder: () => import('./math/BenchmarkBuilderTool.vue'),
  chronometer: () => import('./math/ChronometerTool.vue'),

  // ================== NETWORK TOOLS (6 tools) ==================
  ipv4_address_converter: () => import('./network/Ipv4AddressConverterTool.vue'),
  ipv4_subnet_calculator: () => import('./network/Ipv4SubnetCalculatorTool.vue'),
  ipv4_range_expander: () => import('./network/Ipv4RangeExpanderTool.vue'),
  ipv6_ula_generator: () => import('./network/Ipv6UlaGeneratorTool.vue'),
  mac_address_generator: () => import('./network/MacAddressGeneratorTool.vue'),
  mac_address_lookup: () => import('./network/MacAddressLookupTool.vue'),

  // ================== TEXT TOOLS (15 tools) ==================
  text_statistics: () => import('./text/TextStatisticsTool.vue'),
  lorem_ipsum_generator: () => import('./text/LoremIpsumGeneratorTool.vue'),
  regex_tester: () => import('./text/RegexTesterTool.vue'),
  text_diff: () => import('./text/TextDiffTool.vue'),
  ascii_text_drawer: () => import('./text/AsciiArtTool.vue'),
  crontab_generator: () => import('./text/CrontabParserTool.vue'),
  phone_parser_and_formatter: () => import('./text/PhoneParserTool.vue'),
  email_normalizer: () => import('./text/EmailNormalizerTool.vue'),
  string_obfuscator: () => import('./text/StringObfuscatorTool.vue'),
  emoji_picker: () => import('./text/EmojiPickerTool.vue'),
  duplicate_line_remover: () => import('./text/DuplicateRemoverTool.vue'),
  text_sorter: () => import('./text/TextSorterTool.vue'),
  text_reverser: () => import('./text/TextReverserTool.vue'),
  word_counter_seo: () => import('./text/WordCounterSeoTool.vue'),
  keyword_density_checker: () => import('./text/KeywordDensityTool.vue'),

  // ================== IMAGE TOOLS (7 tools) ==================
  image_resizer: () => import('./image/ImageResizerTool.vue'),
  image_compressor: () => import('./image/ImageCompressorTool.vue'),
  image_converter: () => import('./image/ImageConverterTool.vue'),
  image_rotate: () => import('./image/ImageRotateTool.vue'),
  image_crop: () => import('./image/ImageCropTool.vue'),
  image_color_extractor: () => import('./image/ImageColorExtractorTool.vue'),
  svg_placeholder_generator: () => import('./image/SvgPlaceholderTool.vue'),

  // ================== CALCULATOR TOOLS (7 tools) ==================
  age_calculator: () => import('./calculator/AgeCalculatorTool.vue'),
  bmi_calculator: () => import('./calculator/BMICalculatorTool.vue'),
  loan_emi_calculator: () => import('./calculator/LoanEMICalculatorTool.vue'),
  gst_calculator: () => import('./calculator/GSTCalculatorTool.vue'),
  number_to_words: () => import('./calculator/NumberToWordsTool.vue'),
  unit_converter: () => import('./calculator/UnitConverterTool.vue'),
  currency_converter: () => import('./calculator/CurrencyConverterTool.vue'),

  // ================== PDF TOOLS (9 tools) ==================
  pdf_split: () => import('./pdf/PdfSplitTool.vue'),
  pdf_merge: () => import('./pdf/PdfMergeTool.vue'),
  pdf_compress: () => import('./pdf/PdfCompressTool.vue'),
  pdf_rotate: () => import('./pdf/PdfRotateTool.vue'),
  pdf_password: () => import('./pdf/PdfPasswordTool.vue'),
  pdf_unlock: () => import('./pdf/PdfUnlockTool.vue'),
  pdf_watermark: () => import('./pdf/PdfWatermarkTool.vue'),
  pdf_to_image: () => import('./pdf/PdfToImageTool.vue'),
  image_to_pdf: () => import('./pdf/ImageToPdfTool.vue'),

  // ================== COLOR TOOLS (4 tools) ==================
  gradient_generator: () => import('./color/GradientGeneratorTool.vue'),
  contrast_checker: () => import('./color/ContrastCheckerTool.vue'),
  palette_generator: () => import('./color/PaletteGeneratorTool.vue'),
  color_blindness_simulator: () => import('./color/ColorBlindnessTool.vue'),

  // ================== DEVELOPMENT TOOLS (8 tools) ==================
  git_memo: () => import('./development/GitMemoTool.vue'),
  chmod_calculator: () => import('./development/ChmodCalculatorTool.vue'),
  docker_run_to_docker_compose_converter: () => import('./development/DockerConverterTool.vue'),
  device_information: () => import('./development/DeviceInfoTool.vue'),
  keycode_info: () => import('./development/KeycodeInfoTool.vue'),
  random_port_generator: () => import('./development/RandomPortTool.vue'),
  iban_validator_and_parser: () => import('./development/IbanValidatorTool.vue'),
  regex_cheatsheet: () => import('./development/RegexCheatsheetTool.vue'),

  // ================== UTILITY TOOLS (4 tools) ==================
  qr_scanner: () => import('./utility/QrScannerTool.vue'),
  barcode_generator: () => import('./utility/BarcodeGeneratorTool.vue'),
  timezone_converter: () => import('./utility/TimezoneConverterTool.vue'),
  password_generator_advanced: () => import('./utility/PasswordGeneratorTool.vue'),

  // ================== DATA TOOLS ==================
  safelink_decoder: () => import('./data/SafelinkDecoderTool.vue'),
  numeronym_generator: () => import('./data/NumeronymTool.vue'),
};

// Alias mappings for Laravel menu IDs to Nuxt tool IDs
const ALIAS_MAP: Record<string, string> = {
  // Laravel ID -> Nuxt ID
  'hash-generator': 'hash_text',
  'bcrypt-tool': 'bcrypt',
  'password-analyzer': 'password_strength_analyser',
  'basic-auth-generator': 'basic_auth_generator',
  'rsa-generator': 'rsa_key_pair_generator',
  'otp-generator': 'otp_code_generator_and_validator',
  'base64-encoder': 'base64_string_converter',
  'base64-file': 'base64_file_converter',
  'url-encoder': 'url_encoder',
  'html-encoder': 'html_entities',
  'timestamp-converter': 'date_time_converter',
  'base-converter': 'integer_base_converter',
  'roman-converter': 'roman_numeral_converter',
  'nato-converter': 'text_to_nato_alphabet',
  'ascii-binary': 'text_to_binary',
  'json-yaml': 'json_to_yaml_converter',
  'json-xml': 'json_to_xml_converter',
  'markdown-html': 'markdown_to_html_converter',
  'slugify': 'slugify_string',
  'hex-rgb-converter': 'color_converter',
  'text-diff': 'text_diff',
  'text-stats': 'text_statistics',
  'lorem-generator': 'lorem_ipsum_generator',
  'ascii-art': 'ascii_text_drawer',
  'json-formatter': 'json_prettify',
  'sql-formatter': 'sql_prettify',
  'yaml-formatter': 'yaml_viewer',
  'qr-generator': 'qr_code_generator',
  'wifi-qr': 'wifi_qr_code_generator',
  'svg-placeholder': 'svg_placeholder_generator',
  'random-port': 'random_port_generator',
  'crontab-generator': 'crontab_generator',
  'og-meta': 'meta_tag_generator',
  'math-evaluator': 'math_evaluator',
  'percentage-calc': 'percentage_calculator',
  'eta-calculator': 'eta_calculator',
  'ipv4-subnet': 'ipv4_subnet_calculator',
  'ipv4-converter': 'ipv4_address_converter',
  'ipv6-ula': 'ipv6_ula_generator',
  'mac-lookup': 'mac_address_lookup',
  'mac-generator': 'mac_address_generator',
  'regex-tester': 'regex_tester',
  'git-cheatsheet': 'git_memo',
  'chmod-calculator': 'chmod_calculator',
  'docker-converter': 'docker_run_to_docker_compose_converter',
  'json-diff': 'json_diff',
  'json-csv': 'json_to_csv_converter',
  'phone-parser': 'phone_parser_and_formatter',
  'iban-validator': 'iban_validator_and_parser',
  'email-normalizer': 'email_normalizer',
  'device-info': 'device_information',
  'keycode-info': 'keycode_info',
  'http-status': 'http_status_codes',
  'mime-types': 'mime_types',
  'user-agent-parser': 'user_agent_parser',
  'jwt-parser': 'jwt_parser',
  'url-parser': 'url_parser',
  'query-string-parser': 'query_string_parser',
  'duplicate-remover': 'duplicate_line_remover',
  'text-sorter': 'text_sorter',
  'text-reverser': 'text_reverser',
  'word-counter-seo': 'word_counter_seo',
  'age-calculator': 'age_calculator',
  'bmi-calculator': 'bmi_calculator',
  'loan-calculator': 'loan_emi_calculator',
  'gst-calculator': 'gst_calculator',
  'percentage-calculator': 'percentage_calculator',
  'number-to-words': 'number_to_words',
  'unit-converter-advanced': 'unit_converter',
  'unit-converter': 'unit_converter',
  'gradient-generator': 'gradient_generator',
  'contrast-checker': 'contrast_checker',
  'palette-generator': 'palette_generator',
  'color-blindness': 'color_blindness_simulator',
  'qr-scanner': 'qr_scanner',
  'barcode-generator': 'barcode_generator',
  'timezone-converter': 'timezone_converter',
  'html-formatter': 'html_formatter',
  'css-formatter': 'css_formatter',
  'regex-cheatsheet': 'regex_cheatsheet',
  'image-converter': 'image_converter',
  'image-compressor': 'image_compressor',
  'image-resizer': 'image_resizer',
  'image-cropper': 'image_crop',
  'image-rotator': 'image_rotate',
  'color-picker-image': 'image_color_extractor',
  'pdf-merger': 'pdf_merge',
  'pdf-splitter': 'pdf_split',
  'pdf-compressor': 'pdf_compress',
  'pdf-password': 'pdf_password',
  'pdf-rotate': 'pdf_rotate',
  'pdf-unlock': 'pdf_unlock',
  'pdf-watermark': 'pdf_watermark',
  'pdf-to-image': 'pdf_to_image',
  'image-to-pdf': 'image_to_pdf',
  'keyword-density': 'keyword_density_checker',
  'keyword-density-tool': 'keyword_density_checker',
  'word-counter-blog': 'word_counter_seo',
  'password-generator-advanced': 'password_generator_advanced',
  'password-strength': 'password_strength_analyser',
  'currency-converter': 'currency_converter',
  'string-obfuscator': 'string_obfuscator',
  'numeronym-generator': 'numeronym_generator',
  'emoji-picker': 'emoji_picker',
};

// Fallback component for tools without dedicated UI
const DefaultToolLoader = () => import('./UniversalToolForm.vue');

// Resolve tool ID (handle aliases)
const resolveToolId = (toolId: string): string => {
  return ALIAS_MAP[toolId] || toolId;
};

export const getToolComponent = (toolId: string | null | undefined) => {
  if (!toolId) return null;
  const resolvedId = resolveToolId(toolId);
  const loader = TOOL_COMPONENT_MAP[resolvedId];
  return loader ? defineAsyncComponent(loader) : defineAsyncComponent(DefaultToolLoader);
};

// Check if a tool has a dedicated component
export const hasToolComponent = (toolId: string): boolean => {
  const resolvedId = resolveToolId(toolId);
  return resolvedId in TOOL_COMPONENT_MAP;
};

// Get all registered tool IDs
export const getRegisteredToolIds = (): string[] => {
  return Object.keys(TOOL_COMPONENT_MAP);
};

// Get all tool aliases
export const getToolAliases = (): Record<string, string> => {
  return { ...ALIAS_MAP };
};
