import { BaseAPI } from '../base/BaseAPI';
import { APIResponse } from '../../types';

/**
 * ItToolsV1 API Module
 * IT开发工具集API - 100+工具
 */
export class ItToolsV1API extends BaseAPI {
  // ========== Unified API (统一接口) ==========
  async encode(data: { type: string; input: string }): Promise<APIResponse> {
    return this.post('/unified/encode', data);
  }

  async decode(data: { type: string; input: string }): Promise<APIResponse> {
    return this.post('/unified/decode', data);
  }

  async hash(data: { algorithm: string; input: string }): Promise<APIResponse> {
    return this.post('/unified/hash', data);
  }

  async hmac(data: { algorithm: string; input: string; key: string }): Promise<APIResponse> {
    return this.post('/unified/hmac', data);
  }

  async generateUuid(data?: { version?: number }): Promise<APIResponse> {
    return this.post('/unified/uuid', data || {});
  }

  async generateToken(data: { length?: number }): Promise<APIResponse> {
    return this.post('/unified/token', data);
  }

  async convertCase(data: { text: string; case: string }): Promise<APIResponse> {
    return this.post('/unified/case', data);
  }

  async slugify(data: { text: string }): Promise<APIResponse> {
    return this.post('/unified/slugify', data);
  }

  async convertColor(data: { color: string; from: string; to: string }): Promise<APIResponse> {
    return this.post('/unified/color', data);
  }

  async analyzePassword(data: { password: string }): Promise<APIResponse> {
    return this.post('/unified/password-analyze', data);
  }

  async generateBasicAuth(data: { username: string; password: string }): Promise<APIResponse> {
    return this.post('/unified/basic-auth', data);
  }

  // ========== Crypto & Security (加密安全) ==========
  async hashText(data: { text: string; algorithm: string }): Promise<APIResponse> {
    return this.post('/crypto/hash', data);
  }

  async bcryptHash(data: { text: string; rounds?: number }): Promise<APIResponse> {
    return this.post('/crypto/bcrypt/hash', data);
  }

  async bcryptVerify(data: { text: string; hash: string }): Promise<APIResponse> {
    return this.post('/crypto/bcrypt/verify', data);
  }

  async generateCryptoUuid(data?: { version?: number }): Promise<APIResponse> {
    return this.post('/crypto/uuid/generate', data || {});
  }

  async generateUlid(): Promise<APIResponse> {
    return this.post('/crypto/ulid/generate');
  }

  async generateCryptoToken(data: { length?: number }): Promise<APIResponse> {
    return this.post('/crypto/token/generate', data);
  }

  async generateRsaKeyPair(data: { bits?: number }): Promise<APIResponse> {
    return this.post('/crypto/rsa/generate', data);
  }

  async generateBip39(data: { words?: number }): Promise<APIResponse> {
    return this.post('/crypto/bip39/generate', data);
  }

  async generateOtp(data: { secret?: string }): Promise<APIResponse> {
    return this.post('/crypto/otp/generate', data);
  }

  async verifyOtp(data: { secret: string; token: string }): Promise<APIResponse> {
    return this.post('/crypto/otp/verify', data);
  }

  async encrypt(data: { text: string; key: string; algorithm?: string }): Promise<APIResponse> {
    return this.post('/crypto/encrypt', data);
  }

  async decrypt(data: { text: string; key: string; algorithm?: string }): Promise<APIResponse> {
    return this.post('/crypto/decrypt', data);
  }

  // ========== Converter (转换工具) ==========
  async base64Encode(data: { text: string }): Promise<APIResponse> {
    return this.post('/converter/base64/encode', data);
  }

  async base64Decode(data: { text: string }): Promise<APIResponse> {
    return this.post('/converter/base64/decode', data);
  }

  async base64FileEncode(data: { file: File }): Promise<APIResponse> {
    const formData = new FormData();
    formData.append('file', data.file);
    return this.request({ url: '/converter/base64/file/encode', method: 'POST', data: formData } as any);
  }

