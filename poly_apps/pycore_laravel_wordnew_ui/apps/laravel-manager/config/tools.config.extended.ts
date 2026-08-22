/** Composed extended IT tool registry. */
import { CONVERTER_TOOLS } from './tools.config.extended.converters';
import { MATH_TOOLS, NETWORK_TOOLS } from './tools.config.extended.system';
import { TEXT_PROCESSING_TOOLS, WEB_DEVELOPMENT_TOOLS } from './tools.config.extended.web-text';

export { CONVERTER_TOOLS, MATH_TOOLS, NETWORK_TOOLS, TEXT_PROCESSING_TOOLS, WEB_DEVELOPMENT_TOOLS };

export const ALL_EXTENDED_IT_TOOLS = {
  ...CONVERTER_TOOLS,
  ...WEB_DEVELOPMENT_TOOLS,
  ...TEXT_PROCESSING_TOOLS,
  ...MATH_TOOLS,
  ...NETWORK_TOOLS,
};

