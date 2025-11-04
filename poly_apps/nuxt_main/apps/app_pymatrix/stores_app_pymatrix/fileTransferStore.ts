import { defineStore } from 'pinia';
import type { FileTransferProgress, ApkInstallProgress } from '@/types/pymatrix';

interface FileTransferStoreState {
  fileTransfers: Map<string, FileTransferProgress>;
  apkInstalls: Map<string, ApkInstallProgress>;
}

export const useFileTransferStore = defineStore('pymatrix-file-transfer', {
  state: (): FileTransferStoreState => ({
    fileTransfers: new Map(),
    apkInstalls: new Map()
  }),

  getters: {
    getFileTransfer: (state) => (transferId: string) => {
      return state.fileTransfers.get(transferId);
    },

    getApkInstall: (state) => (installId: string) => {
      return state.apkInstalls.get(installId);
    },

    getTransfersByDevice: (state) => (deviceSerial: string) => {
      return Array.from(state.fileTransfers.values())
        .filter(transfer => transfer.deviceSerial === deviceSerial);
    },

    getInstallsByDevice: (state) => (deviceSerial: string) => {
      return Array.from(state.apkInstalls.values())
        .filter(install => install.deviceSerial === deviceSerial);
    },

    activeTransfersCount: (state) => {
      let count = 0;
      for (const transfer of state.fileTransfers.values()) {
        if (transfer.status === 'uploading') {
          count++;
        }
      }
      return count;
    },

    activeInstallsCount: (state) => {
      let count = 0;
      for (const install of state.apkInstalls.values()) {
        if (install.status === 'uploading' || install.status === 'installing') {
          count++;
        }
      }
      return count;
    },

    allFileTransfers: (state) => {
      return Array.from(state.fileTransfers.values());
    },

    allApkInstalls: (state) => {
      return Array.from(state.apkInstalls.values());
    },

    recentTransfers: (state) => (limit: number = 10) => {
      return Array.from(state.fileTransfers.values())
        .sort((a, b) => b.startTime - a.startTime)
        .slice(0, limit);
    },

    recentInstalls: (state) => (limit: number = 10) => {
      return Array.from(state.apkInstalls.values())
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, limit);
    }
  },

  actions: {
    // File Transfer Actions
    startFileTransfer(transfer: Omit<FileTransferProgress, 'startTime' | 'percentage' | 'status'>) {
      const fileTransfer: FileTransferProgress = {
        ...transfer,
        transferredBytes: 0,
        percentage: 0,
        status: 'uploading',
        startTime: Date.now()
      };

      this.fileTransfers.set(fileTransfer.id, fileTransfer);
    },

    updateFileTransferProgress(
      transferId: string,
      transferredBytes: number,
      speed?: number
    ) {
      const transfer = this.fileTransfers.get(transferId);
      if (!transfer) return;

      transfer.transferredBytes = transferredBytes;
      transfer.percentage = Math.round((transferredBytes / transfer.fileSize) * 100);
      transfer.speed = speed;

      this.fileTransfers.set(transferId, transfer);
    },

    completeFileTransfer(transferId: string) {
      const transfer = this.fileTransfers.get(transferId);
      if (!transfer) return;

      transfer.status = 'completed';
      transfer.percentage = 100;
      transfer.transferredBytes = transfer.fileSize;
      transfer.endTime = Date.now();

      this.fileTransfers.set(transferId, transfer);
    },

    failFileTransfer(transferId: string, error: string) {
      const transfer = this.fileTransfers.get(transferId);
      if (!transfer) return;

      transfer.status = 'failed';
      transfer.error = error;
      transfer.endTime = Date.now();

      this.fileTransfers.set(transferId, transfer);
    },

    cancelFileTransfer(transferId: string) {
      const transfer = this.fileTransfers.get(transferId);
      if (!transfer) return;

      transfer.status = 'cancelled';
      transfer.endTime = Date.now();

      this.fileTransfers.set(transferId, transfer);
    },

    removeFileTransfer(transferId: string) {
      this.fileTransfers.delete(transferId);
    },

    clearFileTransfers() {
      this.fileTransfers.clear();
    },

    clearCompletedTransfers() {
      for (const [id, transfer] of this.fileTransfers.entries()) {
        if (transfer.status === 'completed' || transfer.status === 'failed' || transfer.status === 'cancelled') {
          this.fileTransfers.delete(id);
        }
      }
    },

    // APK Install Actions
    startApkInstall(install: Omit<ApkInstallProgress, 'progress' | 'status'>) {
      const apkInstall: ApkInstallProgress = {
        ...install,
        progress: 0,
        status: 'uploading'
      };

      this.apkInstalls.set(apkInstall.id, apkInstall);
    },

    updateApkInstallProgress(installId: string, progress: number, status: ApkInstallProgress['status']) {
      const install = this.apkInstalls.get(installId);
      if (!install) return;

      install.progress = progress;
      install.status = status;

      this.apkInstalls.set(installId, install);
    },

    setApkInstallStatus(installId: string, status: ApkInstallProgress['status']) {
      const install = this.apkInstalls.get(installId);
      if (!install) return;

      install.status = status;

      this.apkInstalls.set(installId, install);
    },

    completeApkInstall(installId: string) {
      const install = this.apkInstalls.get(installId);
      if (!install) return;

      install.status = 'installed';
      install.progress = 100;

      this.apkInstalls.set(installId, install);
    },

    failApkInstall(installId: string, error: string) {
      const install = this.apkInstalls.get(installId);
      if (!install) return;

      install.status = 'failed';
      install.error = error;

      this.apkInstalls.set(installId, install);
    },

    removeApkInstall(installId: string) {
      this.apkInstalls.delete(installId);
    },

    clearApkInstalls() {
      this.apkInstalls.clear();
    },

    clearCompletedInstalls() {
      for (const [id, install] of this.apkInstalls.entries()) {
        if (install.status === 'installed' || install.status === 'failed') {
          this.apkInstalls.delete(id);
        }
      }
    },

    // Device Cleanup
    clearDeviceTransfers(deviceSerial: string) {
      // Remove all file transfers for device
      for (const [id, transfer] of this.fileTransfers.entries()) {
        if (transfer.deviceSerial === deviceSerial) {
          this.fileTransfers.delete(id);
        }
      }

      // Remove all APK installs for device
      for (const [id, install] of this.apkInstalls.entries()) {
        if (install.deviceSerial === deviceSerial) {
          this.apkInstalls.delete(id);
        }
      }
    },

    // Batch cleanup
    clearAll() {
      this.fileTransfers.clear();
      this.apkInstalls.clear();
    }
  }
});
