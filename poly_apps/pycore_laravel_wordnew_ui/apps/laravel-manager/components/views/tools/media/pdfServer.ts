/** Server PDF job: sends the exact multipart fields via the tool's api method and decodes the base64 data-URL results. */
import i18n from '@/apps/laravel-manager/i18n';
import { callToolApi } from '../toolRunner';
import { isRecord } from './mediaFormat';
import { dataUrlToBlob } from './pdfOps';

export type PdfQuality = 'screen' | 'ebook' | 'printer' | 'prepress';

export interface PdfOutput {
  blob: Blob;
  pages: number | null;
  label: string;
}

const numberOrNull = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

const decodeOutput = (entry: unknown, label = ''): PdfOutput => {
  if (!isRecord(entry) || typeof entry.data !== 'string') throw new Error(i18n.t('toolsMedia.errors.invalid_response'));
  return { blob: dataUrlToBlob(entry.data), pages: numberOrNull(entry.page_count), label };
};

export const PDF_MISSING_PATTERN = /not installed|platform|501/i;

export const splitPdf = async (apiMethod: string, pdf: File, ranges: string[]): Promise<PdfOutput[]> => {
  const data = await callToolApi<unknown>(apiMethod, { pdf, ranges: JSON.stringify(ranges) });
  if (!isRecord(data) || !Array.isArray(data.files)) throw new Error(i18n.t('toolsMedia.errors.invalid_response'));
  return data.files.map((entry) => decodeOutput(entry, isRecord(entry) ? String(entry.pages ?? '') : ''));
};

export const mergePdfs = async (apiMethod: string, pdfs: File[]): Promise<PdfOutput> =>
  decodeOutput(await callToolApi<unknown>(apiMethod, { pdfs }));

export const compressPdf = async (apiMethod: string, pdf: File, quality: PdfQuality): Promise<PdfOutput> =>
  decodeOutput(await callToolApi<unknown>(apiMethod, { pdf, quality }));

export const rotatePdf = async (apiMethod: string, pdf: File, angle: number, pages?: number[]): Promise<PdfOutput> =>
  decodeOutput(await callToolApi<unknown>(apiMethod, { pdf, angle, pages }));

export const protectPdf = async (apiMethod: string, pdf: File, password: string): Promise<PdfOutput> =>
  decodeOutput(await callToolApi<unknown>(apiMethod, { pdf, password }));
