// Centralized Data Models
// All data structures are defined here to avoid duplication

class DeviceModel {
  constructor(data = {}) {
    this.id = data.id || '';
    this.name = data.name || '';
    this.status = data.status || 'offline'; // online, offline, error
    this.latency = data.latency || 0; // ms
    this.group = data.group || '';
    this.isLive = data.isLive || false;
    this.screenContent = data.screenContent || null;
    this.metadata = data.metadata || {};
  }

  static fromArray(dataArray) {
    return dataArray.map(item => new DeviceModel(item));
  }
}

class DeviceGroupModel {
  constructor(data = {}) {
    this.id = data.id || '';
    this.name = data.name || '';
    this.icon = data.icon || '📂';
    this.devices = data.devices || [];
    this.isExpanded = data.isExpanded || false;
  }
}

class TaskModel {
  constructor(data = {}) {
    this.id = data.id || '';
    this.name = data.name || '';
    this.progress = data.progress || 0; // 0-100
    this.status = data.status || 'idle'; // idle, running, paused, error
    this.color = data.color || 'primary';
  }
}

class LogEntryModel {
  constructor(data = {}) {
    this.id = data.id || Date.now().toString();
    this.time = data.time || new Date().toLocaleTimeString();
    this.message = data.message || '';
    this.type = data.type || 'info'; // info, success, warning, error
  }
}

class SettingsModel {
  constructor(data = {}) {
    this.refreshRate = data.refreshRate || 60; // FPS
    this.displayMode = data.displayMode || 'grid'; // grid, list
    this.sortBy = data.sortBy || 'id'; // id, latency, name
    this.sortOrder = data.sortOrder || 'asc'; // asc, desc
    this.darkMode = data.darkMode || false;
    this.language = data.language || 'en';
    this.brightness = data.brightness || 80; // 0-100
  }
}

class AppStateModel {
  constructor() {
    this.selectedDevices = [];
    this.activeTab = 'tab-monitor';
    this.leftSidebarExpanded = true;
    this.rightSidebarExpanded = true;
    this.modalOpen = false;
    this.currentFilter = 'all';
    this.searchQuery = '';
  }
}

// Default data (will be replaced by API calls in production)
const DefaultData = {
  devices: [
    { id: 'XM-001', name: 'XM-001', status: 'online', latency: 32, group: 'A', isLive: true },
    { id: 'XM-002', name: 'XM-002', status: 'online', latency: 41, group: 'A', isLive: false },
    { id: 'XM-003', name: 'XM-003', status: 'offline', latency: 0, group: 'A', isLive: false },
    { id: 'XM-004', name: 'XM-004', status: 'online', latency: 20, group: 'A', isLive: false },
    { id: 'XM-005', name: 'XM-005', status: 'online', latency: 22, group: 'A', isLive: false },
  ],
  groups: [
    { id: 'A', name: 'Douyin Live Group (A)', icon: '📂', devices: ['XM-001', 'XM-002', 'XM-003', 'XM-004', 'XM-005'], isExpanded: true },
    { id: 'B', name: 'TK Account Group (B)', icon: '📂', devices: [], isExpanded: false },
  ],
  tasks: [
    { id: 'task1', name: 'Like Script', progress: 80, status: 'running', color: 'primary' },
    { id: 'task2', name: 'Video Publish', progress: 45, status: 'running', color: 'purple' },
  ],
  logs: [
    { time: '11:02', message: 'System initialization complete', type: 'info' },
    { time: '11:03', message: 'XM-001 connected successfully', type: 'success' },
    { time: '11:05', message: 'XM-003 connection lost', type: 'warning' },
  ],
  stats: {
    total: 128,
    online: 112,
    error: 16,
  },
};

export { DeviceModel, DeviceGroupModel, TaskModel, LogEntryModel, SettingsModel, AppStateModel, DefaultData };













