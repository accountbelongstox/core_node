// Main Application Logic
function appData() {
    return {
        // State
        apiBaseUrl: CONFIG.API_BASE_URL,
        searchQuery: '',
        selectedCategory: 'all',
        selectedTool: null,
        toolContent: '',
        showSettings: false,
        toasts: [],

        // Categories
        categories: [
            { id: 'crypto', name: 'Crypto & Security', icon: '🔐', count: 12 },
            { id: 'converter', name: 'Converters', icon: '🔄', count: 25 },
            { id: 'web', name: 'Web Dev', icon: '🌐', count: 15 },
            { id: 'math', name: 'Math', icon: '🔢', count: 5 },
            { id: 'network', name: 'Network', icon: '🖥️', count: 11 },
            { id: 'text', name: 'Text', icon: '📝', count: 18 },
            { id: 'media', name: 'Media', icon: '🎥', count: 3 }
        ],

        // Tools list
        tools: [],
        filteredTools: [],

        // Initialization
        init() {
            this.loadSettings();
            this.loadTools();
            this.filterTools();
        },

        // Load settings from localStorage
        loadSettings() {
            const savedUrl = localStorage.getItem(CONFIG.STORAGE.API_BASE_URL);
            if (savedUrl) {
                this.apiBaseUrl = savedUrl;
            }
        },

        // Save settings to localStorage
        saveSettings() {
            localStorage.setItem(CONFIG.STORAGE.API_BASE_URL, this.apiBaseUrl);
            this.showToast('success', 'Settings Saved', 'API URL has been updated');
            this.showSettings = false;
        },

        // Load tools data
        loadTools() {
            this.tools = getToolsData(); // Defined in tools.js
            this.filteredTools = this.tools;
        },

        // Filter tools based on search and category
        filterTools() {
            let filtered = this.tools;

            // Filter by category
            if (this.selectedCategory !== 'all') {
                filtered = filtered.filter(tool => tool.category === this.selectedCategory);
            }

            // Filter by search query
            if (this.searchQuery.trim()) {
                const query = this.searchQuery.toLowerCase();
                filtered = filtered.filter(tool =>
                    tool.name.toLowerCase().includes(query) ||
                    tool.description.toLowerCase().includes(query) ||
                    tool.keywords?.some(keyword => keyword.toLowerCase().includes(query))
                );
            }

            this.filteredTools = filtered;
        },

        // Open tool modal
        openTool(tool) {
            this.selectedTool = tool;
            this.renderToolContent(tool);
        },

        // Close tool modal
        closeTool() {
            this.selectedTool = null;
            this.toolContent = '';
        },

        // Render tool content
        renderToolContent(tool) {
            if (typeof window[`render_${tool.id}`] === 'function') {
                this.toolContent = window[`render_${tool.id}`]();
            } else {
                this.toolContent = this.getDefaultToolTemplate(tool);
            }
        },

        // Default tool template
        getDefaultToolTemplate(tool) {
            return `
                <div class="space-y-4">
                    <p class="text-gray-600">${tool.description}</p>
                    <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                        <p class="text-sm text-yellow-700">
                            <i class="fas fa-exclamation-triangle mr-2"></i>
                            This tool implementation is in progress.
                        </p>
                    </div>
                    <div class="bg-gray-50 p-4 rounded">
                        <h3 class="font-semibold mb-2">API Endpoint:</h3>
                        <code class="text-sm bg-gray-800 text-green-400 px-3 py-2 rounded block">${tool.endpoint}</code>
                    </div>
                </div>
            `;
        },

        // Get category name by ID
        getCategoryName(categoryId) {
            const category = this.categories.find(c => c.id === categoryId);
            return category ? category.name : categoryId;
        },

        // Get category color classes
        getCategoryColor(categoryId) {
            const colors = {
                crypto: 'bg-purple-100 text-purple-800',
                converter: 'bg-blue-100 text-blue-800',
                web: 'bg-green-100 text-green-800',
                math: 'bg-yellow-100 text-yellow-800',
                network: 'bg-red-100 text-red-800',
                text: 'bg-indigo-100 text-indigo-800',
                media: 'bg-pink-100 text-pink-800'
            };
            return colors[categoryId] || 'bg-gray-100 text-gray-800';
        },

        // Toast notification system
        showToast(type, title, message) {
            const toast = {
                type,
                title,
                message,
                visible: true
            };
            this.toasts.push(toast);

            setTimeout(() => {
                toast.visible = false;
                setTimeout(() => {
                    const index = this.toasts.indexOf(toast);
                    if (index > -1) {
                        this.toasts.splice(index, 1);
                    }
                }, 300);
            }, 5000);
        },

        // API call helper
        async callApi(endpoint, method = 'POST', data = null) {
            try {
                const url = `${this.apiBaseUrl}${endpoint}`;
                const options = {
                    method,
                    headers: CONFIG.REQUEST.HEADERS,
                    timeout: CONFIG.REQUEST.TIMEOUT
                };

                if (data && method !== 'GET') {
                    options.body = JSON.stringify(data);
                }

                const response = await fetch(url, options);
                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error?.message || 'API request failed');
                }

                return result;
            } catch (error) {
                this.showToast('error', 'API Error', error.message);
                throw error;
            }
        }
    };
}

// Utility Functions

// Copy to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('success', 'Copied!', 'Text copied to clipboard');
    }).catch(err => {
        showToast('error', 'Copy Failed', err.message);
    });
}

// Download file
function downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Format JSON
function formatJSON(json) {
    try {
        const obj = typeof json === 'string' ? JSON.parse(json) : json;
        return JSON.stringify(obj, null, 2);
    } catch (error) {
        throw new Error('Invalid JSON');
    }
}

// Validate JSON
function isValidJSON(str) {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
}

// Show toast (global helper)
function showToast(type, title, message) {
    const event = new CustomEvent('show-toast', {
        detail: { type, title, message }
    });
    window.dispatchEvent(event);
}

// Listen for toast events
window.addEventListener('show-toast', (e) => {
    // This will be handled by Alpine.js component
    console.log('Toast:', e.detail);
});
