/** PDD Manager-owned API boundary over the shared Laravel transport. */
import { createLaravelModuleConfig } from '../../../core/api-libs/laravel/transport/ApiContract';
import { PddAdminAPI } from './PddAdminAPI';

const pddAdmin = new PddAdminAPI(createLaravelModuleConfig('/api/pdd/admin'));

export const api = { pddAdmin } as const;
export * from './PddAdminAPI';