  async base64FileDecode(data: { base64: string; filename: string }): Promise<APIResponse> {
    return this.post('/converter/base64/file/decode', data);
  }

  async urlEncode(data: { text: string }): Promise<APIResponse> {
    return this.post('/converter/url/encode', data);
  }

  async urlDecode(data: { text: string }): Promise<APIResponse> {
    return this.post('/converter/url/decode', data);
  }

  async convertColorConverter(data: { color: string; from: string; to: string }): Promise<APIResponse> {
    return this.post('/converter/color', data);
  }

  async convertBase(data: { number: string; from: number; to: number }): Promise<APIResponse> {
    return this.post('/converter/base', data);
  }

  async slugifyText(data: { text: string }): Promise<APIResponse> {
    return this.post('/converter/slugify', data);
  }

  async jsonToYaml(data: { json: string }): Promise<APIResponse> {
    return this.post('/converter/json-to-yaml', data);
  }

  async yamlToJson(data: { yaml: string }): Promise<APIResponse> {
    return this.post('/converter/yaml-to-json', data);
  }

  async jsonToCsv(data: { json: string }): Promise<APIResponse> {
    return this.post('/converter/json-to-csv', data);
  }

  async jsonToXml(data: { json: string }): Promise<APIResponse> {
    return this.post('/converter/json-to-xml', data);
  }

  async xmlToJson(data: { xml: string }): Promise<APIResponse> {
    return this.post('/converter/xml-to-json', data);
  }

  async convertTemperature(data: { value: number; from: string; to: string }): Promise<APIResponse> {
    return this.post('/converter/temperature', data);
  }

  async convertDateTime(data: { datetime: string; from?: string; to?: string }): Promise<APIResponse> {
    return this.post('/converter/datetime', data);
  }

  async jsonToToml(data: { json: string }): Promise<APIResponse> {
    return this.post('/converter/json-to-toml', data);
  }

  async tomlToJson(data: { toml: string }): Promise<APIResponse> {
    return this.post('/converter/toml-to-json', data);
  }

  async tomlToYaml(data: { toml: string }): Promise<APIResponse> {
    return this.post('/converter/toml-to-yaml', data);
  }

  async yamlToToml(data: { yaml: string }): Promise<APIResponse> {
    return this.post('/converter/yaml-to-toml', data);
  }

  async romanToArabic(data: { roman: string }): Promise<APIResponse> {
    return this.post('/converter/roman/to-arabic', data);
  }

  async textToBinary(data: { text: string }): Promise<APIResponse> {
    return this.post('/converter/text-to-binary', data);
  }

  async textToUnicode(data: { text: string }): Promise<APIResponse> {
    return this.post('/converter/text-to-unicode', data);
  }

  async textToNato(data: { text: string }): Promise<APIResponse> {
    return this.post('/converter/text-to-nato', data);
  }

  async convertList(data: { list: string; from?: string; to?: string }): Promise<APIResponse> {
    return this.post('/converter/list', data);
  }

  // ========== Web Development (Web开发) ==========
  async jsonPrettify(data: { json: string; indent?: number }): Promise<APIResponse> {
    return this.post('/web/json/prettify', data);
  }

  async jsonMinify(data: { json: string }): Promise<APIResponse> {
    return this.post('/web/json/minify', data);
  }

  async jsonDiff(data: { json1: string; json2: string }): Promise<APIResponse> {
    return this.post('/web/json/diff', data);
  }

  async jwtParse(data: { token: string }): Promise<APIResponse> {
    return this.post('/web/jwt/parse', data);
  }

  async htmlEncode(data: { html: string }): Promise<APIResponse> {
    return this.post('/web/html/encode', data);
  }

  async htmlDecode(data: { html: string }): Promise<APIResponse> {
    return this.post('/web/html/decode', data);
  }

