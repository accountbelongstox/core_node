// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

export interface VideoCompressionOptions {
  mode: 'extreme' | 'target-size' | 'target-percentage';
  targetSize: number; // MB
  targetPercentage: number; // %
  maxResolution: string; // 480p, 720p, 1080p
  quality: number; // 0-100
  format: 'mp4' | 'webm' | 'avi';
}

export interface VideoCompressionResult {
  id: string;
  originalName: string;
  originalSize: number;
  compressedSize: number;
  downloadUrl: string;
  compressionRatio: number;
  duration: number;
  resolution: string;
  success: boolean;
  error?: string;
}

export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  bitrate: number;
  fps: number;
}

export class VideoCompressionService {
  private static instance: VideoCompressionService;
  private ws: WebSocket | null = null;
  
  public static getInstance(): VideoCompressionService {
    if (!VideoCompressionService.instance) {
      VideoCompressionService.instance = new VideoCompressionService();
    }
    return VideoCompressionService.instance;
  }

  private connectWebSocket(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/video-compression`;
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected for video compression');
        resolve(this.ws!);
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(new Error('Failed to connect to compression server'));
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
      };
    });
  }

  private getResolutionDimensions(resolution: string): { width: number; height: number } {
    switch (resolution) {
      case '480p':
        return { width: 854, height: 480 };
      case '720p':
        return { width: 1280, height: 720 };
      case '1080p':
        return { width: 1920, height: 1080 };
      default:
        return { width: 1280, height: 720 };
    }
  }

  private async getVideoInfo(file: File): Promise<VideoInfo> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        const duration = video.duration;
        const width = video.videoWidth;
        const height = video.videoHeight;
        
        // Estimate bitrate (rough calculation)
        const bitrate = (file.size * 8) / duration; // bits per second
        const fps = 30; // Default assumption
        
        resolve({
          duration,
          width,
          height,
          bitrate,
          fps
        });
      };
      
      video.onerror = () => {
        reject(new Error('Failed to load video metadata'));
      };
      
      video.src = URL.createObjectURL(file);
    });
  }

  private calculateCompressionSettings(
    videoInfo: VideoInfo,
    options: VideoCompressionOptions
  ): {
    width: number;
    height: number;
    bitrate: number;
    quality: number;
  } {
    const { width: maxWidth, height: maxHeight } = this.getResolutionDimensions(options.maxResolution);
    
    // Calculate new dimensions maintaining aspect ratio
    let { width, height } = videoInfo;
    const aspectRatio = width / height;
    
    if (width > maxWidth || height > maxHeight) {
      if (width > maxWidth) {
        width = maxWidth;
        height = width / aspectRatio;
      }
      if (height > maxHeight) {
        height = maxHeight;
        width = height * aspectRatio;
      }
    }
    
    // Calculate target bitrate based on compression mode
    let targetBitrate: number;
    
    switch (options.mode) {
      case 'extreme':
        targetBitrate = videoInfo.bitrate * 0.1; // 10% of original
        break;
      case 'target-size':
        const targetBytes = options.targetSize * 1024 * 1024;
        targetBitrate = (targetBytes * 8) / videoInfo.duration;
        break;
      case 'target-percentage':
        targetBitrate = videoInfo.bitrate * (options.targetPercentage / 100);
        break;
      default:
        targetBitrate = videoInfo.bitrate * 0.5; // 50% of original
    }
    
    return {
      width: Math.round(width),
      height: Math.round(height),
      bitrate: Math.round(targetBitrate),
      quality: options.quality
    };
  }

  public async compressVideo(
    file: File,
    options: VideoCompressionOptions,
    onProgress?: (progress: number) => void
  ): Promise<VideoCompressionResult> {
    try {
      // Get video information
      const videoInfo = await this.getVideoInfo(file);
      
      // Calculate compression settings
      const settings = this.calculateCompressionSettings(videoInfo, options);
      
      // Connect to WebSocket for progress updates
      const ws = await this.connectWebSocket();
      
      return new Promise((resolve, reject) => {
        const compressionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        
        // Send compression request
        ws.send(JSON.stringify({
          type: 'start_compression',
          id: compressionId,
          fileName: file.name,
          fileSize: file.size,
          settings,
          options
        }));
        
        // Handle progress updates
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          if (data.id === compressionId) {
            if (data.type === 'progress') {
              onProgress?.(data.progress);
            } else if (data.type === 'complete') {
              const result: VideoCompressionResult = {
                id: compressionId,
                originalName: file.name,
                originalSize: file.size,
                compressedSize: data.compressedSize,
                downloadUrl: data.downloadUrl,
                compressionRatio: ((file.size - data.compressedSize) / file.size) * 100,
                duration: videoInfo.duration,
                resolution: `${settings.width}x${settings.height}`,
                success: true
              };
              resolve(result);
            } else if (data.type === 'error') {
              reject(new Error(data.error));
            }
          }
        };
        
        // Handle WebSocket errors
        ws.onerror = () => {
          reject(new Error('WebSocket connection failed'));
        };
        
        // Upload file
        const formData = new FormData();
        formData.append('video', file);
        formData.append('compressionId', compressionId);
        
        fetch('/api/video-compression/upload', {
          method: 'POST',
          body: formData
        }).catch(error => {
          reject(new Error('Failed to upload video: ' + error.message));
        });
      });
    } catch (error) {
      return {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        originalName: file.name,
        originalSize: file.size,
        compressedSize: 0,
        downloadUrl: '',
        compressionRatio: 0,
        duration: 0,
        resolution: '',
        success: false,
        error: (error as Error).message
      };
    }
  }

  public async compressMultipleVideos(
    files: File[],
    options: VideoCompressionOptions,
    onProgress?: (current: number, total: number, fileProgress: number) => void
  ): Promise<VideoCompressionResult[]> {
    const results: VideoCompressionResult[] = [];
    
    for (let i = 0; i < files.length; i++) {
      try {
        const result = await this.compressVideo(files[i], options, (progress) => {
          onProgress?.(i + 1, files.length, progress);
        });
        results.push(result);
      } catch (error) {
        results.push({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          originalName: files[i].name,
          originalSize: files[i].size,
          compressedSize: 0,
          downloadUrl: '',
          compressionRatio: 0,
          duration: 0,
          resolution: '',
          success: false,
          error: (error as Error).message
        });
      }
    }
    
    return results;
  }

  public formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  public validateFile(file: File): boolean {
    const validTypes = [
      'video/mp4',
      'video/webm',
      'video/avi',
      'video/mov',
      'video/wmv',
      'video/flv',
      'video/mkv'
    ];
    return validTypes.includes(file.type);
  }

  public getDefaultOptions(): VideoCompressionOptions {
    return {
      mode: 'extreme',
      targetSize: 50,
      targetPercentage: 50,
      maxResolution: '720p',
      quality: 80,
      format: 'mp4'
    };
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const videoCompressionService = VideoCompressionService.getInstance(); 