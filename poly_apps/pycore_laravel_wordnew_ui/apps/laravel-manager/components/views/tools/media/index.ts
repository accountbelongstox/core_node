/** Media workbench registry. */
import { lazy } from 'react';
import type { ToolWorkbenchMap } from '../toolWorkbenchTypes';

export const MEDIA_WORKBENCHES: ToolWorkbenchMap = {
  imageRotator: lazy(() => import('./ImageRotatorWorkbench')),
  imageFlipper: lazy(() => import('./ImageFlipperWorkbench')),
  imageColorExtractor: lazy(() => import('./ImageColorExtractorWorkbench')),
  imageCropper: lazy(() => import('./ImageCropperWorkbench')),
  imageConverter: lazy(() => import('./ImageConverterWorkbench')),
  imageResizer: lazy(() => import('./ImageResizerWorkbench')),
  imageCompressor: lazy(() => import('./ImageCompressorWorkbench')),
  pdfSplitter: lazy(() => import('./PdfSplitterWorkbench')),
  pdfMerger: lazy(() => import('./PdfMergerWorkbench')),
  pdfCompressor: lazy(() => import('./PdfCompressorWorkbench')),
  pdfRotator: lazy(() => import('./PdfRotatorWorkbench')),
  pdfProtector: lazy(() => import('./PdfProtectorWorkbench')),
};
