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

export interface ArchiveOptions {
  format: 'zip' | 'tar' | '7z';
  filename: string;
  useTimestamp: boolean;
  compressImages: boolean;
  compressVideos: boolean;
  imageQuality: number;
  videoQuality: number;
}

export interface ArchiveFile {
  id: string;
  name: string;
  size: number;
  type: string;
  isImage: boolean;
  isVideo: boolean;
  compressedSize?: number;
  compressionRatio?: number;
}

export interface ArchiveResult {
  id: string;
  filename: string;
  size: number;
  downloadUrl: string;
  fileCount: number;
  success: boolean;
  error?: string;
}

export class ArchiveCreatorService {
  private static instance: ArchiveCreatorService;
  
  public static getInstance(): ArchiveCreatorService {
    if (!ArchiveCreatorService.instance) {
      ArchiveCreatorService.instance = new ArchiveCreatorService();
    }
    return ArchiveCreatorService.instance;
  }

  public formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  public validateFile(file: File): boolean {
    return file.size > 0 && file.size <= 100 * 1024 * 1024; // 100MB limit
  }

  public isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
  }

  public isVideoFile(file: File): boolean {
    return file.type.startsWith('video/');
  }

  public async compressImage(file: File, quality: number): Promise<File> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        try {
          // Calculate new dimensions maintaining aspect ratio
          let { width, height } = { width: img.width, height: img.height };
          const maxSize = 1920; // Max 1080p
          
          if (width > maxSize || height > maxSize) {
            const aspectRatio = width / height;
            if (width > height) {
              width = maxSize;
              height = width / aspectRatio;
            } else {
              height = maxSize;
              width = height * aspectRatio;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Try to compress with target quality, if still too large, reduce quality
          const compressWithQuality = (targetQuality: number) => {
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  // If file is still larger than 500KB and we can reduce quality further
                  if (blob.size > 500 * 1024 && targetQuality > 10) {
                    compressWithQuality(targetQuality - 10);
                  } else {
                    const compressedFile = new File([blob], file.name, {
                      type: file.type,
                      lastModified: Date.now()
                    });
                    resolve(compressedFile);
                  }
                } else {
                  reject(new Error('Failed to compress image'));
                }
              },
              file.type,
              targetQuality / 100
            );
          };
          
          compressWithQuality(quality);
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  public async createArchive(
    files: ArchiveFile[],
    options: ArchiveOptions,
    getFileById: (id: string) => File | null,
    onProgress?: (progress: number) => void
  ): Promise<ArchiveResult> {
    try {
      // Generate filename
      let filename = options.filename.trim();
      if (!filename) {
        filename = 'archive';
      }
      
      if (options.useTimestamp) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        filename = `${timestamp}_${filename}`;
      }
      
      // Add extension
      filename = `${filename}.${options.format}`;
      
      // Process files (compress images/videos if needed)
      const processedFiles: File[] = [];
      let processedCount = 0;
      
      for (const fileInfo of files) {
        const file = getFileById(fileInfo.id);
        if (!file) continue;
        
        let processedFile = file;
        
        // Compress images if enabled and file is image and larger than 500KB
        if (options.compressImages && fileInfo.isImage && file.size > 500 * 1024) {
          try {
            processedFile = await this.compressImage(file, options.imageQuality);
            // Update compression info
            const compressionRatio = ((file.size - processedFile.size) / file.size) * 100;
            fileInfo.compressedSize = processedFile.size;
            fileInfo.compressionRatio = compressionRatio;
          } catch (error) {
            console.warn('Failed to compress image:', file.name);
          }
        }
        
        // Note: Video compression would require backend processing
        // For now, we'll skip video compression in this client-side implementation
        
        processedFiles.push(processedFile);
        processedCount++;
        
        if (onProgress) {
          onProgress((processedCount / files.length) * 100);
        }
      }
      
      // Create archive using JSZip
      const JSZip = await import('jszip');
      const zip = new JSZip.default();
      
      // Add files to zip
      for (const file of processedFiles) {
        zip.file(file.name, file);
      }
      
      // Generate zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(zipBlob);
      
      return {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        filename,
        size: zipBlob.size,
        downloadUrl,
        fileCount: processedFiles.length,
        success: true
      };
      
    } catch (error) {
      return {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        filename: '',
        size: 0,
        downloadUrl: '',
        fileCount: 0,
        success: false,
        error: (error as Error).message
      };
    }
  }

  public getDefaultOptions(): ArchiveOptions {
    return {
      format: 'zip',
      filename: '',
      useTimestamp: true,
      compressImages: true,
      compressVideos: false, // Disabled for client-side implementation
      imageQuality: 80,
      videoQuality: 80
    };
  }
}

export const archiveCreatorService = ArchiveCreatorService.getInstance(); 