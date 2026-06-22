/**
 * PageView Updater - Frontend component for updating pageview_map.json
 */

class PageViewUpdater {
  constructor() {
    this.currentApp = null;
    this.updating = false;
  }

  /**
   * Set current app
   */
  setCurrentApp(appName) {
    this.currentApp = appName;
  }

  /**
   * Update pageview_map.json for current app
   */
  async updatePageViewMap(layer = "all", force = false) {
    if (!this.currentApp || this.updating) return;

    this.updating = true;

    try {
      const response = await fetch(`/api/apps/${this.currentApp}/pageview/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layer, force })
      });

      const result = await response.json();

      if (result.success) {
        const stats = result.stats;
        alert(`PageView map updated!\n\nPages: ${stats.total_pages}\nImages: ${stats.total_images}\nOrphans removed: ${stats.removed_orphans}`);
      } else {
        alert(`Failed to update: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      this.updating = false;
    }
  }

  /**
   * Get pageview map stats
   */
  async getStats() {
    if (!this.currentApp) return null;

    try {
      const response = await fetch(`/api/apps/${this.currentApp}/pageview/stats`);
      return await response.json();
    } catch (error) {
      console.error('Failed to get stats:', error);
      return null;
    }
  }

  /**
   * Render update buttons in panel
   */
  renderUpdateButtons(containerEl) {
    const html = `
      <div class="pageview-updater-section" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 2px solid var(--border-color);">
        <h3 style="margin-bottom: 1rem;">PageView Map Auto-Update</h3>
        <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem;">
          Automatically analyze images and update pageview_map.json with color palettes and OCR text.
        </p>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <button id="update-pageview-all" class="btn btn-primary" style="flex: 1; min-width: 150px;">
            🎨 Update All Layers
          </button>
          <button id="update-pageview-rough" class="btn btn-secondary" style="flex: 1; min-width: 150px;">
            📐 Update Rough Layer
          </button>
          <button id="update-pageview-detailed" class="btn btn-secondary" style="flex: 1; min-width: 150px;">
            ✨ Update Detailed Layer
          </button>
          <button id="update-pageview-force" class="btn btn-warning" style="flex: 1; min-width: 150px;">
            🔄 Force Re-analyze All
          </button>
        </div>
        <div id="pageview-stats" style="margin-top: 1rem; font-size: 0.85rem; color: var(--text-muted);"></div>
      </div>
    `;

    // Insert before existing content or at the end
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    containerEl.appendChild(tempDiv.firstElementChild);

    // Attach event listeners
    document.getElementById('update-pageview-all').addEventListener('click', () => {
      this.updatePageViewMap('all', false);
    });

    document.getElementById('update-pageview-rough').addEventListener('click', () => {
      this.updatePageViewMap('rough', false);
    });

    document.getElementById('update-pageview-detailed').addEventListener('click', () => {
      this.updatePageViewMap('detailed', false);
    });

    document.getElementById('update-pageview-force').addEventListener('click', () => {
      if (confirm('Force re-analyze all images? This may take longer.')) {
        this.updatePageViewMap('all', true);
      }
    });

    // Load and display stats
    this.displayStats();
  }

  /**
   * Display current pageview map stats
   */
  async displayStats() {
    const statsEl = document.getElementById('pageview-stats');
    if (!statsEl) return;

    const stats = await this.getStats();

    if (!stats || !stats.success) {
      statsEl.textContent = 'PageView map not found or not yet created.';
      return;
    }

    const s = stats.stats;
    statsEl.innerHTML = `
      📊 Current: ${s.total_pages} pages, ${s.total_images} images
      (${s.analyzed_images} analyzed, ${s.analysis_completion}% complete)
    `;
  }
}

// Export for use in app.js
window.PageViewUpdater = PageViewUpdater;
