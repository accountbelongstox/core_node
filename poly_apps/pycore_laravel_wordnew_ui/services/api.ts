
import { ToolConnectionConfig, ApiResponse } from "../types";
import { MockService } from "./mockData";

/**
 * MOCK tool-execution client (demo flows only).
 *
 * This is NOT the real API layer — real requests go through the Laravel Manager
 * application API boundary (the
 * `api` singleton), which follows the live shared base URL managed by
 * ApiManager. This client backs the demo tools (WordCounter, AgeCalculator,
 * PasswordGenerator, HexToRgb, UniversalTool, ToolWorkspace): every action is
 * resolved by MockService; "cloud" mode merely simulates latency/failures.
 * It therefore holds NO base URL or key (the former static `globalBaseUrl` /
 * `setGlobalConfig` / `fetchEndpoint` were dead code — never read or called —
 * and risked being mistaken for a live, but stale, endpoint source).
 */
class ApiClient {
    private static instance: ApiClient;

    private constructor() {}

    public static getInstance(): ApiClient {
        if (!ApiClient.instance) {
            ApiClient.instance = new ApiClient();
        }
        return ApiClient.instance;
    }

    /**
     * Executes a tool action.
     * LOGIC: 
     * 1. If mode is local -> MockService
     * 2. If mode is cloud BUT no URL -> MockService
     * 3. If mode is cloud AND URL -> Try Fetch. If error -> MockService (Fallback)
     */
    public async executeToolAction(
        toolId: string, 
        actionId: string, 
        payload: any, 
        config: ToolConnectionConfig
    ): Promise<ApiResponse> {
        console.log(`[API] Executing ${toolId}:${actionId}`, payload);
        const start = Date.now();

        // 1. Direct Local Mock
        if (config.mode === 'local') {
             const data = await MockService.handle(toolId, actionId, payload);
             return { success: true, data, latency: Date.now() - start, dataSource: 'mock' };
        }

        // 2. Cloud Mode Check
        const targetUrl = config.apiUrl;

        // If no URL configured, fallback immediately to mock
        if (!targetUrl) {
            console.warn("[API] No API URL configured. Falling back to Mock Center.");
            const data = await MockService.handle(toolId, actionId, payload);
            return { success: true, data, latency: Date.now() - start, dataSource: 'mock' };
        }

        // 3. Try Real Request
        try {
            // Simulate Network Request
            // In a real app: const res = await fetch(`${targetUrl}/${toolId}/${actionId}`, ...);
            
            // Simulating a random network failure to demonstrate fallback
            if (Math.random() > 0.8) throw new Error("Network Unreachable");

            await new Promise(r => setTimeout(r, 800)); // Fake network latency

            // Mocking a successful server response (since we don't have a real server)
            // Ideally, we would fetch here. For this demo, if "Cloud" succeeds, we still use mock data 
            // but wrap it as if it came from cloud.
            const data = await MockService.handle(toolId, actionId, payload);
            
            return {
                success: true,
                data,
                latency: Date.now() - start,
                dataSource: 'cloud'
            };

        } catch (error) {
            console.error("[API] Cloud Request Failed. Falling back to Mock Center.", error);
            // Fallback Logic
            const data = await MockService.handle(toolId, actionId, payload);
            return {
                success: true,
                data,
                error: "Cloud unreachable, using cached/mock data",
                latency: Date.now() - start,
                dataSource: 'mock'
            };
        }
    }
}

export const apiClient = ApiClient.getInstance();

