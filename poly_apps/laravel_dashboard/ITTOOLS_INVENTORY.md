# ItToolsV1 Complete API Inventory

## Overview
This document catalogs all 119 API endpoints discovered in the ItToolsV1 backend module.

**Status:**
- **Total Backend APIs:** 119 endpoints
- **Currently Configured:** 10 tools (8.4%)
- **Missing Configurations:** 109 tools (91.6%)

---

## 1. Unified API (11 endpoints)

| # | Endpoint | Method | Controller | Status |
|---|----------|---------|------------|--------|
| 1 | `/unified/encode` | encode | UnifiedCtl | ❌ Missing |
| 2 | `/unified/decode` | decode | UnifiedCtl | ❌ Missing |
| 3 | `/unified/hash` | hash | UnifiedCtl | ✅ **Configured** (hashGenerator) |
| 4 | `/unified/hmac` | hmac | UnifiedCtl | ❌ Missing |
| 5 | `/unified/uuid` | uuid | UnifiedCtl | ✅ **Configured** (uuidGenerator) |
| 6 | `/unified/token` | token | UnifiedCtl | ❌ Missing |
| 7 | `/unified/case` | convertCase | UnifiedCtl | ❌ Missing |
| 8 | `/unified/slugify` | slugify | UnifiedCtl | ❌ Missing |
| 9 | `/unified/color` | convertColor | UnifiedCtl | ✅ **Configured** (colorConverter) |
| 10 | `/unified/password-analyze` | analyzePassword | UnifiedCtl | ❌ Missing |
| 11 | `/unified/basic-auth` | basicAuth | UnifiedCtl | ❌ Missing |

---

## 2. Advanced Tools API (20 endpoints)

### 2.1 Image Tools (7 endpoints)

| # | Endpoint | Method | Status |
|---|----------|---------|--------|
| 12 | `/advanced/image/resize` | imageResize | ❌ Missing |
| 13 | `/advanced/image/rotate` | imageRotate | ❌ Missing |
| 14 | `/advanced/image/flip` | imageFlip | ❌ Missing |
| 15 | `/advanced/image/extract-colors` | imageExtractColors | ❌ Missing |
| 16 | `/advanced/image/convert` | imageConvert | ❌ Missing |
| 17 | `/advanced/image/compress` | imageCompress | ❌ Missing |
| 18 | `/advanced/image/crop` | imageCrop | ❌ Missing |

### 2.2 Calculator Tools (5 endpoints)

| # | Endpoint | Method | Status |
|---|----------|---------|--------|
| 19 | `/advanced/calculator/age` | calculateAge | ❌ Missing |
| 20 | `/advanced/calculator/bmi` | calculateBMI | ❌ Missing |
| 21 | `/advanced/calculator/loan-emi` | calculateLoanEMI | ❌ Missing |
| 22 | `/advanced/calculator/gst` | calculateGST | ❌ Missing |
| 23 | `/advanced/calculator/number-to-words` | numberToWords | ❌ Missing |

### 2.3 PDF Tools (5 endpoints)

| # | Endpoint | Method | Status |
|---|----------|---------|--------|
| 24 | `/advanced/pdf/split` | pdfSplit | ❌ Missing |
| 25 | `/advanced/pdf/merge` | pdfMerge | ❌ Missing |
| 26 | `/advanced/pdf/compress` | pdfCompress | ❌ Missing |
| 27 | `/advanced/pdf/rotate` | pdfRotate | ❌ Missing |
| 28 | `/advanced/pdf/add-password` | pdfAddPassword | ❌ Missing |

### 2.4 Other Advanced (3 endpoints)

| # | Endpoint | Method | Status |
|---|----------|---------|--------|
| 29 | `/advanced/image/generate-placeholder` | - | ❌ Missing |
| 30 | `/advanced/calculator/compound-interest` | - | ❌ Missing |
| 31 | `/advanced/barcode/generate` | - | ❌ Missing |

