/** Web workbench registry. */
import { lazy } from 'react';
import type { ToolWorkbenchMap } from '../toolWorkbenchTypes';

export const WEB_WORKBENCHES: ToolWorkbenchMap = {
  jsonFormatter: lazy(() => import('./JsonFormatterWorkbench')),
  qrCodeGenerator: lazy(() => import('./QrCodeGeneratorWorkbench')),
  jsonDiff: lazy(() => import('./JsonDiffWorkbench')),
  jwtParser: lazy(() => import('./JwtParserWorkbench')),
  htmlEncoder: lazy(() => import('./HtmlEncoderWorkbench')),
  markdownToHtml: lazy(() => import('./MarkdownToHtmlWorkbench')),
  sqlFormatter: lazy(() => import('./SqlFormatterWorkbench')),
  yamlFormatter: lazy(() => import('./YamlFormatterWorkbench')),
  xmlFormatter: lazy(() => import('./XmlFormatterWorkbench')),
  httpStatusLookup: lazy(() => import('./HttpStatusLookupWorkbench')),
  mimeTypeLookup: lazy(() => import('./MimeTypeLookupWorkbench')),
  metaTagGenerator: lazy(() => import('./MetaTagGeneratorWorkbench')),
  svgOptimizer: lazy(() => import('./SvgOptimizerWorkbench')),
  wifiQrCode: lazy(() => import('./WifiQrCodeWorkbench')),
};
