import { defineAsyncComponent } from 'vue';

// Complete Tool Component Registry
// Maps all tool IDs to their Vue component loaders
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

  // ================== WEB TOOLS (16 tools) ==================
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

  // ================== TEXT TOOLS (10 tools) ==================
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

  // ================== IMAGE TOOLS (7 tools) ==================
  image_resizer: () => import('./image/ImageResizerTool.vue'),
  image_compressor: () => import('./image/ImageCompressorTool.vue'),
  image_converter: () => import('./image/ImageConverterTool.vue'),
  image_rotate: () => import('./image/ImageRotateTool.vue'),
  image_crop: () => import('./image/ImageCropTool.vue'),
  image_color_extractor: () => import('./image/ImageColorExtractorTool.vue'),
  svg_placeholder_generator: () => import('./image/SvgPlaceholderTool.vue'),

  // ================== CALCULATOR TOOLS (5 tools) ==================
  age_calculator: () => import('./calculator/AgeCalculatorTool.vue'),
  bmi_calculator: () => import('./calculator/BMICalculatorTool.vue'),
  loan_emi_calculator: () => import('./calculator/LoanEMICalculatorTool.vue'),
  gst_calculator: () => import('./calculator/GSTCalculatorTool.vue'),
  number_to_words: () => import('./calculator/NumberToWordsTool.vue'),

  // ================== PDF TOOLS (5 tools) ==================
  pdf_split: () => import('./pdf/PdfSplitTool.vue'),
  pdf_merge: () => import('./pdf/PdfMergeTool.vue'),
  pdf_compress: () => import('./pdf/PdfCompressTool.vue'),
  pdf_rotate: () => import('./pdf/PdfRotateTool.vue'),
  pdf_password: () => import('./pdf/PdfPasswordTool.vue'),

  // ================== DEVELOPMENT TOOLS (7 tools) ==================
  git_memo: () => import('./development/GitMemoTool.vue'),
  chmod_calculator: () => import('./development/ChmodCalculatorTool.vue'),
  docker_run_to_docker_compose_converter: () => import('./development/DockerConverterTool.vue'),
  device_information: () => import('./development/DeviceInfoTool.vue'),
  keycode_info: () => import('./development/KeycodeInfoTool.vue'),
  random_port_generator: () => import('./development/RandomPortTool.vue'),
  iban_validator_and_parser: () => import('./development/IbanValidatorTool.vue'),

  // ================== DATA TOOLS ==================
  safelink_decoder: () => import('./data/SafelinkDecoderTool.vue'),
  numeronym_generator: () => import('./data/NumeronymTool.vue'),
};

// Fallback component for tools without dedicated UI
const DefaultToolLoader = () => import('./UniversalToolForm.vue');

export const getToolComponent = (toolId: string | null | undefined) => {
  if (!toolId) return null;
  const loader = TOOL_COMPONENT_MAP[toolId];
  return loader ? defineAsyncComponent(loader) : defineAsyncComponent(DefaultToolLoader);
};

// Check if a tool has a dedicated component
export const hasToolComponent = (toolId: string): boolean => {
  return toolId in TOOL_COMPONENT_MAP;
};

// Get all registered tool IDs
export const getRegisteredToolIds = (): string[] => {
  return Object.keys(TOOL_COMPONENT_MAP);
};
