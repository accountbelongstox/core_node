import { defineStore } from 'pinia';
import type { Device } from '@/types/pymatrix';

interface DeviceFilterState {
  searchQuery: string;
  stateFilter: Array<'connected' | 'disconnected' | 'connecting'>;
  modelFilter: string[];
  streamingFilter: boolean | null;
  groupFilter: string[];
  tagFilter: string[];
}

interface DeviceState {
  devices: Map<string, Device>;
  selectedSerial: string | null;
  filters: DeviceFilterState;
}

export const useDeviceStore = defineStore('pymatrix-device', {
  state: (): DeviceState => ({
    devices: new Map(),
    selectedSerial: null,
    filters: {
      searchQuery: '',
      stateFilter: [],
      modelFilter: [],
      streamingFilter: null,
      groupFilter: [],
      tagFilter: []
    }
  }),

  getters: {
    deviceList: (state) => Array.from(state.devices.values()),

    selectedDevice: (state) => {
      return state.selectedSerial ? state.devices.get(state.selectedSerial) : null;
    },

    connectedDevices: (state) => {
      return Array.from(state.devices.values()).filter(d => d.state === 'connected');
    },

    deviceCount: (state) => state.devices.size,

    /**
     * Get all unique device models
     */
    availableModels: (state): string[] => {
      const models = new Set<string>();
      state.devices.forEach(device => {
        if (device.model) {
          models.add(device.model);
        }
      });
      return Array.from(models).sort();
    },

    /**
     * Get filtered device list based on current filter state
     */
    filteredDevices: (state): Device[] => {
      let devices = Array.from(state.devices.values());

      // Apply search query
      if (state.filters.searchQuery.trim()) {
        const query = state.filters.searchQuery.toLowerCase().trim();
        devices = devices.filter(device =>
          device.name.toLowerCase().includes(query) ||
          device.serial.toLowerCase().includes(query) ||
          device.model.toLowerCase().includes(query)
        );
      }

      // Apply state filter
      if (state.filters.stateFilter.length > 0) {
        devices = devices.filter(device =>
          state.filters.stateFilter.includes(device.state)
        );
      }

      // Apply model filter
      if (state.filters.modelFilter.length > 0) {
        devices = devices.filter(device =>
          state.filters.modelFilter.includes(device.model)
        );
      }

      // Apply streaming filter
      if (state.filters.streamingFilter !== null) {
        devices = devices.filter(device =>
          device.streaming === state.filters.streamingFilter
        );
      }

      // Apply tag filter (device must have ALL selected tags)
      if (state.filters.tagFilter.length > 0) {
        devices = devices.filter(device => {
          if (!device.tags || device.tags.length === 0) return false;
          return state.filters.tagFilter.every(tagId => device.tags!.includes(tagId));
        });
      }

      // Apply group filter (check if device is in selected groups)
      if (state.filters.groupFilter.length > 0) {
        // This will be implemented when integrating with groupStore
        // For now, we'll skip this filter
      }

      return devices;
    },

    /**
     * Get count of filtered devices
     */
    filteredDeviceCount: (state): number => {
      // Use the getter from this store
      const store = useDeviceStore();
      return store.filteredDevices.length;
    },

    /**
     * Check if any filters are active
     */
    hasActiveFilters: (state): boolean => {
      return (
        state.filters.searchQuery.trim() !== '' ||
        state.filters.stateFilter.length > 0 ||
        state.filters.modelFilter.length > 0 ||
        state.filters.streamingFilter !== null ||
        state.filters.groupFilter.length > 0 ||
        state.filters.tagFilter.length > 0
      );
    },

    /**
     * Get devices by tag ID
     */
    getDevicesByTag: (state) => (tagId: string): Device[] => {
      return Array.from(state.devices.values()).filter(device =>
        device.tags?.includes(tagId)
      );
    },

    /**
     * Get device tag IDs
     */
    getDeviceTagIds: (state) => (serial: string): string[] => {
      const device = state.devices.get(serial);
      return device?.tags ?? [];
    },

    /**
     * Get all unique tags used across devices
     */
    usedTagIds: (state): string[] => {
      const tagSet = new Set<string>();
      state.devices.forEach(device => {
        if (device.tags) {
          device.tags.forEach(tagId => tagSet.add(tagId));
        }
      });
      return Array.from(tagSet);
    }
  },

  actions: {
    addDevice(device: Device) {
      this.devices.set(device.serial, device);
    },

    removeDevice(serial: string) {
      this.devices.delete(serial);
      if (this.selectedSerial === serial) {
        this.selectedSerial = null;
      }
    },

    updateDevice(serial: string, updates: Partial<Device>) {
      const device = this.devices.get(serial);
      if (device) {
        Object.assign(device, updates);
        this.devices.set(serial, device);
      }
    },

    setDeviceState(serial: string, state: Device['state']) {
      this.updateDevice(serial, { state });
    },

    setDeviceStreaming(serial: string, streaming: boolean) {
      this.updateDevice(serial, { streaming });
    },

    setDeviceControllable(serial: string, controllable: boolean) {
      this.updateDevice(serial, { controllable });
    },

    selectDevice(serial: string | null) {
      this.selectedSerial = serial;
    },

    clearDevices() {
      this.devices.clear();
      this.selectedSerial = null;
    },

    getDevice(serial: string): Device | undefined {
      return this.devices.get(serial);
    },

    hasDevice(serial: string): boolean {
      return this.devices.has(serial);
    },

    // Filter actions
    setSearchQuery(query: string) {
      this.filters.searchQuery = query;
    },

    setStateFilter(states: Array<'connected' | 'disconnected' | 'connecting'>) {
      this.filters.stateFilter = states;
    },

    toggleStateFilter(state: 'connected' | 'disconnected' | 'connecting') {
      const index = this.filters.stateFilter.indexOf(state);
      if (index >= 0) {
        this.filters.stateFilter.splice(index, 1);
      } else {
        this.filters.stateFilter.push(state);
      }
    },

    setModelFilter(models: string[]) {
      this.filters.modelFilter = models;
    },

    toggleModelFilter(model: string) {
      const index = this.filters.modelFilter.indexOf(model);
      if (index >= 0) {
        this.filters.modelFilter.splice(index, 1);
      } else {
        this.filters.modelFilter.push(model);
      }
    },

    setStreamingFilter(streaming: boolean | null) {
      this.filters.streamingFilter = streaming;
    },

    setGroupFilter(groups: string[]) {
      this.filters.groupFilter = groups;
    },

    toggleGroupFilter(groupId: string) {
      const index = this.filters.groupFilter.indexOf(groupId);
      if (index >= 0) {
        this.filters.groupFilter.splice(index, 1);
      } else {
        this.filters.groupFilter.push(groupId);
      }
    },

    setTagFilter(tagIds: string[]) {
      this.filters.tagFilter = tagIds;
    },

    toggleTagFilter(tagId: string) {
      const index = this.filters.tagFilter.indexOf(tagId);
      if (index >= 0) {
        this.filters.tagFilter.splice(index, 1);
      } else {
        this.filters.tagFilter.push(tagId);
      }
    },

    // Tag assignment actions
    assignTagToDevice(serial: string, tagId: string) {
      const device = this.devices.get(serial);
      if (device) {
        if (!device.tags) {
          device.tags = [];
        }
        if (!device.tags.includes(tagId)) {
          device.tags.push(tagId);
          this.devices.set(serial, device);
        }
      }
    },

    removeTagFromDevice(serial: string, tagId: string) {
      const device = this.devices.get(serial);
      if (device && device.tags) {
        const index = device.tags.indexOf(tagId);
        if (index >= 0) {
          device.tags.splice(index, 1);
          this.devices.set(serial, device);
        }
      }
    },

    assignTagsToDevices(serials: string[], tagId: string) {
      serials.forEach(serial => {
        this.assignTagToDevice(serial, tagId);
      });
    },

    removeTagFromDevices(serials: string[], tagId: string) {
      serials.forEach(serial => {
        this.removeTagFromDevice(serial, tagId);
      });
    },

    setDeviceTags(serial: string, tagIds: string[]) {
      const device = this.devices.get(serial);
      if (device) {
        device.tags = [...tagIds];
        this.devices.set(serial, device);
      }
    },

    clearDeviceTags(serial: string) {
      const device = this.devices.get(serial);
      if (device) {
        device.tags = [];
        this.devices.set(serial, device);
      }
    },

    clearFilters() {
      this.filters = {
        searchQuery: '',
        stateFilter: [],
        modelFilter: [],
        streamingFilter: null,
        groupFilter: [],
        tagFilter: []
      };
    },

    clearSearchQuery() {
      this.filters.searchQuery = '';
    }
  }
});
