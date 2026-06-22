
export const mcpMock = {
    handle: async (path: string, payload: any) => {
        // --- Screenshots ---
        if (path.includes('/screenshots/upload')) {
            return {
                id: `ss_${Date.now()}`,
                file_path: '/uploads/mock.png',
                description: payload.description || 'Uploaded Screenshot',
                created_at: new Date().toISOString()
            };
        }
        if (path.includes('/screenshots/latest')) {
            return { id: 'ss_latest', file_path: '/uploads/latest.png' };
        }
        if (path.includes('/screenshots/search')) {
            return {
                count: 3,
                screenshots: [
                    { id: 'ss_1', description: `Result for ${payload.keyword} 1` },
                    { id: 'ss_2', description: `Result for ${payload.keyword} 2` }
                ]
            };
        }

        // --- Tasks ---
        if (path.includes('/task-dispatch/categories')) {
            return {
                categories: [
                    { id: 'frontend', name: 'Frontend Dev', path: '/src/ui' },
                    { id: 'backend', name: 'Backend API', path: '/src/api' }
                ]
            };
        }
        if (path.includes('/task-dispatch/queue/add-file')) {
            return {
                task_id: `task_${Date.now()}`,
                status: 'queued',
                category_id: payload.category_id
            };
        }

        // --- Voice Subtitle ---
        if (path.includes('/voice-subtitle/queue')) {
             return {
                 success: true,
                 queue: [{ text: "Hello World", category: "default" }, { text: "Next Track", category: "default" }],
                 current_index: 0
             };
        }
        if (path.includes('/voice-subtitle/current')) {
             return { success: true, current: { text: "Hello World", audio_url: "mock.mp3" } };
        }
        if (path.includes('/voice-subtitle/add')) {
             return { success: true, task_id: `voice_${Date.now()}`, message: "Added to queue" };
        }

        return null;
    }
};
