/** WfNewApiTypes - the SINGLE shared TYPE surface barrel. Each domain lives in
 * ./types/*.ts (extracted to keep every source file under the 800-line modular
 * limit); this barrel re-exports them so every existing `import { X } from
 * './WfNewApiTypes'` resolves unchanged. The golden rule still holds: both
 * WfNewApiHttp and WfNewApiMock implement WfNewApi using these exact types. */

export * from './types/core';
export * from './types/media';
export * from './types/user';
export * from './types/social';
export * from './types/analytics';
export * from './types/endpoints';
export * from './types/api';