---

## 3. Crypto & Security API (15 endpoints)

| # | Endpoint | Method | Status |
|---|----------|---------|--------|
| 32 | `/crypto/hash` | hashText | ❌ Missing (duplicate of unified) |
| 33 | `/crypto/bcrypt/hash` | bcryptHash | ✅ **Configured** (bcryptGenerator) |
| 34 | `/crypto/bcrypt/verify` | bcryptVerify | ❌ Missing |
| 35 | `/crypto/uuid/generate` | generateUuid | ❌ Missing (duplicate of unified) |
| 36 | `/crypto/ulid/generate` | generateUlid | ❌ Missing |
| 37 | `/crypto/token/generate` | generateToken | ❌ Missing |
| 38 | `/crypto/basic-auth` | generateBasicAuth | ❌ Missing |
| 39 | `/crypto/hmac` | generateHmac | ❌ Missing |
| 40 | `/crypto/rsa/generate` | generateRsaKeyPair | ❌ Missing |
| 41 | `/crypto/bip39/generate` | generateBip39 | ❌ Missing |
| 42 | `/crypto/otp/generate` | generateOtp | ❌ Missing |
| 43 | `/crypto/otp/verify` | verifyOtp | ❌ Missing |
| 44 | `/crypto/password/analyze` | analyzePassword | ❌ Missing |
| 45 | `/crypto/encrypt` | encrypt | ❌ Missing |
| 46 | `/crypto/decrypt` | decrypt | ❌ Missing |

---

## 4. Converter API (26 endpoints)

### 4.1 Base64 Conversion (4 endpoints)

| # | Endpoint | Method | Status |
|---|----------|---------|--------|
| 47 | `/converter/base64/encode` | base64Encode | ✅ **Configured** (base64Converter) |
| 48 | `/converter/base64/decode` | base64Decode | ✅ **Configured** (base64Converter) |
| 49 | `/converter/base64/file/encode` | base64FileEncode | ❌ Missing |
| 50 | `/converter/base64/file/decode` | base64FileDecode | ❌ Missing |

### 4.2 Text Conversion (9 endpoints)

| # | Endpoint | Method | Status |
|---|----------|---------|--------|
| 51 | `/converter/case` | convertCase | ❌ Missing |
| 52 | `/converter/url/encode` | urlEncode | ❌ Missing |
| 53 | `/converter/url/decode` | urlDecode | ❌ Missing |
| 54 | `/converter/slugify` | slugify | ❌ Missing |
| 55 | `/converter/text-to-binary` | textToBinary | ❌ Missing |
| 56 | `/converter/text-to-unicode` | textToUnicode | ❌ Missing |
| 57 | `/converter/text-to-nato` | textToNato | ❌ Missing |
| 58 | `/converter/roman/to-arabic` | romanToArabic | ❌ Missing |
| 59 | `/converter/list` | convertList | ❌ Missing |

### 4.3 Format Conversion (9 endpoints)

| # | Endpoint | Method | Status |
|---|----------|---------|--------|
| 60 | `/converter/json-to-yaml` | jsonToYaml | ❌ Missing |
| 61 | `/converter/yaml-to-json` | yamlToJson | ❌ Missing |
| 62 | `/converter/json-to-csv` | jsonToCsv | ❌ Missing |
| 63 | `/converter/json-to-xml` | jsonToXml | ❌ Missing |
| 64 | `/converter/xml-to-json` | xmlToJson | ❌ Missing |
| 65 | `/converter/json-to-toml` | jsonToToml | ❌ Missing |
| 66 | `/converter/toml-to-json` | tomlToJson | ❌ Missing |
| 67 | `/converter/toml-to-yaml` | tomlToYaml | ❌ Missing |
| 68 | `/converter/yaml-to-toml` | yamlToToml | ❌ Missing |

### 4.4 Other Converters (4 endpoints)