  async markdownToHtml(data: { markdown: string }): Promise<APIResponse> {
    return this.post('/web/markdown/to-html', data);
  }

  async sqlFormat(data: { sql: string }): Promise<APIResponse> {
    return this.post('/web/sql/format', data);
  }

  async generateQrCode(data: { text: string; size?: number }): Promise<APIResponse> {
    return this.post('/web/qr-code/generate', data);
  }

  async generateWifiQrCode(data: { ssid: string; password: string; security?: string }): Promise<APIResponse> {
    return this.post('/web/wifi-qr-code/generate', data);
  }

  async getMimeTypes(): Promise<APIResponse> {
    return this.get('/web/mime-types', undefined, true, 3600000); // Cache 1 hour
  }

  async generateMetaTags(data: { title: string; description: string; image?: string }): Promise<APIResponse> {
    return this.post('/web/meta-tags/generate', data);
  }

  async yamlFormat(data: { yaml: string; indent?: number }): Promise<APIResponse> {
    return this.post('/web/yaml/format', data);
  }

  async xmlFormat(data: { xml: string; indent?: number }): Promise<APIResponse> {
    return this.post('/web/xml/format', data);
  }

  async httpStatus(data: { code: number }): Promise<APIResponse> {
    return this.post('/web/http/status', data);
  }

  async svgOptimize(data: { svg: string; precision?: number }): Promise<APIResponse> {
    return this.post('/web/svg/optimize', data);
  }

  // ========== Text Processing (文本处理) ==========
  async textStatistics(data: { text: string }): Promise<APIResponse> {
    return this.post('/text/statistics', data);
  }

  async regexTest(data: { text: string; pattern: string; flags?: string }): Promise<APIResponse> {
    return this.post('/text/regex/test', data);
  }

  async urlParse(data: { url: string }): Promise<APIResponse> {
    return this.post('/text/url/parse', data);
  }

  async loremIpsum(data: { paragraphs?: number; words?: number }): Promise<APIResponse> {
    return this.post('/text/lorem-ipsum', data);
  }

  async textDiff(data: { text1: string; text2: string }): Promise<APIResponse> {
    return this.post('/text/diff', data);
  }

  async parseCrontab(data: { crontab: string }): Promise<APIResponse> {
    return this.post('/text/crontab/parse', data);
  }

  async emailNormalize(data: { email: string }): Promise<APIResponse> {
    return this.post('/text/email/normalize', data);
  }

  async numeronym(data: { text: string }): Promise<APIResponse> {
    return this.post('/text/numeronym', data);
  }

  async asciiArt(data: { text: string; font?: string }): Promise<APIResponse> {
    return this.post('/text/ascii-art', data);
  }

  async parsePhone(data: { phone: string; country?: string }): Promise<APIResponse> {
    return this.post('/text/phone/parse', data);
  }

  async validateIban(data: { iban: string }): Promise<APIResponse> {
    return this.post('/text/iban/validate', data);
  }

  async encodeSafelink(data: { url: string; action: 'encode' | 'decode' }): Promise<APIResponse> {
    return this.post('/text/safelink/encode', data);
  }

  async emojiPicker(data: { search?: string; category?: string }): Promise<APIResponse> {
    return this.post('/text/emoji/picker', data);
  }

  async generateGitMemo(data: { type: string; scope?: string; subject: string; body?: string; breaking?: boolean }): Promise<APIResponse> {
    return this.post('/text/git/memo', data);
  }

  async obfuscate(data: { text: string; method?: string }): Promise<APIResponse> {
    return this.post('/text/obfuscate', data);
  }

  // ========== Math (数学计算) ==========
  async mathEvaluate(data: { expression: string }): Promise<APIResponse> {
    return this.post('/math/evaluate', data);
  }

  async calculatePercentage(data: { value: number; total: number }): Promise<APIResponse> {
    return this.post('/math/percentage', data);
  }

