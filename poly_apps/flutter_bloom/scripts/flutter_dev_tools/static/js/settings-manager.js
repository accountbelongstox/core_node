/**
 * Settings Manager - Configuration UI
 */

class SettingsManager {
  constructor() {
    this.config = null;
    this.dialogEl = null;
  }

  /**
   * Load current configuration
   */
  async loadConfig() {
    try {
      const response = await fetch('/api/config');
      const data = await response.json();

      if (data.success) {
        this.config = data.config;
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Settings] Failed to load config:', error);
      return false;
    }
  }

  /**
   * Show settings dialog
   */
  async show() {
    await this.loadConfig();

    if (!this.config) {
      alert('Failed to load configuration');
      return;
    }

    this.render();
  }

  /**
   * Render settings dialog
   */
  render() {
    // Create dialog if not exists
    if (!this.dialogEl) {
      this.dialogEl = document.createElement('div');
      this.dialogEl.id = 'settings-dialog';
      this.dialogEl.className = 'settings-dialog';
      document.body.appendChild(this.dialogEl);
    }

    this.dialogEl.innerHTML = `
      <div class="settings-overlay"></div>
      <div class="settings-content">
        <div class="settings-header">
          <h2>Settings</h2>
          <button class="settings-close-btn" id="settings-close-btn">×</button>
        </div>
        <div class="settings-body">
          ${this.renderSections()}
        </div>
        <div class="settings-footer">
          <button class="btn-secondary" id="settings-reset-btn">Reset to Defaults</button>
          <button class="btn-primary" id="settings-save-btn">Save & Reload</button>
        </div>
      </div>
    `;

    this.dialogEl.style.display = 'block';
    this.attachEventListeners();
  }

  /**
   * Render configuration sections
   */
  renderSections() {
    const sections = [
      { key: 'server', label: 'Server Settings', icon: '🖥️' },
      { key: 'paths', label: 'Path Configuration', icon: '📁' },
      { key: 'features', label: 'Feature Flags', icon: '🚀' },
      { key: 'image_analysis', label: 'Image Analysis', icon: '🎨' },
      { key: 'comparison', label: 'Comparison Settings', icon: '🔍' },
      { key: 'ui', label: 'UI Preferences', icon: '🎭' }
    ];

    return sections.map(section => `
      <div class="settings-section">
        <h3><span>${section.icon}</span> ${section.label}</h3>
        ${this.renderFields(section.key, this.config[section.key] || {})}
      </div>
    `).join('');
  }

  /**
   * Render configuration fields
   */
  renderFields(sectionKey, sectionData) {
    return Object.entries(sectionData).map(([key, value]) => {
      const fullKey = `${sectionKey}.${key}`;
      const fieldType = typeof value;

      if (fieldType === 'boolean') {
        return `
          <div class="settings-field">
            <label>
              <input type="checkbox" data-config-key="${fullKey}" ${value ? 'checked' : ''}>
              <span>${this.formatLabel(key)}</span>
            </label>
          </div>
        `;
      } else if (fieldType === 'number') {
        return `
          <div class="settings-field">
            <label>${this.formatLabel(key)}</label>
            <input type="number" data-config-key="${fullKey}" value="${value}">
          </div>
        `;
      } else {
        return `
          <div class="settings-field">
            <label>${this.formatLabel(key)}</label>
            <input type="text" data-config-key="${fullKey}" value="${value}">
          </div>
        `;
      }
    }).join('');
  }

  /**
   * Format field label
   */
  formatLabel(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Close button
    document.getElementById('settings-close-btn').addEventListener('click', () => this.hide());

    // Reset button
    document.getElementById('settings-reset-btn').addEventListener('click', () => this.resetConfig());

    // Save button
    document.getElementById('settings-save-btn').addEventListener('click', () => this.saveConfig());

    // Close on overlay click
    document.querySelector('.settings-overlay').addEventListener('click', () => this.hide());
  }

  /**
   * Hide settings dialog
   */
  hide() {
    if (this.dialogEl) {
      this.dialogEl.style.display = 'none';
    }
  }

  /**
   * Save configuration
   */
  async saveConfig() {
    try {
      // Collect all changed values
      const updates = [];
      document.querySelectorAll('[data-config-key]').forEach(input => {
        const key = input.dataset.configKey;
        let value;

        if (input.type === 'checkbox') {
          value = input.checked;
        } else if (input.type === 'number') {
          value = parseFloat(input.value);
        } else {
          value = input.value;
        }

        updates.push({ key, value });
      });

      // Send updates to server
      for (const { key, value } of updates) {
        await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value })
        });
      }

      alert('Settings saved successfully! Reloading...');
      window.location.reload();

    } catch (error) {
      console.error('[Settings] Failed to save:', error);
      alert('Failed to save settings');
    }
  }

  /**
   * Reset configuration to defaults
   */
  async resetConfig() {
    if (!confirm('Reset all settings to defaults?')) return;

    try {
      const response = await fetch('/api/config/reset', { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        alert('Settings reset successfully! Reloading...');
        window.location.reload();
      }
    } catch (error) {
      console.error('[Settings] Failed to reset:', error);
      alert('Failed to reset settings');
    }
  }
}

// Export globally
window.SettingsManager = SettingsManager;