| # | Endpoint | Method | Status |
|---|----------|---------|--------|
| 69 | `/converter/color` | convertColor | ❌ Missing (duplicate of unified) |
| 70 | `/converter/base` | convertBase | ❌ Missing |
| 71 | `/converter/temperature` | temperature | ❌ Missing |
| 72 | `/converter/datetime` | convertDateTime | ❌ Missing |

---

## 5. Web Development API (16 endpoints)

### 5.1 JSON Tools (3 endpoints)

| # | Endpoint | Method | Status |
|---|----------|---------|--------|
| 73 | `/web/json/prettify` | jsonPrettify | ✅ **Configured** (jsonFormatter) |
| 74 | `/web/json/minify` | jsonMinify | ✅ **Configured** (jsonFormatter) |
| 75 | `/web/json/diff` | jsonDiff | ❌ Missing |

### 5.2 HTML/Markup Tools (5 endpoints)

| # | Endpoint | Method | Status |
|---|----------|---------|--------|
| 76 | `/web/html/encode` | htmlEncode | ❌ Missing |
| 77 | `/web/html/decode` | htmlDecode | ❌ Missing |
| 78 | `/web/markdown/to-html` | markdownToHtml | ❌ Missing |
| 79 | `/web/xml/format` | xmlFormat | ❌ Missing |
| 80 | `/web/yaml/format` | yamlFormat | ❌ Missing |

### 5.3 Web Utilities (8 endpoints)

| # | Endpoint | Method | Status |
|---|----------|---------|--------|
| 81 | `/web/jwt/parse` | jwtParse | ❌ Missing |
| 82 | `/web/sql/format` | sqlFormat | ❌ Missing |
| 83 | `/web/qr-code/generate` | generateQrCode | ✅ **Configured** (qrCodeGenerator) |
| 84 | `/web/wifi-qr-code/generate` | generateWifiQrCode | ❌ Missing |
| 85 | `/web/http/status` | httpStatus | ❌ Missing |
| 86 | `/web/mime-types` | mimeTypes | ❌ Missing |
| 87 | `/web/meta-tags/generate` | generateMetaTags | ❌ Missing |
| 88 | `/web/svg/optimize` | svgOptimize | ❌ Missing |

---

## 6. Text Processing API (15 endpoints)

| # | Endpoint | Method | Status |
|---|----------|---------|--------|
| 89 | `/text/statistics` | statistics | ✅ **Configured** (textStatistics) |
| 90 | `/text/regex/test` | regexTest | ✅ **Configured** (regexTester) |
| 91 | `/text/url/parse` | urlParse | ❌ Missing |
| 92 | `/text/lorem-ipsum` | loremIpsum | ❌ Missing |
| 93 | `/text/email/normalize` | emailNormalize | ❌ Missing |
| 94 | `/text/numeronym` | numeronym | ❌ Missing |
| 95 | `/text/diff` | textDiff | ❌ Missing |
| 96 | `/text/ascii-art` | asciiArt | ❌ Missing |
| 97 | `/text/crontab/parse` | parseCrontab | ❌ Missing |
| 98 | `/text/phone/parse` | parsePhone | ❌ Missing |
| 99 | `/text/iban/validate` | validateIban | ❌ Missing |
| 100 | `/text/safelink/encode` | encodeSafelink | ❌ Missing |
| 101 | `/text/emoji/picker` | emojiPicker | ❌ Missing |
| 102 | `/text/git/memo` | generateGitMemo | ❌ Missing |
| 103 | `/text/obfuscate` | obfuscate | ❌ Missing |

---

## 7. Math & Calculation API (4 endpoints)

| # | Endpoint | Method | Status |
|---|----------|---------|--------|
| 104 | `/math/evaluate` | evaluate | ❌ Missing |
| 105 | `/math/percentage` | percentage | ❌ Missing |
| 106 | `/math/eta` | eta | ❌ Missing |
| 107 | `/math/benchmark` | benchmark | ❌ Missing |

