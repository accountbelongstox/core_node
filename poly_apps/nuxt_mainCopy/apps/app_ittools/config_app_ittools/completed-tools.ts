// List of completed and tested tools
export const COMPLETED_TOOLS = new Set([
  // Batch 1: Crypto Tools (8 completed)
  'hash_text',
  'bcrypt',
  'uuid_generator',
  'token_generator',
  'ulid_generator',
  'bip39_generator',
  'hmac_generator',
  'rsa_key_pair_generator',

  // Batch 2: Additional Crypto & Converters (8 completed)
  'encryption',
  'password_strength_analyser',
  'otp_code_generator_and_validator',
  'basic_auth_generator',
  'random_port_generator',
  'numeronym_generator',
  'base64_string_converter',
  'url_encoder',

  // Additional base tools
  'json_prettify',
  'json_minify',

  // Batch 3: Converters & Web Tools (8 completed)
  'yaml_to_json_converter',
  'json_to_yaml_converter',
  'xml_to_json_converter',
  'json_to_xml_converter',
  'markdown_to_html_converter',
  'color_converter',
  'case_converter',
  'html_entities'
]);

export function isToolCompleted(toolId: string): boolean {
  return COMPLETED_TOOLS.has(toolId);
}
