/**
 * Placeholder Generator Module
 * Manages placeholder image generation with real/simple modes
 */
const McpPlaceholderModule = {
    placeholders: [],
    stats: {},

    async init(container) {
        container.innerHTML = this.getTemplate();
        this.setupEventListeners();
        await this.loadPlaceholders();
        await this.loadStats();
    },

    getTemplate() {
        return `
            <div class="mcp-module-container">
                <div class="mcp-module-header">
                    <h2>🖼️ Placeholder Generator</h2>
                    <div class="mcp-module-actions">
                        <button id="mcp-ph-generate-btn" class="mcp-btn mcp-btn-primary">
                            ➕ Generate Placeholder
                        </button>
                        <button id="mcp-ph-cleanup-btn" class="mcp-btn mcp-btn-warning">
                            🧹 Cleanup Old
                        </button>
                        <button id="mcp-ph-refresh-btn" class="mcp-btn mcp-btn-secondary">
                            🔄 Refresh
                        </button>
                    </div>
                </div>

                <div class="mcp-module-content">
                    <div class="mcp-ph-stats-row" id="mcp-ph-stats">
                        <div class="mcp-stat-card">
                            <div class="mcp-stat-value">0</div>
                            <div class="mcp-stat-label">Total</div>
                        </div>
                        <div class="mcp-stat-card">
                            <div class="mcp-stat-value">0</div>
                            <div class="mcp-stat-label">Downloaded</div>
                        </div>
                        <div class="mcp-stat-card">
                            <div class="mcp-stat-value">0</div>
                            <div class="mcp-stat-label">Pending</div>
                        </div>
                        <div class="mcp-stat-card">
                            <div class="mcp-stat-value">0 MB</div>
                            <div class="mcp-stat-label">Total Size</div>
                        </div>
                    </div>

                    <div class="mcp-ph-generator-form">
                        <h3>Generate New Placeholder</h3>
                        <div class="mcp-form-group">
                            <label>Width (px):</label>
                            <input type="number" id="mcp-ph-width" value="800" min="1" max="4096" />
                        </div>
                        <div class="mcp-form-group">
                            <label>Height (px):</label>
                            <input type="number" id="mcp-ph-height" value="600" min="1" max="4096" />
                        </div>
                        <div class="mcp-form-group">
                            <label>Text (optional):</label>
                            <input type="text" id="mcp-ph-text" placeholder="Leave empty for dimensions" />
                        </div>
                        <div class="mcp-form-group">
                            <label>
                                <input type="checkbox" id="mcp-ph-real-image" />
                                Generate Real Image (fetch from online sources)
                            </label>
                        </div>
                        <button id="mcp-ph-submit-btn" class="mcp-btn mcp-btn-success">
                            🎨 Generate & Download
                        </button>
                    </div>

                    <div class="mcp-ph-table-container">
                        <h3>Generated Placeholders</h3>
                        <table class="mcp-table">
                            <thead>
                                <tr>
                                    <th>UUID</th>
                                    <th>Size</th>
                                    <th>Text</th>
                                    <th>Type</th>
                                    <th>File Size</th>
                                    <th>Downloaded</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="mcp-ph-table-body">
                                <tr>
                                    <td colspan="8" style="text-align: center; color: #999;">
                                        Loading...
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <style>
                .mcp-ph-stats-row {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 15px;
                    margin-bottom: 30px;
                }
                .mcp-stat-card {
                    background: #2d2d2d;
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                    border: 1px solid #444;
                }
                .mcp-stat-value {
                    font-size: 28px;
                    font-weight: bold;
                    color: #4CAF50;
                    margin-bottom: 5px;
                }
                .mcp-stat-label {
                    font-size: 14px;
                    color: #999;
                }
                .mcp-ph-generator-form {
                    background: #2d2d2d;
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 30px;
                    border: 1px solid #444;
                }
                .mcp-ph-generator-form h3 {
                    margin-top: 0;
                    margin-bottom: 20px;
                    color: #fff;
                }
                .mcp-form-group {
                    margin-bottom: 15px;
                }
                .mcp-form-group label {
                    display: block;
                    margin-bottom: 5px;
                    color: #ccc;
                    font-size: 14px;
                }
                .mcp-form-group input[type="number"],
                .mcp-form-group input[type="text"] {
                    width: 100%;
                    padding: 8px 12px;
                    background: #1a1a1a;
                    border: 1px solid #444;
                    border-radius: 4px;
                    color: #fff;
                    font-size: 14px;
                }
                .mcp-form-group input[type="checkbox"] {
                    margin-right: 8px;
                }
                .mcp-ph-table-container {
                    background: #2d2d2d;
                    border-radius: 8px;
                    padding: 20px;
                    border: 1px solid #444;
                }
                .mcp-ph-table-container h3 {
                    margin-top: 0;
                    margin-bottom: 20px;
                    color: #fff;
                }
                .mcp-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .mcp-table th,
                .mcp-table td {
                    padding: 10px;
                    text-align: left;
                    border-bottom: 1px solid #444;
                    color: #ccc;
                }
                .mcp-table th {
                    background: #1a1a1a;
                    color: #fff;
                    font-weight: 600;
                }
                .mcp-table tbody tr:hover {
                    background: #3a3a3a;
                }
                .mcp-badge {
                    display: inline-block;
                    padding: 3px 8px;
                    border-radius: 3px;
                    font-size: 11px;
                    font-weight: 600;
                }
                .mcp-badge-success {
                    background: #28a745;
                    color: #fff;
                }
                .mcp-badge-warning {
                    background: #ffc107;
                    color: #000;
                }
                .mcp-badge-info {
                    background: #17a2b8;
                    color: #fff;
                }
                .mcp-badge-secondary {
                    background: #6c757d;
                    color: #fff;
                }
            </style>
        `;
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
                <div class="mcp-stat-value">${this.stats.total || 0}</div>
                <div class="mcp-stat-label">Total</div>
            </div>
            <div class="mcp-stat-card">
                <div class="mcp-stat-value">${this.stats.downloaded || 0}</div>
                <div class="mcp-stat-label">Downloaded</div>
            </div>
            <div class="mcp-stat-card">
                <div class="mcp-stat-value">${this.stats.pending || 0}</div>
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
                <td>${placeholder.text || '-'}</td>
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

        if (!width || width < 1 || width > 4096) {
            alert('Width must be between 1 and 4096 pixels');
            return;
        }

        if (!height || height < 1 || height > 4096) {
            alert('Height must be between 1 and 4096 pixels');
            return;
        }

        const submitBtn = document.getElementById('mcp-ph-submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Generating...';

        try {
            const response = await APIClient.post('/api/mcp/v1/placeholders/generate', {
                width,
                height,
                text: text || null,
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
                alert('Failed to generate placeholder: ' + (data.error || 'Unknown error'));
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
                alert('Failed to delete placeholder: ' + (data.error || 'Unknown error'));
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
                alert('Cleanup failed: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('[McpPlaceholderModule] Error during cleanup:', error);
            alert('Cleanup failed: ' + error.message);
        }
    }
};
