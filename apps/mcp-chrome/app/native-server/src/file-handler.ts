import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import * as dns from 'dns';
import * as net from 'net';
import fetch from 'node-fetch';

// Limits for the extension-driven chunked file read (Firefox upload path).
// Native messaging caps host -> extension messages at 1 MB, so raw chunks are
// clamped well below that to leave room for base64 expansion and JSON framing.
const MAX_READ_FILE_BYTES = 50 * 1024 * 1024;
const MAX_READ_CHUNK_BYTES = 512 * 1024;

// Block private/loopback/link-local ranges so a caller-supplied fileUrl cannot
// be aimed at internal services or cloud-metadata endpoints (SSRF). Every
// address a hostname resolves to is checked, so DNS-rebinding to an internal
// host is rejected too.
const SSRF_BLOCKLIST = (() => {
  const bl = new net.BlockList();
  bl.addSubnet('0.0.0.0', 8, 'ipv4');      // "this network"
  bl.addSubnet('10.0.0.0', 8, 'ipv4');     // private (RFC1918)
  bl.addSubnet('127.0.0.0', 8, 'ipv4');    // loopback
  bl.addSubnet('169.254.0.0', 16, 'ipv4'); // link-local / cloud metadata
  bl.addSubnet('172.16.0.0', 12, 'ipv4');  // private (RFC1918)
  bl.addSubnet('192.168.0.0', 16, 'ipv4'); // private (RFC1918)
  bl.addSubnet('100.64.0.0', 10, 'ipv4');  // CGNAT (RFC6598)
  bl.addSubnet('::1', 128, 'ipv6');        // loopback
  bl.addSubnet('fc00::', 7, 'ipv6');       // unique-local
  bl.addSubnet('fe80::', 10, 'ipv6');      // link-local
  return bl;
})();

/**
 * File handler for managing file uploads through the native messaging host
 */
export class FileHandler {
  private tempDir: string;

