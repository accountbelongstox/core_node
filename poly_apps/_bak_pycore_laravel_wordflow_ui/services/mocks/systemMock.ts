
export const systemMock = {
    handle: async (path: string, payload: any) => {
        // --- Code Browser ---
        if (path.includes('/code-browser/file-tree')) {
            return {
                items: [
                    { name: 'app', type: 'directory', path: 'app', modified: new Date().toISOString() },
                    { name: 'routes', type: 'directory', path: 'routes', modified: new Date().toISOString() },
                    { name: 'User.php', type: 'file', path: 'app/Models/User.php', extension: 'php', size: 2048, modified: new Date().toISOString() }
                ],
                path: payload.path || ''
            };
        }
        if (path.includes('/code-browser/read-file')) {
            return {
                content: "<?php\n\nnamespace App;\n\nclass User extends Model {\n    // Mock content\n}",
                path: payload.path,
                extension: 'php',
                size: 1024,
                modified: new Date().toISOString()
            };
        }
        if (path.includes('/code-browser/save-file')) {
            return { success: true, message: "File saved successfully", path: payload.path, backup: payload.path + '.bak' };
        }
        if (path.includes('/code-browser/prompts/create')) {
            return { success: true, message: "Prompt created", path: `_prompts/${payload.name}.md` };
        }

        // --- Static Resources ---
        if (path.includes('/static-resources/file-tree')) {
            return {
                items: [
                    { name: 'logo.png', type: 'file', path: 'images/logo.png', mimeType: 'image/png', size: 5000 },
                    { name: 'banner.jpg', type: 'file', path: 'images/banner.jpg', mimeType: 'image/jpeg', size: 15000 },
                    { name: 'docs', type: 'directory', path: 'docs' }
                ],
                path: payload.path || ''
            };
        }
        if (path.includes('/static-resources/upload')) {
            return { success: true, uploaded_count: 1, files: [{ original_name: 'test.jpg', saved_name: 'test.jpg' }] };
        }
        
        // --- Chunked Upload ---
        if (path.includes('/static-resources/chunked-upload/init')) {
            return { success: true, upload_id: `upload_${Date.now()}`, total_chunks: 10, chunk_size: payload.chunk_size };
        }
        if (path.includes('/static-resources/chunked-upload/chunk')) {
            return { success: true, uploaded_chunks: payload.chunk_index + 1, progress: 10 };
        }
        if (path.includes('/static-resources/chunked-upload/merge')) {
            return { success: true, file_path: 'uploads/merged_file.dat', file_size: 100000 };
        }

        return null;
    }
};
