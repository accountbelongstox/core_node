import { getHttpBaseUrl } from '@/apps/app_pymatrix/utils_app_pymatrix/api-urls';

const APP_NAMESPACE = 'pymatrix';

export interface FilePushRequest {
  filePath: File | Blob | string;
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
  apkPath: File | Blob | string;
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
  progress: number;
  speed: number;
  estimatedTimeRemaining: number;
  status: 'uploading' | 'completed' | 'failed';
}

export interface ApkInstallProgress {
  serial: string;
  packageName: string;
  status: 'uploading' | 'installing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  error?: string;
}

export class PyMatrixFileAPI {
  private readonly baseUrl: string;
  private readonly apiPrefix = '/api';

  constructor() {
    this.baseUrl = getHttpBaseUrl();
  }

  private buildUrl(path: string) {
    return `${this.baseUrl}${this.apiPrefix}${path}`;
  }

  private formatError(message: string, error: unknown): string {
    console.error(`[PyMatrixFileAPI] ${message}`, error);
    return error instanceof Error ? error.message : 'Unknown error';
  }

  async pushFile(
    serial: string,
    request: FilePushRequest,
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<FilePushResponse> {
    try {
      const formData = new FormData();
      let fileSize = 0;
      let fileName = typeof request.filePath === 'string' ? request.filePath : 'file';

      if (request.filePath instanceof File || request.filePath instanceof Blob) {
        formData.append('file', request.filePath);
        fileSize = request.filePath.size ?? 0;
        fileName = request.filePath instanceof File ? request.filePath.name : fileName;
      } else {
        formData.append('filePath', request.filePath);
      }

      formData.append('targetPath', request.targetPath);
      if (typeof request.overwrite === 'boolean') {
        formData.append('overwrite', String(request.overwrite));
      }

      if (onProgress) {
        onProgress({
          serial,
          fileName,
          fileSize,
          uploadedBytes: 0,
          progress: 0,
          speed: 0,
          estimatedTimeRemaining: 0,
          status: 'uploading'
        });
      }

      const response = await $fetch<FilePushResponse>(
        this.buildUrl(`/devices/${serial}/files/push`),
        {
          method: 'POST',
          headers: {
            'X-App-Namespace': APP_NAMESPACE
          },
          body: formData
        }
      );

      if (onProgress) {
        onProgress({
          serial,
          fileName,
          fileSize,
          uploadedBytes: fileSize,
          progress: 100,
          speed: 0,
          estimatedTimeRemaining: 0,
          status: response.success ? 'completed' : 'failed'
        });
      }

      return response;
    } catch (error) {
      const errorMessage = this.formatError(`Failed to push file to ${serial}`, error);
      if (onProgress) {
        onProgress({
          serial,
          fileName: typeof request.filePath === 'string' ? request.filePath : 'file',
          fileSize: 0,
          uploadedBytes: 0,
          progress: 0,
          speed: 0,
          estimatedTimeRemaining: 0,
          status: 'failed'
        });
      }
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async installApk(
    serial: string,
    request: ApkInstallRequest,
    onProgress?: (progress: ApkInstallProgress) => void
  ): Promise<ApkInstallResponse> {
    try {
      const formData = new FormData();
      let packageName = '';

      if (request.apkPath instanceof File || request.apkPath instanceof Blob) {
        formData.append('apk', request.apkPath);
        packageName = request.apkPath instanceof File ? request.apkPath.name : '';
      } else {
        formData.append('apkPath', request.apkPath);
        packageName = request.apkPath;
      }

      formData.append('reinstall', String(Boolean(request.reinstall)));
      formData.append('grantPermissions', String(Boolean(request.grantPermissions)));

      if (onProgress) {
        onProgress({
          serial,
          packageName,
          status: 'uploading',
          progress: 10,
          message: 'Uploading APK'
        });
      }

      const response = await $fetch<ApkInstallResponse>(
        this.buildUrl(`/devices/${serial}/apk/install`),
        {
          method: 'POST',
          headers: {
            'X-App-Namespace': APP_NAMESPACE
          },
          body: formData
        }
      );

      if (onProgress) {
        onProgress({
          serial,
          packageName: response.packageName || packageName,
          status: response.success ? 'completed' : 'failed',
          progress: response.success ? 100 : 0,
          message: response.success ? 'Installation completed' : 'Installation failed',
          error: response.success ? undefined : response.error
        });
      }

      return response;
    } catch (error) {
      const errorMessage = this.formatError(`Failed to install APK on ${serial}`, error);
      if (onProgress) {
        onProgress({
          serial,
          packageName: '',
          status: 'failed',
          progress: 0,
          error: errorMessage
        });
      }
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async uninstallApp(serial: string, packageName: string): Promise<{ success: boolean; error?: string }> {
    try {
      return await $fetch<{ success: boolean; error?: string }>(
        this.buildUrl(`/devices/${serial}/apk/uninstall`),
        {
          method: 'POST',
          headers: {
            'X-App-Namespace': APP_NAMESPACE,
            'Content-Type': 'application/json'
          },
          body: { packageName }
        }
      );
    } catch (error) {
      return {
        success: false,
        error: this.formatError(`Failed to uninstall ${packageName} on ${serial}`, error)
      };
    }
  }

  async listPackages(
    serial: string,
    systemApps = false
  ): Promise<{ success: boolean; packages?: string[]; error?: string }> {
    try {
      return await $fetch<{ success: boolean; packages?: string[]; error?: string }>(
        this.buildUrl(`/devices/${serial}/packages`),
        {
          method: 'GET',
          headers: {
            'X-App-Namespace': APP_NAMESPACE
          },
          query: {
            system: systemApps
          }
        }
      );
    } catch (error) {
      return {
        success: false,
        error: this.formatError(`Failed to list packages for ${serial}`, error)
      };
    }
  }

  async pullFile(
    serial: string,
    remotePath: string,
    localPath: string
  ): Promise<{ success: boolean; filePath?: string; fileSize?: number; error?: string }> {
    try {
      return await $fetch<{ success: boolean; filePath?: string; fileSize?: number; error?: string }>(
        this.buildUrl(`/devices/${serial}/files/pull`),
        {
          method: 'POST',
          headers: {
            'X-App-Namespace': APP_NAMESPACE,
            'Content-Type': 'application/json'
          },
          body: {
            remotePath,
            localPath
          }
        }
      );
    } catch (error) {
      return {
        success: false,
        error: this.formatError(`Failed to pull file from ${serial}`, error)
      };
    }
  }
}

export const pyMatrixFileAPI = new PyMatrixFileAPI();