  constructor() {
    // Create a temp directory for file operations
    this.tempDir = path.join(os.tmpdir(), 'chrome-mcp-uploads');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Handle file preparation request from the extension
   */
  async handleFileRequest(request: any): Promise<any> {
    const { action, fileUrl, base64Data, fileName, filePath, offset, length } = request;

    try {
      switch (action) {
        case 'prepareFile':
          if (fileUrl) {
            return await this.downloadFile(fileUrl, fileName);
          } else if (base64Data) {
            return await this.saveBase64File(base64Data, fileName);
          } else if (filePath) {
            return await this.verifyFile(filePath);
          }
          break;

        case 'cleanupFile':
          return await this.cleanupFile(filePath);

        case 'readFileChunk':
          return await this.readFileChunk(filePath, offset, length);

        default:
          return {
            success: false,
            error: `Unknown file action: ${action}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Download a file from URL and save to temp directory
   */
  private async downloadFile(fileUrl: string, fileName?: string): Promise<any> {
    try {
      // Guard against SSRF: only http(s) and never private/loopback/link-local.
      await this.assertSafeFetchUrl(fileUrl);
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      // Generate filename if not provided
      const finalFileName = fileName || this.generateFileName(fileUrl);
      const filePath = this.safeTempPath(finalFileName);

      // Get the file buffer
      const buffer = await response.buffer();

      // Save to file
      fs.writeFileSync(filePath, buffer);

      return {
        success: true,
        filePath: filePath,
        fileName: path.basename(filePath),
        size: buffer.length,
      };
    } catch (error) {
      throw new Error(`Failed to download file from URL: ${error}`);
    }
  }

  /**
   * Save base64 data as a file
   */
  private async saveBase64File(base64Data: string, fileName?: string): Promise<any> {
    try {
      // Remove data URL prefix if present
      const base64Content = base64Data.replace(/^data:.*?;base64,/, '');

      // Convert base64 to buffer
      const buffer = Buffer.from(base64Content, 'base64');

      // Generate filename if not provided
      const finalFileName = fileName || `upload-${Date.now()}.bin`;
      const filePath = this.safeTempPath(finalFileName);

      // Save to file
      fs.writeFileSync(filePath, buffer);

      return {
        success: true,
        filePath: filePath,
        fileName: path.basename(filePath),
        size: buffer.length,
      };
    } catch (error) {
      throw new Error(`Failed to save base64 file: ${error}`);
    }
  }

  /**
   * Verify that a file exists and is accessible
   */
  private async verifyFile(filePath: string): Promise<any> {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File does not exist: ${filePath}`);
      }

      // Get file stats
      const stats = fs.statSync(filePath);

      // Check if it's actually a file
      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${filePath}`);
      }

      // Check if file is readable
      fs.accessSync(filePath, fs.constants.R_OK);

      return {
        success: true,
        filePath: filePath,
        fileName: path.basename(filePath),
        size: stats.size,
      };
    } catch (error) {
      throw new Error(`Failed to verify file: ${error}`);
    }
  }

  /**
   * Read a slice of a local file as base64 (Firefox upload path: the
   * extension pulls the file in chunks that fit the native messaging limit).
   */
  private async readFileChunk(filePath: string, offset?: number, length?: number): Promise<any> {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('filePath is required for readFileChunk');
    }

    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File does not exist: ${resolvedPath}`);
    }

    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${resolvedPath}`);
    }
    fs.accessSync(resolvedPath, fs.constants.R_OK);

    if (stats.size > MAX_READ_FILE_BYTES) {
      throw new Error(
        `File is too large: ${stats.size} bytes (limit ${MAX_READ_FILE_BYTES} bytes / 50 MB)`,
      );
    }

    const start = Math.max(0, Math.floor(Number(offset) || 0));
    const requested = Math.floor(Number(length) || MAX_READ_CHUNK_BYTES);
    const chunkLength = Math.min(Math.max(1, requested), MAX_READ_CHUNK_BYTES);
    const available = Math.max(0, stats.size - start);
    const buffer = Buffer.alloc(Math.min(chunkLength, available));

    let bytesRead = 0;
    if (buffer.length > 0) {
      const fd = fs.openSync(resolvedPath, 'r');
      try {
        bytesRead = fs.readSync(fd, buffer, 0, buffer.length, start);
      } finally {
        fs.closeSync(fd);
      }
    }

    return {
      success: true,
      filePath: resolvedPath,
      fileName: path.basename(resolvedPath),
      size: stats.size,
      offset: start,
      bytesRead: bytesRead,
      eof: start + bytesRead >= stats.size,
      base64Data: buffer.subarray(0, bytesRead).toString('base64'),
    };
  }

  /**
   * Clean up a temporary file
   */
  private async cleanupFile(filePath: string): Promise<any> {
    try {
      // Only allow cleanup of files in our temp directory. Resolve first so a
      // '../../' traversal string can't sneak past a raw startsWith() prefix
      // check (the string begins with the prefix while resolving outside it).
      const confined = this.resolveWithinDir(filePath, this.tempDir);
      if (!confined) {
        return {
          success: false,
          error: 'Can only cleanup files in temp directory',
        };
      }

      if (fs.existsSync(confined)) {
        fs.unlinkSync(confined);
      }

      return {
        success: true,
        message: 'File cleaned up successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to cleanup file: ${error}`,
      };
    }
  }

  /**
   * Resolve a candidate path and confirm it stays inside dir. A raw
   * startsWith(dir) check is bypassable because '../../' traversal strings
   * still begin with the dir prefix while resolving outside it. Returns the
   * normalized absolute path when confined, or null when the path escapes dir.
   */
  private resolveWithinDir(candidate: string, dir: string): string | null {
    const resolvedDir = path.resolve(dir);
    const resolvedCandidate = path.resolve(candidate);
    const rel = path.relative(resolvedDir, resolvedCandidate);
    if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
      return resolvedCandidate;
    }
    return null;
  }

  /**
   * Build a write path under tempDir from a caller-supplied name. Strips any
   * directory components (so '../' traversal cannot escape tempDir) and then
   * confirms the resolved result is still confined (defense in depth against
   * symlink/edge cases).
   */
  private safeTempPath(fileName: string): string {
    const base = path.basename(fileName) || `upload-${crypto.randomBytes(4).toString('hex')}.bin`;
    const confined = this.resolveWithinDir(path.join(this.tempDir, base), this.tempDir);
    if (!confined) {
      throw new Error('Resolved file path escapes the temp directory');
    }
    return confined;
  }

  /**
   * Reject fileUrl values aimed at internal/metadata endpoints (SSRF). Allows
   * only http(s) and blocks any host that resolves to a private, loopback, or
   * link-local address (including cloud-metadata 169.254.169.254).
   */
  private async assertSafeFetchUrl(fileUrl: string): Promise<void> {
    let parsed: URL;
    try {
      parsed = new URL(fileUrl);
    } catch {
      throw new Error(`Invalid file URL: ${fileUrl}`);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Unsupported URL scheme: ${parsed.protocol} (only http/https allowed)`);
    }
    const host = parsed.hostname;
    if (!host) {
      throw new Error('URL has no hostname');
    }
    // Resolve the hostname and reject if ANY address is non-public. Guards
    // against literal-IP SSRF (e.g. 169.254.169.254) and DNS-rebinding to an
    // internal host.
    const addresses = await dns.promises.lookup(host, { all: true });
    if (addresses.length === 0) {
      throw new Error(`Could not resolve host: ${host}`);
    }
    for (const { address, family } of addresses) {
      const fam = family === 6 ? 'ipv6' : 'ipv4';
      if (SSRF_BLOCKLIST.check(address, fam)) {
        throw new Error(`Refusing to fetch URL resolving to a non-public address: ${address}`);
      }
    }
  }

  /**
   * Generate a filename from URL or create a unique one
   */
  private generateFileName(url?: string): string {
    if (url) {
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const basename = path.basename(pathname);
        if (basename && basename !== '/') {
          // Add random suffix to avoid collisions
          const ext = path.extname(basename);
          const name = path.basename(basename, ext);
          const randomSuffix = crypto.randomBytes(4).toString('hex');
          return `${name}-${randomSuffix}${ext}`;
        }
      } catch {
        // Invalid URL, fall through to generate random name
      }
    }

    // Generate random filename
    return `upload-${crypto.randomBytes(8).toString('hex')}.bin`;
  }

  /**
   * Clean up old temporary files (older than 1 hour)
   */
  cleanupOldFiles(): void {
    try {
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;

      const files = fs.readdirSync(this.tempDir);
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > oneHour) {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up old temp file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up old files:', error);
    }
  }
}

export default new FileHandler();