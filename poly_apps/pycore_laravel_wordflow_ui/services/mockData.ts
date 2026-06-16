
import { authMock } from "./mocks/authMock";
import { itToolsMock } from "./mocks/itToolsMock";
import { mcpMock } from "./mocks/mcpMock";
import { systemMock } from "./mocks/systemMock";

/**
 * MOCK DATA CENTER
 * Routes requests to specific mock handlers based on the endpoint path.
 */
export class MockService {
    
    public static async handle(toolId: string, actionId: string, payload: any): Promise<any> {
        console.log(`[MockCenter] Routing: ${toolId} / ${actionId}`, payload);
        
        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 400));

        // 1. Direct Path Handling (from UniversalTool or ApiTester)
        // If actionId matches a known path pattern
        const path = actionId.startsWith('/') ? actionId : toolId; 

        // 2. Delegate to Sub-Mocks
        
        // Auth / System
        if (path.startsWith('/api/login') || path.startsWith('/api/register') || path.startsWith('/api_info') || path.startsWith('/api/logout')) {
            return authMock.handle(path, payload);
        }

        // ITTools
        if (path.includes('/ittools/v1')) {
            const res = await itToolsMock.handle(path, payload);
            if (res) return res;
        }

        // MCP
        if (path.includes('/mcp/v1')) {
            const res = await mcpMock.handle(path, payload);
            if (res) return res;
        }

        // System (Code, Static, Chunk)
        if (path.includes('/code-browser') || path.includes('/static-resources')) {
            const res = await systemMock.handle(path, payload);
            if (res) return res;
        }

        // Clipboard
        if (path.includes('/clipboard')) {
            if (path.includes('data')) return {
                namespace: payload.namespace,
                current: { text: "Mock Clipboard Content", files: [] },
                history: []
            };
            if (path.includes('text')) return { message: "Text Saved", updated_at: new Date().toISOString() };
        }

        // --- Fallback for Old Tool IDs (Backward Compatibility) ---
        // This maps the old toolIds (calc1, col1) to the logic if they are still used by custom components
        // In the new system, custom components should ideally invoke the path directly, but for now we map them.
        
        if (toolId === 'calc1' && actionId === 'calc') return { years: 25, months: 4, days: 12 }; // Age Calc
        if (toolId === 'col1' && actionId === 'convert') return { rgb: 'rgb(100, 100, 255)' }; // Hex
        if (toolId === 'ut4' && actionId === 'gen') return { password: "MockPassword123!" }; // Pass Gen
        if (toolId === 'ta4' && actionId === 'analyze') return { words: 10, chars: 50, sentences: 2, readTime: '< 1 min' }; // Word Count

        return { result: "Mock Operation Successful (Generic)", path, payload };
    }
}
