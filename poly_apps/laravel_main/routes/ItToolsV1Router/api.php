<?php

use Illuminate\Support\Facades\Route;
use App\Apps\ItToolsV1\ItToolsV1CryptoCtl\ItToolsV1CryptoCtl;
use App\Apps\ItToolsV1\ItToolsV1ConverterCtl\ItToolsV1ConverterCtl;
use App\Apps\ItToolsV1\ItToolsV1WebCtl\ItToolsV1WebCtl;
use App\Apps\ItToolsV1\ItToolsV1TextCtl\ItToolsV1TextCtl;
use App\Apps\ItToolsV1\ItToolsV1MathCtl\ItToolsV1MathCtl;
use App\Apps\ItToolsV1\ItToolsV1NetworkCtl\ItToolsV1NetworkCtl;
use App\Apps\ItToolsV1\ItToolsV1Controllers\ItToolsV1UnifiedCtl;
use App\Apps\ItToolsV1\ItToolsV1Controllers\ItToolsV1AdvancedCtl;
use App\Apps\ServerManagerV1\ServerManagerV1Controllers\ServerManagerV1NginxManagerCtl;

Route::prefix('ittools/v1')->group(function () {
    
    // Unified API Endpoints (Centralized)
    Route::prefix('unified')->group(function () {
        Route::post('/encode', [ItToolsV1UnifiedCtl::class, 'encode']);
        Route::post('/decode', [ItToolsV1UnifiedCtl::class, 'decode']);
        Route::post('/hash', [ItToolsV1UnifiedCtl::class, 'hash']);
        Route::post('/hmac', [ItToolsV1UnifiedCtl::class, 'hmac']);
        Route::post('/uuid', [ItToolsV1UnifiedCtl::class, 'uuid']);
        Route::post('/token', [ItToolsV1UnifiedCtl::class, 'token']);
        Route::post('/case', [ItToolsV1UnifiedCtl::class, 'convertCase']);
        Route::post('/slugify', [ItToolsV1UnifiedCtl::class, 'slugify']);
        Route::post('/color', [ItToolsV1UnifiedCtl::class, 'convertColor']);
        Route::post('/password-analyze', [ItToolsV1UnifiedCtl::class, 'analyzePassword']);
        Route::post('/basic-auth', [ItToolsV1UnifiedCtl::class, 'basicAuth']);
    });
    
    // Advanced Tools Endpoints (Image, Calculator, PDF, etc.)
    Route::prefix('advanced')->group(function () {
        Route::post('/image/resize', [ItToolsV1AdvancedCtl::class, 'imageResize']);
        Route::post('/image/rotate', [ItToolsV1AdvancedCtl::class, 'imageRotate']);
        Route::post('/image/flip', [ItToolsV1AdvancedCtl::class, 'imageFlip']);
        Route::post('/image/extract-colors', [ItToolsV1AdvancedCtl::class, 'imageExtractColors']);
        Route::post('/image/convert', [ItToolsV1AdvancedCtl::class, 'imageConvert']);
        Route::post('/image/compress', [ItToolsV1AdvancedCtl::class, 'imageCompress']);
        Route::post('/image/crop', [ItToolsV1AdvancedCtl::class, 'imageCrop']);
        
        Route::post('/calculator/age', [ItToolsV1AdvancedCtl::class, 'calculateAge']);
        Route::post('/calculator/bmi', [ItToolsV1AdvancedCtl::class, 'calculateBMI']);
        Route::post('/calculator/loan-emi', [ItToolsV1AdvancedCtl::class, 'calculateLoanEMI']);
        Route::post('/calculator/gst', [ItToolsV1AdvancedCtl::class, 'calculateGST']);
        Route::post('/calculator/number-to-words', [ItToolsV1AdvancedCtl::class, 'numberToWords']);
        
        Route::post('/pdf/split', [ItToolsV1AdvancedCtl::class, 'pdfSplit']);
        Route::post('/pdf/merge', [ItToolsV1AdvancedCtl::class, 'pdfMerge']);
        Route::post('/pdf/compress', [ItToolsV1AdvancedCtl::class, 'pdfCompress']);
        Route::post('/pdf/rotate', [ItToolsV1AdvancedCtl::class, 'pdfRotate']);
        Route::post('/pdf/add-password', [ItToolsV1AdvancedCtl::class, 'pdfAddPassword']);
    });

    // Crypto & Security Endpoints
    Route::prefix('crypto')->group(function () {
        Route::post('/hash', [ItToolsV1CryptoCtl::class, 'hashText']);
        Route::post('/bcrypt/hash', [ItToolsV1CryptoCtl::class, 'bcryptHash']);
        Route::post('/bcrypt/verify', [ItToolsV1CryptoCtl::class, 'bcryptVerify']);
        Route::post('/uuid/generate', [ItToolsV1CryptoCtl::class, 'generateUuid']);
        Route::post('/ulid/generate', [ItToolsV1CryptoCtl::class, 'generateUlid']);
        Route::post('/token/generate', [ItToolsV1CryptoCtl::class, 'generateToken']);
        Route::post('/basic-auth', [ItToolsV1CryptoCtl::class, 'generateBasicAuth']);
        Route::post('/hmac', [ItToolsV1CryptoCtl::class, 'generateHmac']);
        Route::post('/rsa/generate', [ItToolsV1CryptoCtl::class, 'generateRsaKeyPair']);
        Route::post('/bip39/generate', [ItToolsV1CryptoCtl::class, 'generateBip39']);
        Route::post('/otp/generate', [ItToolsV1CryptoCtl::class, 'generateOtp']);
        Route::post('/otp/verify', [ItToolsV1CryptoCtl::class, 'verifyOtp']);
        Route::post('/password/analyze', [ItToolsV1CryptoCtl::class, 'analyzePassword']);
        Route::post('/encrypt', [ItToolsV1CryptoCtl::class, 'encrypt']);
        Route::post('/decrypt', [ItToolsV1CryptoCtl::class, 'decrypt']);
    });

    // Converter Endpoints
    Route::prefix('converter')->group(function () {
        Route::post('/base64/encode', [ItToolsV1ConverterCtl::class, 'base64Encode']);
        Route::post('/base64/decode', [ItToolsV1ConverterCtl::class, 'base64Decode']);
        Route::post('/base64/file/encode', [ItToolsV1ConverterCtl::class, 'base64FileEncode']);
        Route::post('/base64/file/decode', [ItToolsV1ConverterCtl::class, 'base64FileDecode']);
        Route::post('/case', [ItToolsV1ConverterCtl::class, 'convertCase']);
        Route::post('/url/encode', [ItToolsV1ConverterCtl::class, 'urlEncode']);
        Route::post('/url/decode', [ItToolsV1ConverterCtl::class, 'urlDecode']);
        Route::post('/color', [ItToolsV1ConverterCtl::class, 'convertColor']);
        Route::post('/base', [ItToolsV1ConverterCtl::class, 'convertBase']);
        Route::post('/slugify', [ItToolsV1ConverterCtl::class, 'slugify']);
        Route::post('/json-to-yaml', [ItToolsV1ConverterCtl::class, 'jsonToYaml']);
        Route::post('/yaml-to-json', [ItToolsV1ConverterCtl::class, 'yamlToJson']);
        Route::post('/json-to-csv', [ItToolsV1ConverterCtl::class, 'jsonToCsv']);
        Route::post('/json-to-xml', [ItToolsV1ConverterCtl::class, 'jsonToXml']);
        Route::post('/xml-to-json', [ItToolsV1ConverterCtl::class, 'xmlToJson']);
        Route::post('/json-to-toml', [ItToolsV1ConverterCtl::class, 'jsonToToml']);
        Route::post('/toml-to-json', [ItToolsV1ConverterCtl::class, 'tomlToJson']);
        Route::post('/toml-to-yaml', [ItToolsV1ConverterCtl::class, 'tomlToYaml']);
        Route::post('/yaml-to-toml', [ItToolsV1ConverterCtl::class, 'yamlToToml']);
        Route::post('/temperature', [ItToolsV1ConverterCtl::class, 'temperature']);
        Route::post('/datetime', [ItToolsV1ConverterCtl::class, 'convertDateTime']);
        Route::post('/roman/to-arabic', [ItToolsV1ConverterCtl::class, 'romanToArabic']);
        Route::post('/text-to-binary', [ItToolsV1ConverterCtl::class, 'textToBinary']);
        Route::post('/text-to-unicode', [ItToolsV1ConverterCtl::class, 'textToUnicode']);
        Route::post('/text-to-nato', [ItToolsV1ConverterCtl::class, 'textToNato']);
        Route::post('/list', [ItToolsV1ConverterCtl::class, 'convertList']);
    });

    // Web Development Endpoints
    Route::prefix('web')->group(function () {
        Route::post('/json/prettify', [ItToolsV1WebCtl::class, 'jsonPrettify']);
        Route::post('/json/minify', [ItToolsV1WebCtl::class, 'jsonMinify']);
        Route::post('/json/diff', [ItToolsV1WebCtl::class, 'jsonDiff']);
        Route::post('/jwt/parse', [ItToolsV1WebCtl::class, 'jwtParse']);
        Route::post('/html/encode', [ItToolsV1WebCtl::class, 'htmlEncode']);
        Route::post('/html/decode', [ItToolsV1WebCtl::class, 'htmlDecode']);
        Route::post('/markdown/to-html', [ItToolsV1WebCtl::class, 'markdownToHtml']);
        Route::post('/sql/format', [ItToolsV1WebCtl::class, 'sqlFormat']);
        Route::post('/qr-code/generate', [ItToolsV1WebCtl::class, 'generateQrCode']);
        Route::post('/wifi-qr-code/generate', [ItToolsV1WebCtl::class, 'generateWifiQrCode']);
        Route::post('/yaml/format', [ItToolsV1WebCtl::class, 'yamlFormat']);
        Route::post('/xml/format', [ItToolsV1WebCtl::class, 'xmlFormat']);
        Route::post('/http/status', [ItToolsV1WebCtl::class, 'httpStatus']);
        Route::get('/mime-types', [ItToolsV1WebCtl::class, 'mimeTypes']);
        Route::post('/meta-tags/generate', [ItToolsV1WebCtl::class, 'generateMetaTags']);
        Route::post('/svg/optimize', [ItToolsV1WebCtl::class, 'svgOptimize']);
    });

    // Text Processing Endpoints
    Route::prefix('text')->group(function () {
        Route::post('/statistics', [ItToolsV1TextCtl::class, 'statistics']);
        Route::post('/regex/test', [ItToolsV1TextCtl::class, 'regexTest']);
        Route::post('/url/parse', [ItToolsV1TextCtl::class, 'urlParse']);
        Route::post('/lorem-ipsum', [ItToolsV1TextCtl::class, 'loremIpsum']);
        Route::post('/email/normalize', [ItToolsV1TextCtl::class, 'emailNormalize']);
        Route::post('/numeronym', [ItToolsV1TextCtl::class, 'numeronym']);
        Route::post('/diff', [ItToolsV1TextCtl::class, 'textDiff']);
        Route::post('/ascii-art', [ItToolsV1TextCtl::class, 'asciiArt']);
        Route::post('/crontab/parse', [ItToolsV1TextCtl::class, 'parseCrontab']);
        Route::post('/phone/parse', [ItToolsV1TextCtl::class, 'parsePhone']);
        Route::post('/iban/validate', [ItToolsV1TextCtl::class, 'validateIban']);
        Route::post('/safelink/encode', [ItToolsV1TextCtl::class, 'encodeSafelink']);
        Route::post('/emoji/picker', [ItToolsV1TextCtl::class, 'emojiPicker']);
        Route::post('/git/memo', [ItToolsV1TextCtl::class, 'generateGitMemo']);
        Route::post('/obfuscate', [ItToolsV1TextCtl::class, 'obfuscate']);
    });

    // Math Endpoints
    Route::prefix('math')->group(function () {
        Route::post('/evaluate', [ItToolsV1MathCtl::class, 'evaluate']);
        Route::post('/percentage', [ItToolsV1MathCtl::class, 'percentage']);
        Route::post('/eta', [ItToolsV1MathCtl::class, 'eta']);
        Route::post('/benchmark', [ItToolsV1MathCtl::class, 'benchmark']);
    });

    // Network Endpoints
    Route::prefix('network')->group(function () {
        Route::post('/ipv4/convert', [ItToolsV1NetworkCtl::class, 'ipv4Convert']);
        Route::post('/ipv4/subnet', [ItToolsV1NetworkCtl::class, 'ipv4Subnet']);
        Route::post('/ipv4/expand', [ItToolsV1NetworkCtl::class, 'ipv4Expand']);
        Route::post('/ipv6/ula', [ItToolsV1NetworkCtl::class, 'ipv6GenerateUla']);
        Route::post('/mac/generate', [ItToolsV1NetworkCtl::class, 'macGenerate']);
        Route::post('/mac/lookup', [ItToolsV1NetworkCtl::class, 'macLookup']);
        Route::post('/user-agent/parse', [ItToolsV1NetworkCtl::class, 'parseUserAgent']);
        Route::post('/chmod', [ItToolsV1NetworkCtl::class, 'chmod']);
        Route::post('/port/random', [ItToolsV1NetworkCtl::class, 'randomPort']);
    });

    // Nginx Management Endpoints (sub-API)
    Route::prefix('nginx')->group(function () {
        Route::get('/sites', [ServerManagerV1NginxManagerCtl::class, 'listSites']);
        Route::get('/config', [ServerManagerV1NginxManagerCtl::class, 'getSiteConfig']);
        Route::post('/enable', [ServerManagerV1NginxManagerCtl::class, 'enableSite']);
        Route::post('/disable', [ServerManagerV1NginxManagerCtl::class, 'disableSite']);
        Route::post('/test', [ServerManagerV1NginxManagerCtl::class, 'testConfig']);
        Route::post('/reload', [ServerManagerV1NginxManagerCtl::class, 'reloadNginx']);
    });
});
