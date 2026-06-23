/**
 * Image Decryptor - Frontend Image Decryption Library (TypeScript)
 *
 * Logic Pair: This file is the FRONTEND decryption logic.
 * Backend Pair: /scripts/_daemon_tools/image_encryptor.cjs
 *
 * Algorithm: XOR decryption (same as encryption)
 * - XOR encryption is symmetric: encrypt(data, key) = decrypt(data, key)
 * - Any password can decrypt, wrong password produces garbage
 * - Works with encrypted images from backend
 *
 * Usage:
 *   const decryptor = new ImageDecryptor({ password: 'yourpassword' });
 *   const imageBlob = await decryptor.decryptImage(encryptedBase64);
 *   const imageUrl = URL.createObjectURL(imageBlob);
 *
 * Password Sources (priority order):
 *   1. Constructor parameter: new ImageDecryptor({ password: 'xxx' })
 *   2. Default: Empty string '' (no hardcoded password)
 * 
 * Note: Password should be provided via React Context (PasswordContext)
 * for proper integration with React Router and URL parameters.
 */

export interface ImageDecryptorOptions {
  password?: string;
}

export class ImageDecryptor {
  private password: string;

  constructor(options: ImageDecryptorOptions = {}) {
    // Default password is empty string, must be provided via constructor or setPassword
    this.password = options.password ?? '';
  }

  /**
   * XOR decrypt data using password
   */
  private xorDecrypt(data: Uint8Array, password: string): Uint8Array {
    const passwordBytes = new TextEncoder().encode(password);
    const result = new Uint8Array(data.length);

    for (let i = 0; i < data.length; i++) {
      result[i] = data[i] ^ passwordBytes[i % passwordBytes.length];
    }

    return result;
  }

  /**
   * Convert base64 string to Uint8Array
   */
  private base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes;
  }

  /**
   * Decrypt encrypted base64 image data
   */
  async decryptImage(encryptedBase64: string, mimeType: string = 'image/png'): Promise<Blob> {
    const encryptedBytes = this.base64ToUint8Array(encryptedBase64);
    const decryptedBytes = this.xorDecrypt(encryptedBytes, this.password);

    // Create a new ArrayBuffer to ensure type compatibility with Blob
    const buffer = new ArrayBuffer(decryptedBytes.length);
    const view = new Uint8Array(buffer);
    view.set(decryptedBytes);
    return new Blob([buffer], { type: mimeType });
  }

  /**
   * Decrypt encrypted binary image data (ArrayBuffer)
   */
  async decryptBinaryImage(encryptedArrayBuffer: ArrayBuffer, mimeType: string = 'image/png'): Promise<Blob> {
    const encryptedBytes = new Uint8Array(encryptedArrayBuffer);
    const decryptedBytes = this.xorDecrypt(encryptedBytes, this.password);

    // Create a new ArrayBuffer to ensure type compatibility with Blob
    const buffer = new ArrayBuffer(decryptedBytes.length);
    const view = new Uint8Array(buffer);
    view.set(decryptedBytes);
    return new Blob([buffer], { type: mimeType });
  }

  /**
   * Load and decrypt binary file from path
   */
  async loadAndDecryptBinaryFile(filePath: string, extension: string = '.png'): Promise<Blob> {
    const response = await fetch(filePath);

    if (!response.ok) {
      throw new Error(`Failed to load encrypted file: ${filePath} (${response.status})`);
    }

    const encryptedData = await response.arrayBuffer();
    const mimeType = this.extensionToMimeType(extension);

    return await this.decryptBinaryImage(encryptedData, mimeType);
  }

  /**
   * Load and decrypt binary file, returning blob URL
   */
  async loadAndDecryptBinaryFileToURL(filePath: string, extension: string = '.png'): Promise<string> {
    const blob = await this.loadAndDecryptBinaryFile(filePath, extension);
    return URL.createObjectURL(blob);
  }

  /**
   * Decrypt image and return blob URL
   */
  async decryptImageToURL(encryptedBase64: string, mimeType: string = 'image/png'): Promise<string> {
    const blob = await this.decryptImage(encryptedBase64, mimeType);
    return URL.createObjectURL(blob);
  }

  /**
   * Decrypt image and set to img element (legacy support)
   */
  async decryptImageElement(
    imgElement: HTMLImageElement,
    encryptedBase64: string,
    extension: string = '.png'
  ): Promise<HTMLImageElement> {
    const mimeType = this.extensionToMimeType(extension);
    const imageUrl = await this.decryptImageToURL(encryptedBase64, mimeType);

    imgElement.src = imageUrl;

    imgElement.addEventListener(
      'load',
      () => {
        URL.revokeObjectURL(imageUrl);
      },
      { once: true }
    );

    return imgElement;
  }

  /**
   * Convert file extension to MIME type
   */
  extensionToMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
      '.ico': 'image/x-icon',
    };

    return mimeTypes[extension.toLowerCase()] || 'image/png';
  }

  /**
   * Decrypt from encrypted file module format
   */
  async decryptFromEncryptedFile(encryptedFileModule: {
    encrypted: string;
    metadata?: { extension?: string };
  }): Promise<string> {
    if (!encryptedFileModule.encrypted) {
      throw new Error('Invalid encrypted file module');
    }

    const mimeType = encryptedFileModule.metadata?.extension
      ? this.extensionToMimeType(encryptedFileModule.metadata.extension)
      : 'image/png';

    return await this.decryptImageToURL(encryptedFileModule.encrypted, mimeType);
  }

  /**
   * Set password for decryption
   */
  setPassword(newPassword: string): void {
    this.password = newPassword;
  }

  /**
   * Get current password
   */
  getPassword(): string {
    return this.password;
  }
}

