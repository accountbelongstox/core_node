/** MIME type table (extension to type), grouping and magic-byte sniffing. */

export type MimeGroup = 'text' | 'image' | 'audio' | 'video' | 'font' | 'document' | 'archive' | 'data' | 'code' | 'binary';

export interface MimeEntry {
  ext: string;
  mime: string;
  group: MimeGroup;
}

export const MIME_GROUPS: MimeGroup[] = ['text', 'image', 'audio', 'video', 'font', 'document', 'archive', 'data', 'code', 'binary'];

const RAW = `txt text/plain|log text/plain|conf text/plain|html text/html|htm text/html|css text/css|csv text/csv|tsv text/tab-separated-values|md text/markdown|markdown text/markdown|ics text/calendar|vcf text/vcard|vtt text/vtt|srt application/x-subrip|
js text/javascript|mjs text/javascript|jsx text/jsx|ts video/mp2t|php application/x-httpd-php|sh application/x-sh|py text/x-python|java text/x-java-source|c text/x-c|cpp text/x-c++src|go text/x-go|rs text/rust|sql application/sql|graphql application/graphql|wasm application/wasm|
json application/json|map application/json|jsonld application/ld+json|ndjson application/x-ndjson|geojson application/geo+json|webmanifest application/manifest+json|ipynb application/x-ipynb+json|xml application/xml|xhtml application/xhtml+xml|rss application/rss+xml|atom application/atom+xml|kml application/vnd.google-earth.kml+xml|gpx application/gpx+xml|yaml application/yaml|yml application/yaml|toml application/toml|
png image/png|apng image/apng|jpg image/jpeg|jpeg image/jpeg|gif image/gif|webp image/webp|avif image/avif|bmp image/bmp|ico image/vnd.microsoft.icon|tif image/tiff|tiff image/tiff|svg image/svg+xml|heic image/heic|heif image/heif|jxl image/jxl|psd image/vnd.adobe.photoshop|
mp3 audio/mpeg|wav audio/wav|ogg audio/ogg|oga audio/ogg|opus audio/opus|flac audio/flac|aac audio/aac|m4a audio/mp4|weba audio/webm|mid audio/midi|midi audio/midi|aiff audio/aiff|wma audio/x-ms-wma|amr audio/amr|
mp4 video/mp4|m4v video/x-m4v|webm video/webm|ogv video/ogg|mov video/quicktime|avi video/x-msvideo|mkv video/x-matroska|wmv video/x-ms-wmv|flv video/x-flv|mpeg video/mpeg|mpg video/mpeg|3gp video/3gpp|3g2 video/3gpp2|m3u8 application/vnd.apple.mpegurl|mpd application/dash+xml|
woff font/woff|woff2 font/woff2|ttf font/ttf|otf font/otf|ttc font/collection|eot application/vnd.ms-fontobject|
pdf application/pdf|doc application/msword|docx application/vnd.openxmlformats-officedocument.wordprocessingml.document|xls application/vnd.ms-excel|xlsx application/vnd.openxmlformats-officedocument.spreadsheetml.sheet|ppt application/vnd.ms-powerpoint|pptx application/vnd.openxmlformats-officedocument.presentationml.presentation|odt application/vnd.oasis.opendocument.text|ods application/vnd.oasis.opendocument.spreadsheet|odp application/vnd.oasis.opendocument.presentation|rtf application/rtf|epub application/epub+zip|mobi application/x-mobipocket-ebook|azw application/vnd.amazon.ebook|vsd application/vnd.visio|ai application/postscript|eps application/postscript|ps application/postscript|
zip application/zip|gz application/gzip|tgz application/gzip|tar application/x-tar|bz2 application/x-bzip2|xz application/x-xz|7z application/x-7z-compressed|rar application/vnd.rar|zst application/zstd|jar application/java-archive|apk application/vnd.android.package-archive|deb application/vnd.debian.binary-package|rpm application/x-rpm|dmg application/x-apple-diskimage|iso application/x-iso9660-image|
exe application/vnd.microsoft.portable-executable|msi application/x-msdownload|dll application/x-msdownload|bin application/octet-stream|swf application/x-shockwave-flash|torrent application/x-bittorrent|sqlite application/vnd.sqlite3|pem application/x-pem-file|crt application/x-x509-ca-cert|p12 application/x-pkcs12`;

