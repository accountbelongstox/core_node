/** Image transport: one digest-addressed frame as an object URL, released when replaced. */
import type { PycoreHttpBinaryResult, TerminalScreenshotResourceMeta } from '@/apps/pycore-manager/api';

const FETCH_TIMEOUT_MS = 20_000;
const HTTP_OK = 200;
const DEFAULT_MIME = 'image/webp';

export interface TerminalImageFrame {
  url: string;
  mime: string;
  width: number;
  height: number;
  captured_at: number;
  digest: string;
}

export type FetchTerminalImage = (windowId: string, digest: string, timeoutMs: number) => Promise<PycoreHttpBinaryResult>;

export class TerminalImageTransport {
  constructor(private readonly fetchImage: FetchTerminalImage) {}

  async load(windowId: string, meta: TerminalScreenshotResourceMeta): Promise<TerminalImageFrame | null> {
    const result = await this.fetchImage(windowId, meta.digest, FETCH_TIMEOUT_MS);
    if (result.status !== HTTP_OK || !result.bytes) return null;
    const mime = meta.mime || DEFAULT_MIME;
    return {
      url: URL.createObjectURL(new Blob([new Uint8Array(result.bytes)], { type: mime })),
      mime,
      width: meta.width,
      height: meta.height,
      captured_at: meta.captured_at,
      digest: meta.digest,
    };
  }

  release(frame: TerminalImageFrame | undefined): void {
    if (frame) URL.revokeObjectURL(frame.url);
  }
}
