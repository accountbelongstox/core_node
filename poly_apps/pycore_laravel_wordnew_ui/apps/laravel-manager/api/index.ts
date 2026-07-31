/**
 * Laravel Manager API boundary.
 *
 * Laravel Manager components import only this module. Shared transport,
 * authentication, persistence, and event primitives remain under core.
 */
export { api } from './LaravelManagerApi';
export type { APIResponse } from './LaravelManagerApi';
export * from './modules/AiManagementAPI';
export * from './modules/AiStatusAPI';
export * from './modules/AppQyV1';
export * from './modules/ArticleAPI';
export * from './modules/BooksAPI';
export * from './modules/DatabaseManagerAPI';
export * from './modules/DevHistoryAPI';
export * from './modules/InviteCodeAPI';
export * from './modules/MediaQueryAPI';
export * from './modules/ServerManagerAPI';
export * from './modules/SystemConfigAPI';
export * from './modules/WordAudioAPI';
export { getSharedBaseURL, setSharedBaseURL } from './base/BaseAPI';
