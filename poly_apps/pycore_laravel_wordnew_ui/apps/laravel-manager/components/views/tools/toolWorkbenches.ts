/** Tool id → workbench registry composed from the category groups. */
import type { ToolWorkbench, ToolWorkbenchMap } from './toolWorkbenchTypes';
import { CRYPTO_WORKBENCHES } from './crypto';
import { CONVERT_WORKBENCHES } from './convert';
import { WEB_WORKBENCHES } from './web';
import { TEXT_WORKBENCHES } from './text';
import { MEDIA_WORKBENCHES } from './media';
import { CALC_WORKBENCHES } from './calc';
import { OPS_WORKBENCHES } from './ops';

const TOOL_WORKBENCHES: ToolWorkbenchMap = {
  ...CRYPTO_WORKBENCHES,
  ...CONVERT_WORKBENCHES,
  ...WEB_WORKBENCHES,
  ...TEXT_WORKBENCHES,
  ...MEDIA_WORKBENCHES,
  ...CALC_WORKBENCHES,
  ...OPS_WORKBENCHES,
};

export const getToolWorkbench = (toolId: string): ToolWorkbench | undefined => TOOL_WORKBENCHES[toolId];
