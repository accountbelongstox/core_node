/** One export lifecycle for image workbenches: produce a blob, download it, record a history-safe summary, localize failures. */
import { useCallback } from 'react';
import type { ToolDefinition } from '@/apps/laravel-manager/types';
import { useToolRun } from '../toolRunner';
import { useMediaT } from './MediaKit';
import { ImageTooLargeError } from './imageOps';
import { downloadBlob } from './mediaFormat';

export interface ImageRunSummary {
  fileName: string;
  width: number;
  height: number;
  bytes: number;
}

export interface ExportProduct {
  blob: Blob;
  fileName: string;
  width: number;
  height: number;
}

export const imageErrorCode = (err: unknown): string => {
  if (err instanceof ImageTooLargeError) return 'too_large';
  if (err instanceof Error && err.message === 'canvas_unsupported') return 'canvas_unsupported';
  return 'export_failed';
};

export const useImageExport = (tool: ToolDefinition, variant: string) => {
  const m = useMediaT();
  const { run, error, running } = useToolRun<ImageRunSummary>(tool.id, variant);
  const exportFile = useCallback((input: unknown, produce: () => Promise<ExportProduct>) => run(input, async () => {
    try {
      const product = await produce();
      downloadBlob(product.blob, product.fileName);
      return { fileName: product.fileName, width: product.width, height: product.height, bytes: product.blob.size };
    } catch (err) {
      throw new Error(m(`errors.${imageErrorCode(err)}`));
    }
  }), [run, m]);
  return { exportFile, error, running };
};