---

## 8. Network Tools API (9 endpoints)

### 8.1 IP Tools (3 endpoints)

| # | Endpoint | Method | Status |
|---|----------|---------|--------|
| 108 | `/network/ipv4/convert` | ipv4Convert | ✅ **Configured** (ipCalculator) |
| 109 | `/network/ipv4/subnet` | ipv4Subnet | ✅ **Configured** (ipCalculator) |
| 110 | `/network/ipv4/expand` | ipv4Expand | ❌ Missing |
| 111 | `/network/ipv6/ula` | ipv6GenerateUla | ❌ Missing |

### 8.2 Network Utilities (5 endpoints)

| # | Endpoint | Method | Status |
|---|----------|---------|--------|
| 112 | `/network/mac/generate` | macGenerate | ❌ Missing |
| 113 | `/network/mac/lookup` | macLookup | ❌ Missing |
| 114 | `/network/user-agent/parse` | parseUserAgent | ❌ Missing |
| 115 | `/network/chmod` | chmod | ❌ Missing |
| 116 | `/network/port/random` | randomPort | ❌ Missing |

---

## 9. Nginx Management API (6 endpoints)

| # | Endpoint | Method | Status |
|---|----------|---------|--------|
| 117 | `/nginx/sites` | listSites | ❌ Out of scope (ServerManager) |
| 118 | `/nginx/config` | getSiteConfig | ❌ Out of scope (ServerManager) |
| 119 | `/nginx/enable` | enableSite | ❌ Out of scope (ServerManager) |

*Note: Nginx endpoints are part of ServerManagerV1, not ItToolsV1*

---

## Summary Statistics

### By Category

| Category | Total | Configured | Missing | Progress |
|----------|-------|------------|---------|----------|
| **Unified API** | 11 | 3 | 8 | 27% |
| **Advanced Tools** | 20 | 0 | 20 | 0% |
| **Crypto & Security** | 15 | 1 | 14 | 7% |
| **Converter** | 26 | 2 | 24 | 8% |
| **Web Development** | 16 | 3 | 13 | 19% |
| **Text Processing** | 15 | 2 | 13 | 13% |
| **Math & Calculation** | 4 | 0 | 4 | 0% |
| **Network Tools** | 9 | 2 | 7 | 22% |
| **TOTAL** | **116** | **13** | **103** | **11%** |

*Note: Some endpoints are duplicates across Unified and specialized controllers (hash, uuid, color)*

### Priority Recommendations

**High Priority (Most Useful):**
1. **Crypto Tools** (14 missing) - Security/password generation, encryption
2. **Converter Tools** (24 missing) - Format conversion, encoding/decoding
3. **Text Processing** (13 missing) - Text manipulation, parsing, validation
4. **Advanced Calculators** (5 missing) - Age, BMI, EMI, GST calculators
5. **Network Tools** (7 missing) - MAC, IP, user-agent utilities

**Medium Priority:**
6. **Web Development** (13 missing) - JWT, HTML, SQL, meta tags
7. **Image Tools** (7 missing) - Resize, rotate, compress, convert
8. **Math Tools** (4 missing) - Expression evaluator, percentage, benchmark

**Low Priority:**
9. **PDF Tools** (5 missing) - Split, merge, compress (require external libraries)

---

## Next Steps

1. **Phase 6A:** Extend `core/api/itToolsV1.ts` with 103 missing methods
2. **Phase 6B:** Create 103 new `ToolConfig` objects in `config/tools.config.ts`
3. **Phase 6C:** Update translations for all new tools (12 languages × 103 tools)
4. **Phase 6D:** Test all new tool configurations
5. **Phase 6E:** Create Phase 6 completion report

---

*Document generated: 2025-12-14*
*Backend API scan: ItToolsV1 complete*
