import { AppQyV1API } from './modules/AppQyV1';
import { McpV1API } from './modules/McpV1';
import { ServerManagerV1API } from './modules/ServerManagerV1';
import { ServerManagerAPI } from './modules/ServerManagerAPI';
import { ItToolsV1API } from './modules/ItToolsV1';
import { InviteCodeAPI } from './modules/InviteCodeAPI';
import { SystemConfigAPI } from './modules/SystemConfigAPI';
import { AuthAPI } from './modules/AuthAPI';
import { DatabaseManagerAPI, AuthDebugAPI } from './modules/DatabaseManagerAPI';
import { CodeUpdateAPI } from './modules/CodeUpdateAPI';
import { MediaQueryAPI } from './modules/MediaQueryAPI';
import { BooksAPI } from './modules/BooksAPI';
import { CodeBrowserAPI } from './modules/CodeBrowserAPI';
import { AiStatusAPI } from './modules/AiStatusAPI';
import { AiManagementAPI } from './modules/AiManagementAPI';
import { WordAudioAPI } from './modules/WordAudioAPI';
import { DevHistoryAPI } from './modules/DevHistoryAPI';
import { ArticleAPI } from './modules/ArticleAPI';
import { BaseAPI, setSharedAuthToken, setSharedBaseURL } from './base/BaseAPI';
import { createLaravelModuleConfig, LARAVEL_API_PREFIX } from './ApiContract';

/**
 * Laravel backend implementation used only through the Laravel Manager API
 * boundary. Other applications must expose their own API modules under apps/.
 */
class APIService {
  private static instance: APIService;

  public appQyV1: AppQyV1API;
  public mcpV1: McpV1API;
  public serverManagerV1: ServerManagerV1API;
  public serverManager: ServerManagerAPI;
  public itToolsV1: ItToolsV1API;
  public inviteCode: InviteCodeAPI;
  public systemConfig: SystemConfigAPI;
  public auth: AuthAPI;
  public databaseManager: DatabaseManagerAPI;
  public authDebug: AuthDebugAPI;
  public codeUpdate: CodeUpdateAPI;
  public mediaQuery: MediaQueryAPI;
  public books: BooksAPI;
  public codeBrowser: CodeBrowserAPI;
  public aiStatus: AiStatusAPI;
  public aiManagement: AiManagementAPI;
  public wordAudio: WordAudioAPI;
  public devHistory: DevHistoryAPI;
  public articles: ArticleAPI;

  private constructor() {
    // Seed the single shared base URL so EVERY module (including
    // serverManager / systemConfig, which the old recreate-list forgot)
    // resolves the same endpoint from the very first request, even before
    // App.tsx's preselect runs.
    setSharedBaseURL(createLaravelModuleConfig(LARAVEL_API_PREFIX.root).baseURL);

    // Initialize all API modules
    this.appQyV1 = new AppQyV1API(createLaravelModuleConfig(LARAVEL_API_PREFIX.appQyV1));

    this.mcpV1 = new McpV1API(createLaravelModuleConfig(LARAVEL_API_PREFIX.mcpV1));

    this.serverManagerV1 = new ServerManagerV1API(createLaravelModuleConfig(LARAVEL_API_PREFIX.serverManagerV1));

    this.serverManager = new ServerManagerAPI(createLaravelModuleConfig(LARAVEL_API_PREFIX.common));

    this.itToolsV1 = new ItToolsV1API(createLaravelModuleConfig(LARAVEL_API_PREFIX.itToolsV1));

    this.inviteCode = new InviteCodeAPI(createLaravelModuleConfig(LARAVEL_API_PREFIX.common));

    this.systemConfig = new SystemConfigAPI(createLaravelModuleConfig(LARAVEL_API_PREFIX.root));

    this.auth = new AuthAPI(createLaravelModuleConfig(LARAVEL_API_PREFIX.common));

    this.databaseManager = new DatabaseManagerAPI(createLaravelModuleConfig(LARAVEL_API_PREFIX.databaseManager));

    this.authDebug = new AuthDebugAPI(createLaravelModuleConfig(LARAVEL_API_PREFIX.dashboardAuth));

    this.codeUpdate = new CodeUpdateAPI(createLaravelModuleConfig(LARAVEL_API_PREFIX.dashboard));

    this.mediaQuery = new MediaQueryAPI(createLaravelModuleConfig(LARAVEL_API_PREFIX.appQyV1Media));

    this.books = new BooksAPI(createLaravelModuleConfig(LARAVEL_API_PREFIX.appQyV1));

    // Code browser (/code-browser/* web routes, host-root). All routes are
    // dashboard.auth-gated, so it joins the Authorization-header propagation
    // below (loopback dev needs no token; remote needs a Sanctum bearer).
    this.codeBrowser = new CodeBrowserAPI(createLaravelModuleConfig(LARAVEL_API_PREFIX.codeBrowser));

    this.aiStatus = new AiStatusAPI(createLaravelModuleConfig(LARAVEL_API_PREFIX.appQyV1AiStatus));

    this.aiManagement = new AiManagementAPI(createLaravelModuleConfig(LARAVEL_API_PREFIX.localAi));

    // Word Audio — real-pronunciation lookup (free_dictionary_api + forvo) with
    // a TTS last-resort fallback, on the laravel-manager "Word Audio" page.
    this.wordAudio = new WordAudioAPI(createLaravelModuleConfig(LARAVEL_API_PREFIX.localWordAudio));

    // AI Dev History — read-only Claude/Codex/Gemini/Cursor history (localhost).
    this.devHistory = new DevHistoryAPI(createLaravelModuleConfig(LARAVEL_API_PREFIX.devHistory));

    this.articles = new ArticleAPI(createLaravelModuleConfig(LARAVEL_API_PREFIX.appQyV1AiTools));

  }

  private modules(): BaseAPI[] {
    return [
      this.appQyV1, this.mcpV1, this.serverManagerV1, this.serverManager,
      this.itToolsV1, this.inviteCode, this.systemConfig, this.auth,
      this.databaseManager, this.authDebug, this.codeUpdate, this.mediaQuery,
      this.books, this.codeBrowser, this.aiStatus, this.aiManagement,
      this.wordAudio, this.devHistory, this.articles,
    ];
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): APIService {
    if (!APIService.instance) {
      APIService.instance = new APIService();
    }
    return APIService.instance;
  }

  /**
   * Set the global Authorization header
   */
  setAuthToken(token: string): void {
    const bearerToken = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    setSharedAuthToken(bearerToken);
    this.modules().forEach((module) => module.setHeader('Authorization', bearerToken));
  }

  /**
   * Clear authentication
   */
  clearAuth(): void {
    setSharedAuthToken(null);
    this.modules().forEach((module) => module.removeHeader('Authorization'));
  }

  /**
   * Set a global header
   */
  setGlobalHeader(key: string, value: string): void {
    this.modules().forEach((module) => module.setHeader(key, value));
  }

  /**
   * Re-point EVERY API module at a new base URL.
   *
   * This now updates the single shared base URL instead of recreating each
   * module. One write re-points all modules in lock-step — including
   * serverManager and systemConfig, which the old enumerated recreate-list
   * silently omitted (the bug that made octane-tasks call the stale LAN IP
   * while the switcher showed localhost). Because modules are no longer
   * recreated, any Authorization / global headers set via setAuthToken /
   * setGlobalHeader also survive an endpoint failover.
   */
  updateBaseURL(baseURL: string): void {
    setSharedBaseURL(baseURL);
  }
}

// Export the singleton
export const api = APIService.getInstance();

// Export types
export type { APIResponse } from '../types';
