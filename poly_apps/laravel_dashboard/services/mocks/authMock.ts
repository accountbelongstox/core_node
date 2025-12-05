
export const authMock = {
    handle: async (path: string, payload: any) => {
        if (path === '/api/login') {
            if (payload.email && payload.password) {
                return {
                    user: { id: 'u1', name: 'Admin Root', email: payload.email, avatar: 'https://i.pravatar.cc/150?u=admin' },
                    token: 'mock-jwt-token-xyz-123'
                };
            }
            throw new Error("Invalid credentials");
        }

        if (path === '/api/register') {
            return {
                user: { id: 'u2', name: payload.name, email: payload.email },
                token: 'mock-jwt-token-new-user'
            };
        }

        if (path === '/api/logout') {
            return { message: "Logged out successfully" };
        }

        if (path === '/api_info') {
            return {
                apps: {
                    ItToolsV1: { status: 'active', version: '1.0' },
                    McpV1: { status: 'active', version: '1.2' }
                }
            };
        }

        return null;
    }
};
