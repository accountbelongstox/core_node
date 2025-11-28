/**
 * Configuration Page
 * Manage system configuration settings
 */

(function() {
    'use strict';

    const config = window.AppConfig;
    let currentConfig = null;

    /**
     * Load config page
     * @param {HTMLElement} container - Content container
     */
    window.load_config = async function(container) {
        console.log('[Config] Loading page...');

        // Render initial structure
        renderPageStructure(container);

        // Load configuration
        await loadConfiguration();

        // Setup refresh handler
        window.currentPageRefresh = loadConfiguration;

        console.log('[Config] Page loaded');
    };

    /**
     * Render page structure
     * @param {HTMLElement} container - Content container
     */
    function renderPageStructure(container) {
        container.innerHTML = `
            <div class="config-page">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">System Configuration</h3>
                        <div class="content-actions">
                            <button class="btn btn-success" id="save-config-btn">
                                <span class="btn-icon">💾</span>
                                <span class="btn-text">Save Changes</span>
                            </button>
                        </div>
                    </div>
                    <div class="card-body">
                        <div id="config-form-container">
                            <p class="text-center text-muted">Loading configuration...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Setup save button
        const saveBtn = document.getElementById('save-config-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', saveConfiguration);
        }
    }

    /**
     * Load configuration
     */
    async function loadConfiguration() {
        try {
            const result = await window.API.call(config.routes.config);

            if (!result.success) {
                throw new Error(result.error || 'Failed to load configuration');
            }

            currentConfig = result.data || {};

            // Render configuration form
            renderConfigForm(currentConfig);

        } catch (error) {
            console.error('[Config] Error loading configuration:', error);

            const container = document.getElementById('config-form-container');
            if (container) {
                container.innerHTML = `
                    <div class="alert alert-danger">
                        <strong>Error:</strong> ${error.message}
                    </div>
                `;
            }
        }
    }

    /**
     * Render configuration form
     * @param {object} configData - Configuration data
     */
    function renderConfigForm(configData) {
        const container = document.getElementById('config-form-container');

        if (!container) return;

        let formHTML = '<div class="config-sections">';

        // Database Section
        formHTML += `
            <div class="config-section">
                <h4 class="config-section-title">Database Settings</h4>
                <div class="form-group">
                    <label class="form-label">Database Name</label>
                    <input type="text" class="form-control" id="cfg-database-name"
                           value="${configData.DATABASE_NAME || 'okx_history'}" readonly>
                </div>
                <div class="form-group">
                    <label class="form-label">Target Records Per Coin</label>
                    <input type="number" class="form-control" id="cfg-target-records"
                           value="${configData.TARGET_RECORDS_PER_COIN || 10000}">
                    <small class="text-muted">Number of historical records to fetch for each coin</small>
                </div>
            </div>
        `;

        // Monitor Settings
        formHTML += `
            <div class="config-section">
                <h4 class="config-section-title">Monitor Settings</h4>
                <div class="form-group">
                    <label class="form-label">History Window (hours)</label>
                    <input type="number" class="form-control" id="cfg-history-window"
                           value="${configData.HISTORY_WINDOW_HOURS || 3}" min="1" max="24">
                    <small class="text-muted">Hours of recent price history to track</small>
                </div>
                <div class="form-group">
                    <label class="form-label">Update Interval (ms)</label>
                    <input type="number" class="form-control" id="cfg-update-interval"
                           value="${configData.UPDATE_INTERVAL_MS || 2000}" min="1000" max="60000">
                    <small class="text-muted">Milliseconds between price updates</small>
                </div>
                <div class="form-group">
                    <label class="form-label">Bar Size</label>
                    <select class="form-control" id="cfg-bar-size">
                        <option value="1m" ${configData.BAR_SIZE === '1m' ? 'selected' : ''}>1 Minute</option>
                        <option value="5m" ${configData.BAR_SIZE === '5m' ? 'selected' : ''}>5 Minutes</option>
                        <option value="15m" ${configData.BAR_SIZE === '15m' ? 'selected' : ''}>15 Minutes</option>
                        <option value="1H" ${configData.BAR_SIZE === '1H' ? 'selected' : ''}>1 Hour</option>
                        <option value="4H" ${configData.BAR_SIZE === '4H' ? 'selected' : ''}>4 Hours</option>
                        <option value="1D" ${configData.BAR_SIZE === '1D' ? 'selected' : ''}>1 Day</option>
                    </select>
                    <small class="text-muted">Candlestick bar size for historical data</small>
                </div>
            </div>
        `;

        // Alert Thresholds
        formHTML += `
            <div class="config-section">
                <h4 class="config-section-title">Alert Thresholds (%)</h4>
                <div class="form-group">
                    <label class="form-label">30 Second Threshold</label>
                    <input type="number" class="form-control" id="cfg-threshold-30s"
                           value="${configData.ALERT_THRESHOLDS?.['30s'] || 1.0}"
                           min="0.1" max="10" step="0.1">
                    <small class="text-muted">Percentage change to trigger 30s alert</small>
                </div>
                <div class="form-group">
                    <label class="form-label">1 Minute Threshold</label>
                    <input type="number" class="form-control" id="cfg-threshold-1m"
                           value="${configData.ALERT_THRESHOLDS?.['1m'] || 2.0}"
                           min="0.1" max="10" step="0.1">
                    <small class="text-muted">Percentage change to trigger 1min alert</small>
                </div>
                <div class="form-group">
                    <label class="form-label">2 Minute Threshold</label>
                    <input type="number" class="form-control" id="cfg-threshold-2m"
                           value="${configData.ALERT_THRESHOLDS?.['2m'] || 3.0}"
                           min="0.1" max="10" step="0.1">
                    <small class="text-muted">Percentage change to trigger 2min alert</small>
                </div>
            </div>
        `;

        // Display Settings
        formHTML += `
            <div class="config-section">
                <h4 class="config-section-title">Display Settings</h4>
                <div class="form-group">
                    <label class="form-label">Max Coins to Display</label>
                    <input type="number" class="form-control" id="cfg-max-coins"
                           value="${configData.MAX_COINS_DISPLAY || 100}"
                           min="10" max="1000" step="10">
                    <small class="text-muted">Maximum number of coins to show in tables</small>
                </div>
            </div>
        `;

        formHTML += '</div>';

        formHTML += `
            <style>
                .config-sections {
                    display: grid;
                    gap: var(--spacing-lg);
                }

                .config-section {
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-md);
                    padding: var(--spacing-lg);
                }

                .config-section-title {
                    margin-bottom: var(--spacing-md);
                    padding-bottom: var(--spacing-sm);
                    border-bottom: 2px solid var(--border-color);
                    color: var(--accent-primary);
                }
            </style>
        `;

        container.innerHTML = formHTML;
    }

    /**
     * Save configuration
     */
    async function saveConfiguration() {
        try {
            // Collect form values
            const updates = {
                TARGET_RECORDS_PER_COIN: parseInt(document.getElementById('cfg-target-records').value),
                HISTORY_WINDOW_HOURS: parseInt(document.getElementById('cfg-history-window').value),
                UPDATE_INTERVAL_MS: parseInt(document.getElementById('cfg-update-interval').value),
                BAR_SIZE: document.getElementById('cfg-bar-size').value,
                MAX_COINS_DISPLAY: parseInt(document.getElementById('cfg-max-coins').value),
                ALERT_THRESHOLDS: {
                    '30s': parseFloat(document.getElementById('cfg-threshold-30s').value),
                    '1m': parseFloat(document.getElementById('cfg-threshold-1m').value),
                    '2m': parseFloat(document.getElementById('cfg-threshold-2m').value)
                }
            };

            window.AppLayout.showLoading('Saving configuration...');

            const result = await window.API.call(config.routes.updateConfig, { updates });

            if (!result.success) {
                throw new Error(result.error || 'Failed to save configuration');
            }

            window.Utils.showNotification('Configuration saved successfully', 'success');

            // Reload configuration
            await loadConfiguration();

        } catch (error) {
            console.error('[Config] Error saving configuration:', error);
            window.Utils.showNotification('Failed to save configuration: ' + error.message, 'error');
        } finally {
            window.AppLayout.hideLoading();
        }
    }

})();

console.log('[Config] Configuration page module loaded');
