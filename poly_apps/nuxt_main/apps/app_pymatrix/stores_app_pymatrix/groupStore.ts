import { defineStore } from 'pinia';
import type { Device, GroupState } from '~/types/pymatrix';

interface GroupControlState {
  groupId: string | null;
  hostSerial: string | null;
  slaveSerials: Set<string>;
  enabled: boolean;
}

export const useGroupStore = defineStore('pymatrix-group', {
  state: (): GroupControlState => ({
    groupId: null,
    hostSerial: null,
    slaveSerials: new Set(),
    enabled: false
  }),

  getters: {
    hasGroup: (state) => state.groupId !== null,

    isHost: (state) => (serial: string) => state.hostSerial === serial,

    isSlave: (state) => (serial: string) => state.slaveSerials.has(serial),

    slaves: (state) => Array.from(state.slaveSerials),

    deviceCount: (state) => {
      let count = 0;
      if (state.hostSerial) count++;
      count += state.slaveSerials.size;
      return count;
    }
  },

  actions: {
    createGroup(groupId: string, hostSerial: string) {
      this.groupId = groupId;
      this.hostSerial = hostSerial;
      this.slaveSerials.clear();
      this.enabled = true;
    },

    setHost(serial: string) {
      if (this.hostSerial && this.slaveSerials.has(this.hostSerial)) {
        this.slaveSerials.delete(this.hostSerial);
      }

      if (this.slaveSerials.has(serial)) {
        this.slaveSerials.delete(serial);
      }

      this.hostSerial = serial;
    },

    addSlave(serial: string) {
      if (serial !== this.hostSerial) {
        this.slaveSerials.add(serial);
      }
    },

    removeSlave(serial: string) {
      this.slaveSerials.delete(serial);
    },

    clearSlaves() {
      this.slaveSerials.clear();
    },

    enableGroup() {
      this.enabled = true;
    },

    disableGroup() {
      this.enabled = false;
    },

    destroyGroup() {
      this.groupId = null;
      this.hostSerial = null;
      this.slaveSerials.clear();
      this.enabled = false;
    },

    updateGroupState(state: GroupState) {
      this.groupId = state.groupId;
      this.hostSerial = state.hostSerial;
      this.slaveSerials = new Set(state.slaves.map(s => s.serial));
    }
  }
});
