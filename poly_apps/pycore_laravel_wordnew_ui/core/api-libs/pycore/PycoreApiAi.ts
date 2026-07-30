/**
 * AI provider / image / usage RPC surface for pycoreApi.
 */
import type {
  AiChatMessage, AiUsageResponse, AiKeySetRequest,
} from './pycoreTypes';
import { callRpc, PYCORE_RPC_ROUTES, rewritePycoreEndpoint } from './PycoreApiTransport';

export const pycoreApiAi = {
  // --- AI provider catalog (NO network test — cheap, never spends quota) --- #
  // Renders the grid on page load; live availability is tested on demand only.
  getAiCatalog: () => callRpc(PYCORE_RPC_ROUTES.aiProbeAiCatalog, {}, 15_000),

  // --- AI provider availability probe (live test) ------------------------- #
  // probeAi() tests ALL providers (the "Test all" button, rate-aware + cached).
  probeAi: (refresh = false) =>
    callRpc(PYCORE_RPC_ROUTES.aiProbeProbe, { refresh: refresh ? 1 : 0 }),

  // Test ONE provider (per-card "Test"): live, never cached, rate-aware.
  probeAiOne: (provider: string) =>
    callRpc(PYCORE_RPC_ROUTES.aiProbeProbe, { provider }),

  // --- AI account balance / remaining credit ------------------------------- #
  // Only openrouter / deepseek / siliconflow / moonshot expose a balance API;
  // every other provider returns supported:false WITHOUT a network call
  // (billing is console-only — e.g. Gemini, OpenAI, Anthropic). Never cached.
  getAiBalances: () => callRpc(PYCORE_RPC_ROUTES.aiProbeBalance, {}),
  getAiBalanceOne: (provider: string) =>
    callRpc(PYCORE_RPC_ROUTES.aiProbeBalance, { provider }),

  // --- AI local rate budgets (auto-reset by the pyheartbeat tick) ---------- #
  // Cheap poll: current per-minute/day/month usage vs limits + resets-in
  // countdown. No provider call; lets the UI show budgets resetting live.
  getAiRateLimits: () =>
    callRpc(PYCORE_RPC_ROUTES.aiProbeRateLimits, {}),

  // --- AI chat confirm (explicit provider) --------------------------------- #
  aiChat: (provider: string, messages: AiChatMessage[], model?: string) =>
    callRpc(PYCORE_RPC_ROUTES.localAiChat, { provider, messages, model }),

  // --- AI auto (unified gateway: smart dispatch + fallback) ---------------- #
  // One round trip; the backend picks the provider by tier/quota/cooldown and
  // the response says which AI handled it. `source` labels the task in the
  // gateway records.
  aiAuto: (messages: AiChatMessage[], source?: string, model?: string) =>
    callRpc(PYCORE_RPC_ROUTES.localAiChat, { provider: 'auto', messages, model, source }),

  // --- AI gateway status (tiers, quotas, cooldowns, task records) ---------- #
  getAiGateway: () => callRpc(PYCORE_RPC_ROUTES.localAiStatus, {}),

  // --- AI key management (indexed secret-store key files) ------------------ #
  // List every provider's key base + per-slot rotation status (KEY1/KEY2…),
  // plus the raw env-var names of each configured key file (for targeted
  // delete). Read-only; never returns full secrets (slots are masked).
  getAiKeys: () => callRpc(PYCORE_RPC_ROUTES.aiKeysListKeys, {}),
  // Write ONE indexed key file ({BASE}_{index}, or {BASE}_IMAGE_{index} when
  // image=true) then re-probe. Values are write-only — never echoed back.
  setAiKey: (body: AiKeySetRequest) =>
    callRpc(PYCORE_RPC_ROUTES.aiKeysSetKey, body),
  // Delete one specific key file by its exact env-var name (e.g.
  // GOOGLE_API_KEY_2 or OPENAI_API_KEY_IMAGE_1).
  deleteAiKey: (keyName: string) =>
    callRpc(PYCORE_RPC_ROUTES.aiKeysDeleteKey, { key_name: keyName }),
  // Clear the cooldown on one rotation key so it becomes usable again. `index`
  // targets a specific slot (0-based); `image` targets the dedicated image
  // budget instead of the text keys. Omitting index clears every slot.
  resetKeyCooldown: (req: { provider: string; index?: number; image?: boolean }) =>
    callRpc(PYCORE_RPC_ROUTES.aiKeysResetCooldown, req),

  // --- AI usage (SHARED cross-runtime store — text / vision / probe) ------- #
  // The store is shared with laravel, so this returns usage from BOTH runtimes
  // (see each record's `runtime`). Image generations are NOT here — they live in
  // the image history. Wrapped into the dashboard APIResponse envelope so the
  // shared AiUsagePanel can read `res.success && res.data` uniformly.
  getAiUsage: async (limit = 150): Promise<{ success: boolean; data: AiUsageResponse | null; error: string | null }> => {
    try {
      const r = await callRpc(PYCORE_RPC_ROUTES.aiProbeUsage, { limit });
      if (r && r.success !== false) {
        return { success: true, data: r, error: null };
      }
      return { success: false, data: null, error: r?.error ?? 'Usage history unavailable.' };
    } catch (e: any) {
      return { success: false, data: null, error: e?.message || 'pycore unreachable' };
    }
  },

  // --- AI image generation (unified IMAGE contract; auto-records history) --- #
  // The backend picks the provider/model (or honours an explicit one), returns
  // base64 bytes + mime, AND saves the result into the SHARED cross-runtime
  // history store. `source` labels the task in the records.
  generateImage: (req: { prompt: string; size?: string; model?: string; provider?: string; source?: string }) =>
    callRpc(PYCORE_RPC_ROUTES.aiImageImage, req),

  // One-click "Test this provider": force a single image provider, ignoring the
  // cooldown/rate window. Returns the same AiImageResponse shape (base64 + mime
  // + latency) so the caller can show the image + latency in a popup.
  testImageProvider: (req: { provider: string; prompt?: string; size?: string; model?: string }) =>
    callRpc(PYCORE_RPC_ROUTES.aiImageImageTest, req),

  // --- AI image history (SHARED store — pycore + laravel entries) ---------- #
  // Metadata only (newest-first); fetch bytes via imageHistoryFileUrl(id).
  getImageHistory: (limit = 50) =>
    callRpc(PYCORE_RPC_ROUTES.aiImageImageHistory, { limit }),
  /** Raw-bytes URL for one history entry's image (use directly in an <img src>). */
  imageHistoryFileUrl: (id: string): string =>
    rewritePycoreEndpoint(`/api/local/ai/image/history/file/${encodeURIComponent(id)}`),
  deleteImageHistory: (id: string) =>
    callRpc(PYCORE_RPC_ROUTES.aiImageImageHistoryDelete, { image_id: id }),
  clearImageHistory: () =>
    callRpc(PYCORE_RPC_ROUTES.aiImageImageHistoryClear, {}),
  /** Reveal a generated image's folder in the OS file manager (path resolved by id). */
  revealImage: (id: string) =>
    callRpc(PYCORE_RPC_ROUTES.aiImageImageHistoryReveal, { image_id: id }),

};
