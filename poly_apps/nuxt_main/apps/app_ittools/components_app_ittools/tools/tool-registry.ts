import { defineAsyncComponent } from 'vue';

const TOOL_COMPONENT_MAP: Record<string, () => Promise<any>> = {
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
  base64_string_converter: () => import('./converter/Base64ConverterTool.vue'),
  url_encoder: () => import('./converter/UrlConverterTool.vue'),
  case_converter: () => import('./converter/CaseConverterTool.vue'),
  color_converter: () => import('./converter/ColorConverterTool.vue'),
  slugify_string: () => import('./converter/SlugifyTool.vue'),
  temperature_converter: () => import('./converter/TemperatureConverterTool.vue'),
  json_to_yaml_converter: () => import('./converter/JsonToYamlTool.vue'),
  yaml_to_json_converter: () => import('./converter/YamlToJsonTool.vue'),
  json_to_xml_converter: () => import('./converter/JsonToXmlTool.vue'),
  xml_to_json_converter: () => import('./converter/XmlToJsonTool.vue'),
  markdown_to_html_converter: () => import('./converter/MarkdownToHtmlTool.vue'),
  list_converter: () => import('./converter/ListConverterTool.vue')
};

export const getToolComponent = (toolId: string | null | undefined) => {
  if (!toolId) return null;
  const loader = TOOL_COMPONENT_MAP[toolId];
  return loader ? defineAsyncComponent(loader) : null;
};
