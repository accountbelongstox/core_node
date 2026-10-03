/** Convert workbench registry. */
import { lazy } from 'react';
import type { ToolWorkbenchMap } from '../toolWorkbenchTypes';

export const CONVERT_WORKBENCHES: ToolWorkbenchMap = {
  base64Converter: lazy(() => import('./Base64Workbench')),
  colorConverter: lazy(() => import('./ColorWorkbench')),
  urlEncoder: lazy(() => import('./UrlEncoderWorkbench')),
  caseConverter: lazy(() => import('./CaseConverterWorkbench')),
  slugGenerator: lazy(() => import('./SlugWorkbench')),
  jsonToYaml: lazy(() => import('./StructuredWorkbench')),
  jsonToCsv: lazy(() => import('./JsonCsvWorkbench')),
  baseConverter: lazy(() => import('./BaseConverterWorkbench')),
  romanToArabic: lazy(() => import('./RomanWorkbench')),
  textToBinary: lazy(() => import('./TextToBinaryWorkbench')),
  textToUnicode: lazy(() => import('./TextToUnicodeWorkbench')),
  textToNato: lazy(() => import('./NatoWorkbench')),
  listConverter: lazy(() => import('./ListConverterWorkbench')),
  dateTimeConverter: lazy(() => import('./DateTimeWorkbench')),
  base64FileEncoder: lazy(() => import('./Base64FileEncoderWorkbench')),
  base64FileDecoder: lazy(() => import('./Base64FileDecoderWorkbench')),
  textEncoder: lazy(() => import('./TextEncoderWorkbench')),
  temperatureConverter: lazy(() => import('./TemperatureWorkbench')),
};
