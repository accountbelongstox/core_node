/**
 * PyMatrix File Operations API Service
 * Handles file push and APK installation operations to pyMatrix backend
 * Following Nuxt multi-app namespace architecture
 */

export interface FilePushRequest {
  filePath: string;
  targetPath: string;
  overwrite?: boolean;
}

export interface FilePushResponse {
  success: boolean;
  filePath?: string;
  targetPath?: string;
  fileSize?: number;
  transferTime?: number;
  error?: string;
}

export interface ApkInstallRequest {
  apkPath: string;
  reinstall?: boolean;
  grantPermissions?: boolean;
}

export interface ApkInstallResponse {
  success: boolean;
  packageName?: string;
  versionCode?: number;
  versionName?: string;
  installTime?: number;
  error?: string;
}

export interface FileUploadProgress {
  serial: string;
  fileName: string;
  fileSize: number;
  uploadedBytes: number;
  progress: number; // 0-100
  speed: number; // bytes/second
  estimatedTimeRemaining: number; // seconds
  status: 'uploading' | 'completed' | 'failed' | 'cancelled';
}

export interface ApkInstallProgress {
  serial: string;
  packageName: string;
  status: 'uploading' | 'installing' | 'completed' | 'failed';
  progress: number; // 0-100
  message?: string;
  error?: string;
}

export class PyMatrixFileAPI {
  private baseUrl: string;
  private apiPrefix: string;

  constructor() {
    // Get from pymatrix config
    this.baseUrl = 'http://localhost:8000';
    this.apiPrefix = '/api';
  }

  /**
   * Push a file to device
   */
  async pushFile(
    serial: string,
    request: FilePushRequest,
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<FilePushResponse> {
    try {
      const formData = new FormData();

      // If filePath is a File object
      if (request.filePath instanceof File) {
        formData.append('file', request.filePath);
      } else {
        // If filePath is a string path, we need to handle it differently
        // This might require server-side file reading
        formData.append('filePath', request.filePath);
      }

      formData.append('targetPath', request.targetPath);
      if (request.overwrite !== undefined) {
        formData.append('overwrite', String(request.overwrite));
      }

      const response = await $fetch<FilePushResponse>(
        `${this.baseUrl}${this.apiPrefix}/devices/${serial}/files/push`,
        {
          method: 'POST',
          headers: {
            'X-App-Namespace': 'pymatrix'
          },
          body: formData,
          // TODO: Add progress tracking when supported
          onUploadProgress: (progress) => {
            if (onProgress && progress.total) {
              const uploadProgress: FileUploadProgress = {
                serial,
                fileName: request.filePath instanceof File ? request.filePath.name : request.filePath,
                fileSize: progress.total,
                uploadedBytes: progress.loaded,
                progress: Math.round((progress.loaded / progress.total) * 100),
                speed: 0, // Calculate from time delta
                estimatedTimeRemaining: 0,
                status: progress.loaded === progress.total ? 'completed' : 'uploading'
              };
              onProgress(uploadProgress);
            }
          }
        }
      );

      return response;
    } catch (error) {
      console.error('[PyMatrixFileAPI] Push file error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Install APK on device
   */
  async installApk(
    serial: string,
    request: ApkInstallRequest,
    onProgress?: (progress: ApkInstallProgress) => void
  ): Promise<ApkInstallResponse> {
    try {
      const formData = new FormData();

      // If apkPath is a File object
      if (request.apkPath instanceof File) {
        formData.append('apk', request.apkPath);
      } else {
        formData.append('apkPath', request.apkPath);
      }

      if (request.reinstall !== undefined) {
        formData.append('reinstall', String(request.reinstall));
      }
      if (request.grantPermissions !== undefined) {
        formData.append('grantPermissions', String(request.grantPermissions));
      }

      const response = await $fetch<ApkInstallResponse>(
        `${this.baseUrl}${this.apiPrefix}/devices/${serial}/apk/install`,
        {
          method: 'POST',
          headers: {
            'X-App-Namespace': 'pymatrix'
          },
          body: formData,
          onUploadProgress: (progress) => {
            if (onProgress && progress.total) {
              const installProgress: ApkInstallProgress = {
                serial,
                packageName: '',
                status: progress.loaded === progress.total ? 'installing' : 'uploading',
                progress: Math.round((progress.loaded / progress.total) * 50), // 50% for upload
                message: progress.loaded === progress.total ? 'Installing APK...' : 'Uploading APK...'
              };
              onProgress(installProgress);
            }
          }
        }
      );

      // Final progress update
      if (onProgress && response.success) {
        onProgress({
          serial,
          packageName: response.packageName || '',
          status: 'completed',
          progress: 100,
          message: 'Installation completed'
        });
      }

      return response;
    } catch (error) {
      console.error('[PyMatrixFileAPI] Install APK error:', error);

      if (onProgress) {
        onProgress({
          serial,
          packageName: '',
          status: 'failed',
          progress: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Uninstall app from device
   */
  async uninstallApp(
    serial: string,
    packageName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await $fetch<{ success: boolean; error?: string }>(
        `${this.baseUrl}${this.apiPrefix}/devices/${serial}/apk/uninstall`,
        {
          method: 'POST',
          headers: {
            'X-App-Namespace': 'pymatrix',
            'Content-Type': 'application/json'
          },
          body: {
            packageName
          }
        }
      );

      return response;
    } catch (error) {
      console.error('[PyMatrixFileAPI] Uninstall app error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List installed packages on device
   */
  async listPackages(
    serial: string,
    systemApps: boolean = false
  ): Promise<{ success: boolean; packages?: string[]; error?: string }> {
    try {
      const response = await $fetch<{ success: boolean; packages?: string[]; error?: string }>(
        `${this.baseUrl}${this.apiPrefix}/devices/${serial}/packages`,
        {
          method: 'GET',
          headers: {
            'X-App-Namespace': 'pymatrix'
          },
          query: {
            system: systemApps
          }
        }
      );

      return response;
    } catch (error) {
      console.error('[PyMatrixFileAPI] List packages error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Pull file from device
   */
  async pullFile(
    serial: string,
    remotePath: string,
    localPath: string
  ): Promise<{ success: boolean; filePath?: string; fileSize?: number; error?: string }> {
    try {
      const response = await $fetch<{ success: boolean; filePath?: string; fileSize?: number; error?: string }>(
        `${this.baseUrl}${this.apiPrefix}/devices/${serial}/files/pull`,
        {
          method: 'POST',
          headers: {
            'X-App-Namespace': 'pymatrix',
            'Content-Type': 'application/json'
          },
          body: {
            remotePath,
            localPath
          }
        }
      );

      return response;
    } catch (error) {
      console.error('[PyMatrixFileAPI] Pull file error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance
export const pyMatrixFileAPI = new PyMatrixFileAPI();
