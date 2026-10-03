/** Canonical tool catalog: alias folding, category groups and localized labels. */
import type { TFunction } from 'i18next';
import { ALL_TOOLS } from '@/apps/laravel-manager/config/tools.config';
import type { ToolDefinition } from '@/apps/laravel-manager/types';

export type ToolGroup = 'crypto' | 'convert' | 'web' | 'text' | 'media' | 'calc' | 'ops';

/** Duplicate definitions folded into one canonical tool; the alias id is passed as the workbench variant. */
export const TOOL_ALIASES: Record<string, string> = {
  hashTextTool: 'hashGenerator',
  hashGeneratorUnified: 'hashGenerator',
  cryptoUuidGenerator: 'uuidGenerator',
  uuidGeneratorUnified: 'uuidGenerator',
  uuidGeneratorV2: 'uuidGenerator',
  ulidGenerator: 'uuidGenerator',
  hmacGeneratorUnified: 'hmacGenerator',
  hmacGeneratorV2: 'hmacGenerator',
  tokenGeneratorUnified: 'tokenGenerator',
  bcryptVerifier: 'bcryptGenerator',
  otpVerifier: 'otpGenerator',
  textDecryption: 'textEncryption',
  base64EncoderV2: 'base64Converter',
  base64DecoderV2: 'base64Converter',
  urlDecoder: 'urlEncoder',
  textDecoder: 'textEncoder',
  caseConverterUnified: 'caseConverter',
  slugifyUnified: 'slugGenerator',
  yamlToJson: 'jsonToYaml',
  jsonToToml: 'jsonToYaml',
  tomlToJson: 'jsonToYaml',
  tomlToYaml: 'jsonToYaml',
  yamlToToml: 'jsonToYaml',
  jsonToXml: 'jsonToYaml',
  xmlToJson: 'jsonToYaml',
  htmlDecoder: 'htmlEncoder',
  jsonMinifier: 'jsonFormatter',
  mimeTypesLookup: 'mimeTypeLookup',
};

const CATEGORY_GROUPS: Record<string, { group: ToolGroup; key: string }> = {
  'Crypto & Security': { group: 'crypto', key: 'crypto' },
  Converters: { group: 'convert', key: 'converters' },
  'Web Development': { group: 'web', key: 'web' },
  'Text Processing': { group: 'text', key: 'text' },
  'Image Tools': { group: 'media', key: 'image' },
  'PDF Tools': { group: 'media', key: 'pdf' },
  'Math & Calculators': { group: 'calc', key: 'math' },
  'Network Tools': { group: 'calc', key: 'network' },
  'AI Tools': { group: 'ops', key: 'ai' },
  'Server Manager': { group: 'ops', key: 'server' },
  'Media Tools': { group: 'ops', key: 'media' },
  Vocabulary: { group: 'ops', key: 'vocabulary' },
};

const GROUP_NAMESPACES: Record<ToolGroup, string> = {
  crypto: 'toolsCrypto',
  convert: 'toolsConvert',
  web: 'toolsWeb',
  text: 'toolsText',
  media: 'toolsMedia',
  calc: 'toolsCalc',
  ops: 'toolsOps',
};

export const canonicalToolId = (toolId: string): string => TOOL_ALIASES[toolId] ?? toolId;

export const CANONICAL_TOOLS: ToolDefinition[] = Object.values(ALL_TOOLS).filter((tool) => !TOOL_ALIASES[tool.id]);

export const getCanonicalTool = (toolId: string): ToolDefinition | undefined => ALL_TOOLS[canonicalToolId(toolId)];

export const getToolGroup = (tool: ToolDefinition): ToolGroup | null => CATEGORY_GROUPS[tool.category]?.group ?? null;

export const getToolNamespace = (tool: ToolDefinition): string | null => {
  const group = getToolGroup(tool);
  return group ? GROUP_NAMESPACES[group] : null;
};

export const listToolCategories = (): string[] => Array.from(new Set(CANONICAL_TOOLS.map((tool) => tool.category)));

export const categoryLabel = (t: TFunction, category: string): string => {
  const entry = CATEGORY_GROUPS[category];
  return entry ? t(`uiTools.categories.${entry.key}`, { defaultValue: category }) : category;
};

export const toolLabel = (t: TFunction, tool: ToolDefinition): string => {
  const ns = getToolNamespace(tool);
  return ns ? t(`${ns}.catalog.${tool.id}.name`, { defaultValue: tool.name }) : tool.name;
};

export const toolSummary = (t: TFunction, tool: ToolDefinition): string => {
  const ns = getToolNamespace(tool);
  return ns ? t(`${ns}.catalog.${tool.id}.description`, { defaultValue: tool.description }) : tool.description;
};