  async calculateEta(data: { current: number; total: number; startTime: string }): Promise<APIResponse> {
    return this.post('/math/eta', data);
  }

  async benchmark(data: { operation: string; iterations?: number; data?: string }): Promise<APIResponse> {
    return this.post('/math/benchmark', data);
  }

  // ========== Network (网络工具) ==========
  async ipv4Convert(data: { ip: string; to: string }): Promise<APIResponse> {
    return this.post('/network/ipv4/convert', data);
  }

  async ipv4Subnet(data: { ip: string; cidr: number }): Promise<APIResponse> {
    return this.post('/network/ipv4/subnet', data);
  }

  async generateMacAddress(): Promise<APIResponse> {
    return this.post('/network/mac/generate');
  }

  async macLookup(data: { mac: string }): Promise<APIResponse> {
    return this.post('/network/mac/lookup', data);
  }

  async parseUserAgent(data: { userAgent: string }): Promise<APIResponse> {
    return this.post('/network/user-agent/parse', data);
  }

  async chmod(data: { permissions: string }): Promise<APIResponse> {
    return this.post('/network/chmod', data);
  }

  async ipv4Expand(data: { range: string }): Promise<APIResponse> {
    return this.post('/network/ipv4/expand', data);
  }

  async ipv6GenerateUla(data: { count?: number }): Promise<APIResponse> {
    return this.post('/network/ipv6/ula', data);
  }

  async randomPort(data: { count?: number; min?: number; max?: number }): Promise<APIResponse> {
    return this.post('/network/port/random', data);
  }

  // ========== Advanced Tools (高级工具) ==========
  async imageResize(data: { image: File; width: number; height: number }): Promise<APIResponse> {
    const formData = new FormData();
    formData.append('image', data.image);
    formData.append('width', data.width.toString());
    formData.append('height', data.height.toString());
    return this.request({ url: '/advanced/image/resize', method: 'POST', data: formData } as any);
  }

  async imageCompress(data: { image: File; quality?: number }): Promise<APIResponse> {
    const formData = new FormData();
    formData.append('image', data.image);
    if (data.quality) formData.append('quality', data.quality.toString());
    return this.request({ url: '/advanced/image/compress', method: 'POST', data: formData } as any);
  }

  async calculateAge(data: { birthDate: string }): Promise<APIResponse> {
    return this.post('/advanced/calculator/age', data);
  }

  async calculateBMI(data: { weight: number; height: number }): Promise<APIResponse> {
    return this.post('/advanced/calculator/bmi', data);
  }

  async numberToWords(data: { number: number }): Promise<APIResponse> {
    return this.post('/advanced/calculator/number-to-words', data);
  }

  async imageRotate(data: { image: File; angle: number }): Promise<APIResponse> {
    const formData = new FormData();
    formData.append('image', data.image);
    formData.append('angle', data.angle.toString());
    return this.request({ url: '/advanced/image/rotate', method: 'POST', data: formData } as any);
  }

  async imageFlip(data: { image: File; direction: 'horizontal' | 'vertical' }): Promise<APIResponse> {
    const formData = new FormData();
    formData.append('image', data.image);
    formData.append('direction', data.direction);
    return this.request({ url: '/advanced/image/flip', method: 'POST', data: formData } as any);
  }

  async imageExtractColors(data: { image: File; count?: number }): Promise<APIResponse> {
    const formData = new FormData();
    formData.append('image', data.image);
    if (data.count) formData.append('count', data.count.toString());
    return this.request({ url: '/advanced/image/extract-colors', method: 'POST', data: formData } as any);
  }

  async imageCrop(data: { image: File; x: number; y: number; width: number; height: number }): Promise<APIResponse> {
    const formData = new FormData();
    formData.append('image', data.image);
    formData.append('x', data.x.toString());
    formData.append('y', data.y.toString());
    formData.append('width', data.width.toString());
    formData.append('height', data.height.toString());
    return this.request({ url: '/advanced/image/crop', method: 'POST', data: formData } as any);
  }

