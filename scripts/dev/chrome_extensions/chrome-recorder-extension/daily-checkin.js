// Daily Check-in Module for Browser Bridge
// Supports multiple sites with daily refresh/check-in

class DailyCheckinManager {
  constructor() {
    this.sites = [];
    this.loadConfig();
  }

  getDefaultSites() {
    return [
      {
        id: 'anyrouter',
        name: 'AnyRouter',
        url: 'https://anyrouter.top/console',
        enabled: true,
        checkHour: 8,
        checkMinute: 0,
      }
    ];
  }

  loadConfig() {
    const saved = localStorage.getItem('dailyCheckinSites');
    if (saved) {
      this.sites = JSON.parse(saved);
    } else {
      this.sites = this.getDefaultSites();
      this.saveConfig();
    }
    return this.sites;
  }

  saveConfig() {
    localStorage.setItem('dailyCheckinSites', JSON.stringify(this.sites));
  }

  addSite(site) {
    const id = site.id || 'site_' + Date.now();
    this.sites.push({
      id,
      name: site.name || site.url,
      url: site.url,
      enabled: site.enabled !== false,
      checkHour: site.checkHour || 8,
      checkMinute: site.checkMinute || 0,
    });
    this.saveConfig();
    return id;
  }

  removeSite(siteId) {
    this.sites = this.sites.filter(s => s.id !== siteId);
    this.saveConfig();
  }

  updateSite(siteId, updates) {
    const site = this.sites.find(s => s.id === siteId);
    if (site) {
      Object.assign(site, updates);
      this.saveConfig();
    }
  }

  getSites() {
    return this.sites;
  }

  getToday() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  getLastCheckin(siteId) {
    const key = `checkin_${siteId}`;
    return localStorage.getItem(key);
  }

  setLastCheckin(siteId) {
    const key = `checkin_${siteId}`;
    const today = this.getToday();
    localStorage.setItem(key, today);
    return today;
  }

  hasCheckedInToday(siteId) {
    const lastCheckin = this.getLastCheckin(siteId);
    return lastCheckin === this.getToday();
  }

  async findTabByUrl(urlPattern) {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url && tab.url.includes(urlPattern)) {
        return tab;
      }
    }
    return null;
  }

  extractDomain(url) {
    try {
      const u = new URL(url);
      return u.hostname;
    } catch (e) {
      return url;
    }
  }

  async performCheckin(siteId, force = false) {
    const site = this.sites.find(s => s.id === siteId);
    if (!site) {
      return { success: false, error: 'Site not found' };
    }

    if (!site.enabled) {
      return { success: false, error: 'Site is disabled' };
    }

    if (!force && this.hasCheckedInToday(siteId)) {
      return { success: false, error: 'Already checked in today', alreadyDone: true };
    }

    console.log(`[DailyCheckin] Performing check-in for ${site.name}...`);

    try {
      const domain = this.extractDomain(site.url);
      let tab = await this.findTabByUrl(domain);

      if (tab) {
        console.log(`[DailyCheckin] Found existing tab, switching and refreshing...`);
        await chrome.windows.update(tab.windowId, { focused: true });
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.tabs.reload(tab.id);
      } else {
        console.log(`[DailyCheckin] Opening new tab...`);
        tab = await chrome.tabs.create({ url: site.url, active: true });
      }

      this.setLastCheckin(siteId);

      return { success: true, tabId: tab.id, site: site.name };
    } catch (error) {
      console.error(`[DailyCheckin] Error:`, error);
      return { success: false, error: error.message };
    }
  }

  async checkAllSites(force = false) {
    const results = [];
    for (const site of this.sites) {
      if (site.enabled) {
        const result = await this.performCheckin(site.id, force);
        results.push({ siteId: site.id, siteName: site.name, ...result });
        
        // Small delay between sites
        if (this.sites.indexOf(site) < this.sites.length - 1) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
    return results;
  }

  getStatus() {
    const today = this.getToday();
    return this.sites.map(site => ({
      ...site,
      lastCheckin: this.getLastCheckin(site.id),
      checkedToday: this.hasCheckedInToday(site.id),
    }));
  }

  shouldCheckNow(site) {
    if (!site.enabled) return false;
    if (this.hasCheckedInToday(site.id)) return false;

    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    // Check if current time is past the scheduled check time
    if (hour > site.checkHour) return true;
    if (hour === site.checkHour && minute >= site.checkMinute) return true;

    return false;
  }

  async runScheduledChecks() {
    const results = [];
    for (const site of this.sites) {
      if (this.shouldCheckNow(site)) {
        console.log(`[DailyCheckin] Scheduled check for ${site.name}`);
        const result = await this.performCheckin(site.id);
        results.push({ siteId: site.id, siteName: site.name, ...result });
      }
    }
    return results;
  }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.DailyCheckinManager = DailyCheckinManager;
}

