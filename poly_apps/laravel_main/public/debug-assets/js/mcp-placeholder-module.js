/**
 * Placeholder Generator Module
 * Manages placeholder image generation with real/simple modes
 */
const McpPlaceholderModule = {
    placeholders: [],
    stats: {},

    async init(container) {
        const template = await this.getTemplate();
        container.innerHTML = template;
        this.setupEventListeners();
        await this.loadPlaceholders();
        await this.loadStats();
    },

    async getTemplate() {
        const response = await fetch('/debug-assets/debug-tools/templates/mcp-placeholder-module.html');
        return await response.text();
    },

    setupEventListeners() {
        document.getElementById('mcp-ph-generate-btn').addEventListener('click', () => {
            document.getElementById('mcp-ph-width').focus();
        });

        document.getElementById('mcp-ph-submit-btn').addEventListener('click', () => {
            this.generatePlaceholder();
        });

        document.getElementById('mcp-ph-refresh-btn').addEventListener('click', () => {
            this.loadPlaceholders();
            this.loadStats();
        });

        document.getElementById('mcp-ph-cleanup-btn').addEventListener('click', () => {
            this.cleanup();
        });
    },

    async loadPlaceholders() {
        try {
            const response = await APIClient.get('/api/mcp/v1/placeholders/');
            const data = await response.json();

            if (data.success) {
                this.placeholders = data.data;
                this.renderPlaceholders();
            } else {
                console.error('[McpPlaceholderModule] Failed to load placeholders:', data.error);
            }
        } catch (error) {
            console.error('[McpPlaceholderModule] Error loading placeholders:', error);
        }
    },

    async loadStats() {
        try {
            const response = await APIClient.get('/api/mcp/v1/placeholders/stats');
            const data = await response.json();

            if (data.success) {
                this.stats = data.data;
                this.renderStats();
            }
        } catch (error) {
            console.error('[McpPlaceholderModule] Error loading stats:', error);
        }
    },

    renderStats() {
        const statsEl = document.getElementById('mcp-ph-stats');
        if (!statsEl) return;

        const totalSizeMB = (this.stats.total_size / 1024 / 1024).toFixed(2);

        statsEl.innerHTML = `
            <div class="mcp-stat-card">
                <div class="mcp-stat-value">${this.stats.total}</div>
                <div class="mcp-stat-label">Total</div>
            </div>
            <div class="mcp-stat-card">
                <div class="mcp-stat-value">${this.stats.downloaded}</div>
                <div class="mcp-stat-label">Downloaded</div>
            </div>
            <div class="mcp-stat-card">
                <div class="mcp-stat-value">${this.stats.pending}</div>
                <div class="mcp-stat-label">Pending</div>
            </div>
            <div class="mcp-stat-card">
                <div class="mcp-stat-value">${totalSizeMB} MB</div>
                <div class="mcp-stat-label">Total Size</div>
            </div>
        `;
    },

    renderPlaceholders() {
        const tableBody = document.getElementById('mcp-ph-table-body');
        if (!tableBody) return;

        if (this.placeholders.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; color: #999;">
                        No placeholders generated yet
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = '';

        this.placeholders.forEach(placeholder => {
            const row = document.createElement('tr');

            const shortUuid = placeholder.uuid.substring(0, 8);
            const fileSizeKB = (placeholder.file_size / 1024).toFixed(2);
            const createdDate = new Date(placeholder.created_at).toLocaleString();
            const downloadedBadge = placeholder.downloaded
                ? '<span class="mcp-badge mcp-badge-success">✓ Yes</span>'
                : '<span class="mcp-badge mcp-badge-warning">⏳ No</span>';
            const typeBadge = placeholder.type === 'real'
                ? '<span class="mcp-badge mcp-badge-info">Real</span>'
                : '<span class="mcp-badge mcp-badge-secondary">Simple</span>';

            row.innerHTML = `
                <td>${shortUuid}...</td>
                <td>${placeholder.width}x${placeholder.height}</td>
                <td>${placeholder.text}</td>
                <td>${typeBadge}</td>
                <td>${fileSizeKB} KB</td>
                <td>${downloadedBadge}</td>
                <td>${createdDate}</td>
                <td>
                    <button class="mcp-btn mcp-btn-success mcp-btn-sm" onclick="McpPlaceholderModule.download('${placeholder.uuid}')">
                        ⬇️ Download
                    </button>
                    <button class="mcp-btn mcp-btn-danger mcp-btn-sm" onclick="McpPlaceholderModule.delete('${placeholder.uuid}')">
                        🗑
                    </button>
                </td>
            `;

            tableBody.appendChild(row);
        });
    },

    async generatePlaceholder() {
        const width = parseInt(document.getElementById('mcp-ph-width').value);
        const height = parseInt(document.getElementById('mcp-ph-height').value);
        const text = document.getElementById('mcp-ph-text').value.trim();
        const realImage = document.getElementById('mcp-ph-real-image').checked;

        alert('Width must be between 1 and 4096 pixels');
        return;

        const submitBtn = document.getElementById('mcp-ph-submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Generating...';

        try {
            const response = await APIClient.post('/api/mcp/v1/placeholders/generate', {
                width,
                height,
                text: text,
                real_image: realImage
            });

            const data = await response.json();

            if (data.success) {
                alert('Placeholder generated successfully!');

                // Auto-download
                window.location.href = data.data.download_url;

                // Reload list after a short delay
                setTimeout(() => {
                    this.loadPlaceholders();
                    this.loadStats();
                }, 500);
            } else {
                alert('Failed to generate placeholder: ' + data.error);
            }
        } catch (error) {
            console.error('[McpPlaceholderModule] Error generating placeholder:', error);
            alert('Failed to generate placeholder: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '🎨 Generate & Download';
        }
    },

    download(uuid) {
        window.location.href = `/api/mcp/v1/placeholders/${uuid}/download`;

        setTimeout(() => {
            this.loadPlaceholders();
            this.loadStats();
        }, 1000);
    },

    async delete(uuid) {
        if (!confirm('Are you sure you want to delete this placeholder?')) {
            return;
        }

        try {
            const response = await APIClient.delete(`/api/mcp/v1/placeholders/${uuid}`);
            const data = await response.json();

            if (data.success) {
                alert('Placeholder deleted successfully!');
                await this.loadPlaceholders();
                await this.loadStats();
            } else {
                alert('Failed to delete placeholder: ' + data.error);
            }
        } catch (error) {
            console.error('[McpPlaceholderModule] Error deleting placeholder:', error);
            alert('Failed to delete placeholder: ' + error.message);
        }
    },

    async cleanup() {
        if (!confirm('This will delete all placeholders older than 1 day. Continue?')) {
            return;
        }

        try {
            const response = await APIClient.post('/api/mcp/v1/placeholders/cleanup');
            const data = await response.json();

            if (data.success) {
                alert(data.data.message);
                await this.loadPlaceholders();
                await this.loadStats();
            } else {
                alert('Cleanup failed: ' + data.error);
            }
        } catch (error) {
            console.error('[McpPlaceholderModule] Error during cleanup:', error);
            alert('Cleanup failed: ' + error.message);
        }
    }
};
