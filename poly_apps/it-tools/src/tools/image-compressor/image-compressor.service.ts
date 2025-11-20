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

import { ref } from 'vue';

export interface CompressionOptions {
  mode: 'extreme' | 'target-size' | 'target-percentage';
  targetSize: number; // KB
  targetPercentage: number; // %
  maxResolution: string; // 480p, 720p, 1080p, 2k, 4k
  quality: number; // 0-100
  format: 'original' | 'jpeg' | 'png' | 'webp';
}

export interface CompressionResult {
  id: string;
  originalName: string;
  originalSize: number;
  compressedSize: number;
  downloadUrl: string;
  compressionRatio: number;
  success: boolean;
  error?: string;
  originalFormat: string;
  compressedFormat: string;
}

export class ImageCompressionService {
  private static instance: ImageCompressionService;
  
  public static getInstance(): ImageCompressionService {
    if (!ImageCompressionService.instance) {
      ImageCompressionService.instance = new ImageCompressionService();
    }
    return ImageCompressionService.instance;
  }

  private getResolutionDimensions(resolution: string): { width: number; height: number } {
    switch (resolution) {
      case '480p':
        return { width: 854, height: 480 };
      case '720p':
        return { width: 1280, height: 720 };
      case '1080p':
        return { width: 1920, height: 1080 };
      case '2k':
        return { width: 2560, height: 1440 };
      case '4k':
        return { width: 3840, height: 2160 };
      default:
        return { width: 1920, height: 1080 };
    }
  }

  private getImageFormat(file: File): string {
    const extension = file.name.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'jpeg';
      case 'png':
        return 'png';
      case 'webp':
        return 'webp';
      default:
        return 'jpeg';
    }
  }

  private calculateCompressionSettings(
    originalSize: number,
    originalWidth: number,
    originalHeight: number,
    options: CompressionOptions,
    file: File
  ): {
    width: number;
    height: number;
    quality: number;
    format: string;
  } {
    const { width: maxWidth, height: maxHeight } = this.getResolutionDimensions(options.maxResolution);
    
    // Calculate new dimensions maintaining aspect ratio
    let { width, height } = { width: originalWidth, height: originalHeight };
    const aspectRatio = width / height;
    
    // Scale down high resolution images
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
    
    // Calculate quality based on compression mode
    let quality: number;
    
    switch (options.mode) {
      case 'extreme':
        quality = Math.max(10, options.quality - 30);
        break;
      case 'target-size':
        const targetBytes = options.targetSize * 1024;
        const sizeRatio = targetBytes / originalSize;
        quality = Math.max(10, Math.min(100, sizeRatio * options.quality));
        break;
      case 'target-percentage':
        quality = Math.max(10, options.quality * (options.targetPercentage / 100));
        break;
      default:
        quality = options.quality;
    }
    
    // Determine output format
    let format: string;
    if (options.format === 'original') {
      format = this.getImageFormat(file);
    } else {
      format = options.format;
    }
    
    return { width, height, quality, format };
  }

  public async compressImage(
    file: File, 
    options: CompressionOptions
  ): Promise<CompressionResult> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        try {
          const originalFormat = this.getImageFormat(file);
          const settings = this.calculateCompressionSettings(
            file.size,
            img.width,
            img.height,
            options,
            file
          );
          
          canvas.width = settings.width;
          canvas.height = settings.height;
          
          // Draw and compress
          ctx?.drawImage(img, 0, 0, settings.width, settings.height);
          
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedUrl = URL.createObjectURL(blob);
                const compressionRatio = ((file.size - blob.size) / file.size) * 100;
                
                resolve({
                  id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                  originalName: file.name,
                  originalSize: file.size,
                  compressedSize: blob.size,
                  downloadUrl: compressedUrl,
                  compressionRatio,
                  success: true,
                  originalFormat,
                  compressedFormat: settings.format
                });
              } else {
                reject(new Error('Failed to compress image'));
              }
            },
            `image/${settings.format}`,
            settings.quality / 100
          );
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  public async compressMultipleImages(
    files: File[], 
    options: CompressionOptions,
    onProgress?: (current: number, total: number) => void
  ): Promise<CompressionResult[]> {
    const results: CompressionResult[] = [];
    
    for (let i = 0; i < files.length; i++) {
      try {
        const result = await this.compressImage(files[i], options);
        results.push(result);
        
        if (onProgress) {
          onProgress(i + 1, files.length);
        }
      } catch (error) {
        results.push({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          originalName: files[i].name,
          originalSize: files[i].size,
          compressedSize: 0,
          downloadUrl: '',
          compressionRatio: 0,
          success: false,
          error: (error as Error).message,
          originalFormat: this.getImageFormat(files[i]),
          compressedFormat: 'unknown'
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
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    return validTypes.includes(file.type);
  }

  public getDefaultOptions(): CompressionOptions {
    return {
      mode: 'extreme',
      targetSize: 500, // 500KB
      targetPercentage: 50, // 50%
      maxResolution: '1080p',
      quality: 80,
      format: 'original'
    };
  }
}

export const imageCompressionService = ImageCompressionService.getInstance(); 