const DATA_TYPES = /(json|xml|yaml|toml|graphql|sql|geo|gpx|kml|ndjson|manifest)/;
const CODE_TYPES = /(javascript|x-sh|x-httpd-php|wasm|x-python|java-source|x-c|rust|x-go|jsx)/;
const ARCHIVE_TYPES = /(zip|gzip|x-tar|bzip2|x-xz|7z|rar|zstd|java-archive|android|debian|x-rpm|apple-diskimage|iso9660)/;
const DOCUMENT_TYPES = /(pdf|msword|officedocument|vnd\.ms-(excel|powerpoint)|opendocument|rtf|epub|mobipocket|amazon|visio|postscript)/;

export const mimeGroupOf = (mime: string): MimeGroup => {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/') || /mpegurl|dash\+xml|shockwave/.test(mime)) return 'video';
  if (mime.startsWith('font/') || mime.includes('fontobject')) return 'font';
  if (ARCHIVE_TYPES.test(mime)) return 'archive';
  if (DOCUMENT_TYPES.test(mime)) return 'document';
  if (CODE_TYPES.test(mime)) return 'code';
  if (DATA_TYPES.test(mime)) return 'data';
  if (mime.startsWith('text/')) return 'text';
  return 'binary';
};

export const MIME_ENTRIES: MimeEntry[] = RAW.split('|').map((pair) => pair.trim()).filter(Boolean).map((pair) => {
  const [ext, mime] = pair.split(' ');
  return { ext, mime, group: mimeGroupOf(mime) };
});

export const isTextMime = (mime: string): boolean => mime.startsWith('text/') || /(json|xml|javascript|yaml|toml|graphql|sql|x-sh|php|x-subrip)/.test(mime);

export interface MimeTypeGroup {
  mime: string;
  group: MimeGroup;
  extensions: string[];
}

export const groupByMime = (entries: MimeEntry[]): MimeTypeGroup[] => {
  const map = new Map<string, MimeTypeGroup>();
  entries.forEach((entry) => {
    const existing = map.get(entry.mime);
    if (existing) existing.extensions.push(entry.ext);
    else map.set(entry.mime, { mime: entry.mime, group: entry.group, extensions: [entry.ext] });
  });
  return Array.from(map.values());
};

const SIGNATURES: Array<{ mime: string; bytes: Array<number | null>; offset?: number }> = [
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50] },
  { mime: 'audio/wav', bytes: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x41, 0x56, 0x45] },
  { mime: 'image/bmp', bytes: [0x42, 0x4d] },
  { mime: 'image/vnd.microsoft.icon', bytes: [0x00, 0x00, 0x01, 0x00] },
  { mime: 'image/tiff', bytes: [0x49, 0x49, 0x2a, 0x00] },
  { mime: 'image/tiff', bytes: [0x4d, 0x4d, 0x00, 0x2a] },
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'application/zip', bytes: [0x50, 0x4b, 0x03, 0x04] },
  { mime: 'application/gzip', bytes: [0x1f, 0x8b] },
  { mime: 'application/x-7z-compressed', bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] },
  { mime: 'application/vnd.rar', bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07] },
  { mime: 'application/zstd', bytes: [0x28, 0xb5, 0x2f, 0xfd] },
  { mime: 'application/x-bzip2', bytes: [0x42, 0x5a, 0x68] },
  { mime: 'audio/mpeg', bytes: [0x49, 0x44, 0x33] },
  { mime: 'audio/ogg', bytes: [0x4f, 0x67, 0x67, 0x53] },
  { mime: 'audio/flac', bytes: [0x66, 0x4c, 0x61, 0x43] },
  { mime: 'video/mp4', bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  { mime: 'video/webm', bytes: [0x1a, 0x45, 0xdf, 0xa3] },
  { mime: 'font/woff', bytes: [0x77, 0x4f, 0x46, 0x46] },
  { mime: 'font/woff2', bytes: [0x77, 0x4f, 0x46, 0x32] },
  { mime: 'application/wasm', bytes: [0x00, 0x61, 0x73, 0x6d] },
  { mime: 'application/vnd.sqlite3', bytes: [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66] },
  { mime: 'application/x-elf', bytes: [0x7f, 0x45, 0x4c, 0x46] },
  { mime: 'application/vnd.microsoft.portable-executable', bytes: [0x4d, 0x5a] },
  { mime: 'application/xml', bytes: [0x3c, 0x3f, 0x78, 0x6d, 0x6c] },
];

/** Identifies a file by its leading bytes; returns null when no signature matches. */
export const sniffMime = (head: Uint8Array): string | null => {
  const hit = SIGNATURES.find((sig) => sig.bytes.every((byte, i) => byte === null || head[(sig.offset ?? 0) + i] === byte));
  if (hit) return hit.mime;
  const sample = head.subarray(0, 512);
  return sample.length > 0 && sample.every((byte) => byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte < 127) || byte >= 128) ? 'text/plain' : null;
};
