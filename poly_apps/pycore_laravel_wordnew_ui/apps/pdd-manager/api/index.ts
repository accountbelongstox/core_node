/** PDD Manager-owned API boundary over the shared Laravel transport. */
import { createLaravelModuleConfig } from '../../laravel-manager/api/ApiContract';
import { PddAdminAPI } from './PddAdminAPI';

const pddAdmin = new PddAdminAPI(createLaravelModuleConfig('/api/pdd/admin'));

export const api = { pddAdmin } as const;
export * from './PddAdminAPI';