  async imageConvert(data: { image: File; format: string }): Promise<APIResponse> {
    const formData = new FormData();
    formData.append('image', data.image);
    formData.append('format', data.format);
    return this.request({ url: '/advanced/image/convert', method: 'POST', data: formData } as any);
  }

  async calculateLoanEMI(data: { principal: number; rate: number; tenure: number }): Promise<APIResponse> {
    return this.post('/advanced/calculator/loan-emi', data);
  }

  async calculateGST(data: { amount: number; rate: number; type?: string }): Promise<APIResponse> {
    return this.post('/advanced/calculator/gst', data);
  }

  async pdfSplit(data: { pdf: File; pages: string }): Promise<APIResponse> {
    const formData = new FormData();
    formData.append('pdf', data.pdf);
    formData.append('pages', data.pages);
    return this.request({ url: '/advanced/pdf/split', method: 'POST', data: formData } as any);
  }

  async pdfMerge(data: { pdfs: File[] }): Promise<APIResponse> {
    const formData = new FormData();
    data.pdfs.forEach((pdf, index) => {
      formData.append(`pdf${index}`, pdf);
    });
    return this.request({ url: '/advanced/pdf/merge', method: 'POST', data: formData } as any);
  }

  async pdfCompress(data: { pdf: File; quality?: number }): Promise<APIResponse> {
    const formData = new FormData();
    formData.append('pdf', data.pdf);
    if (data.quality) formData.append('quality', data.quality.toString());
    return this.request({ url: '/advanced/pdf/compress', method: 'POST', data: formData } as any);
  }

  async pdfRotate(data: { pdf: File; angle: number }): Promise<APIResponse> {
    const formData = new FormData();
    formData.append('pdf', data.pdf);
    formData.append('angle', data.angle.toString());
    return this.request({ url: '/advanced/pdf/rotate', method: 'POST', data: formData } as any);
  }

  async pdfAddPassword(data: { pdf: File; password: string }): Promise<APIResponse> {
    const formData = new FormData();
    formData.append('pdf', data.pdf);
    formData.append('password', data.password);
    return this.request({ url: '/advanced/pdf/add-password', method: 'POST', data: formData } as any);
  }

  // ========== Missing Methods (新增缺失的方法) ==========

  async basicAuth(data: { username: string; password: string }): Promise<APIResponse> {
    return this.post('/unified/basic-auth', data);
  }

  async token(data: { length?: number; type?: string }): Promise<APIResponse> {
    return this.post('/unified/token', data);
  }

  async uuid(data: { version?: string }): Promise<APIResponse> {
    return this.post('/unified/uuid', data);
  }

  async generateHmac(data: { algorithm: string; key: string; message: string }): Promise<APIResponse> {
    return this.post('/crypto/hmac', data);
  }

  async temperature(data: { value: number; from: string; to: string }): Promise<APIResponse> {
    return this.post('/converter/temperature', data);
  }

  async mimeTypes(data: { extension?: string; mimeType?: string }): Promise<APIResponse> {
    return this.post('/web/mime-types', data);
  }

  async eta(data: { current: number; total: number; start_time: number }): Promise<APIResponse> {
    return this.post('/math/eta', data);
  }

  async evaluate(data: { expression: string }): Promise<APIResponse> {
    return this.post('/math/evaluate', data);
  }

  async percentage(data: { value: number; total: number; decimal?: number }): Promise<APIResponse> {
    return this.post('/math/percentage', data);
  }

  async statistics(data: { text: string }): Promise<APIResponse> {
    return this.post('/text/statistics', data);
  }

  async macGenerate(data: { separator?: string; case?: string }): Promise<APIResponse> {
    return this.post('/network/mac-generate', data);
  }
}
