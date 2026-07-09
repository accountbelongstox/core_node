/**
 * Shared utilities for network capture tools (debugger and webRequest paths).
 *
 * Consolidates filter lists and header analysis to ensure both capture backends
 * produce consistent results for the same network traffic.
 */

// Static resource file extensions (comprehensive list)
export const STATIC_RESOURCE_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.bmp',
  '.webp',
  '.svg',
  '.ico',
  '.cur',
  '.css',
  '.scss',
  '.less',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
  '.mp3',
  '.mp4',
  '.avi',
  '.mov',
  '.wmv',
  '.flv',
  '.webm',
  '.ogg',
  '.wav',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.zip',
  '.rar',
  '.7z',
  '.iso',
  '.dmg',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.map',
];

// Ad and analytics domains (comprehensive list from debugger path)
export const AD_ANALYTICS_DOMAINS = [
  'google-analytics.com',
  'googletagmanager.com',
  'analytics.google.com',
  'doubleclick.net',
  'googlesyndication.com',
  'googleads.g.doubleclick.net',
  'facebook.com/tr',
  'connect.facebook.net',
  'bat.bing.com',
  'linkedin.com',
  'analytics.twitter.com',
  'static.hotjar.com',
  'script.hotjar.com',
  'stats.g.doubleclick.net',
  'amazon-adsystem.com',
  'adservice.google.com',
  'pagead2.googlesyndication.com',
  'ads-twitter.com',
  'ads.yahoo.com',
  'adroll.com',
  'adnxs.com',
  'criteo.com',
  'quantserve.com',
  'scorecardresearch.com',
  'segment.io',
  'amplitude.com',
  'mixpanel.com',
  'optimizely.com',
  'crazyegg.com',
  'clicktale.net',
  'mouseflow.com',
  'fullstory.com',
  'clarity.ms',
];

// Static resource MIME types (for filtering when includeStatic is false)
export const STATIC_MIME_TYPES_TO_FILTER = [
  'image/',
  'font/',
  'audio/',
  'video/',
  'text/css',
  'text/javascript',
  'application/javascript',
  'application/x-javascript',
  'application/pdf',
  'application/zip',
  'application/octet-stream',
];

// API MIME types (never filtered, bodies captured)
export const API_MIME_TYPES = [
  'application/json',
  'application/xml',
  'text/xml',
  'text/plain',
  'application/x-www-form-urlencoded',
  'application/graphql',
  'application/grpc',
  'application/protobuf',
  'application/x-protobuf',
  'application/x-json',
  'application/ld+json',
  'application/problem+json',
  'application/problem+xml',
  'application/soap+xml',
  'application/vnd.api+json',
];

// Explicit reason a capture was stopped, surfaced as `stoppedBy` in the result.
export type StopReason = 'max_capture_time' | 'inactivity_timeout' | 'user_request';

/**
 * Check if a URL should be filtered (ad/analytics domain).
 * Entries may be path-qualified (e.g. 'facebook.com/tr'): a bare hostname is
 * matched against the hostname only, while a path-qualified entry is matched
 * against hostname+pathname so the path component can actually take effect.
 */
export function shouldFilterRequestByUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    if (
      AD_ANALYTICS_DOMAINS.some((domain) => {
        if (domain.includes('/')) {
          return (urlObj.hostname + urlObj.pathname).includes(domain);
        }
        return urlObj.hostname.includes(domain);
      })
    ) {
      return true;
    }
    return false;
  } catch (e) {
    console.error(`NetworkCapture: Error parsing URL for filtering: ${url}`, e);
    return false;
  }
}

/**
 * Check if a URL should be filtered by file extension (when includeStatic is false).
 */
export function shouldFilterRequestByExtension(url: string, includeStatic: boolean): boolean {
  if (includeStatic) return false;

  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.toLowerCase();
    if (STATIC_RESOURCE_EXTENSIONS.some((ext) => path.endsWith(ext))) {
      return true;
    }
    return false;
  } catch (e) {
    console.error(`NetworkCapture: Error parsing URL for extension filtering: ${url}`, e);
    return false;
  }
}

/**
 * Check if a response should be filtered by MIME type (when includeStatic is false).
 * API MIME types are never filtered.
 */
export function shouldFilterByMimeType(mimeType: string, includeStatic: boolean): boolean {
  if (!mimeType) return false;

  // API types are never filtered
  if (API_MIME_TYPES.some((apiMime) => mimeType.startsWith(apiMime))) {
    return false;
  }

  if (!includeStatic) {
    if (STATIC_MIME_TYPES_TO_FILTER.some((staticMime) => mimeType.startsWith(staticMime))) {
      return true;
    }

    // Filter text/* responses (except those in API_MIME_TYPES, already handled above)
    if (mimeType.startsWith('text/')) {
      return true;
    }
  }

  return false;
}

/**
 * Analyze common headers across requests (case-insensitive name comparison).
 * Returns headers that appear in ALL requests with the same value.
 */
export function analyzeCommonHeaders(
  requests: Array<Record<string, any>>,
  headerTypeKey: 'requestHeaders' | 'responseHeaders',
): Record<string, string> {
  if (!requests || requests.length === 0) return {};

  const headerValueCounts = new Map<string, Map<string, number>>();
  let requestsWithHeadersCount = 0;

  for (const req of requests) {
    const headers = req[headerTypeKey] as Record<string, string> | undefined;
    if (headers && Object.keys(headers).length > 0) {
      requestsWithHeadersCount++;
      for (const name in headers) {
        const lowerName = name.toLowerCase();
        const value = headers[name];
        if (!headerValueCounts.has(lowerName)) {
          headerValueCounts.set(lowerName, new Map());
        }
        const values = headerValueCounts.get(lowerName)!;
        values.set(value, (values.get(value) || 0) + 1);
      }
    }
  }

  if (requestsWithHeadersCount === 0) return {};

  const commonHeaders: Record<string, string> = {};
  headerValueCounts.forEach((values, lowerName) => {
    values.forEach((count, value) => {
      if (count === requestsWithHeadersCount) {
        // Recover original casing from the first request that has this header
        let originalName = lowerName;
        for (const req of requests) {
          const hdrs = req[headerTypeKey] as Record<string, string> | undefined;
          if (hdrs) {
            const foundName = Object.keys(hdrs).find((k) => k.toLowerCase() === lowerName);
            if (foundName) {
              originalName = foundName;
              break;
            }
          }
        }
        commonHeaders[originalName] = value;
      }
    });
  });
  return commonHeaders;
}

/**
 * Filter out common headers from a request's headers (case-insensitive comparison).
 * Returns only headers that are not common or have different values.
 */
export function filterOutCommonHeaders(
  headers: Record<string, string>,
  commonHeaders: Record<string, string>,
): Record<string, string> {
  if (!headers || typeof headers !== 'object') return {};

  const specificHeaders: Record<string, string> = {};
  const commonHeadersLower: Record<string, string> = {};

  Object.keys(commonHeaders).forEach((commonName) => {
    commonHeadersLower[commonName.toLowerCase()] = commonHeaders[commonName];
  });

  Object.keys(headers).forEach((name) => {
    const lowerName = name.toLowerCase();
    if (
      !(lowerName in commonHeadersLower) ||
      headers[name] !== commonHeadersLower[lowerName]
    ) {
      specificHeaders[name] = headers[name];
    }
  });

  return specificHeaders;
}
