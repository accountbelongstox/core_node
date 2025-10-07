<?php

use Illuminate\Support\Facades\Route;
use App\Apps\ItToolsV1\ItToolsV1CryptoCtl\ItToolsV1CryptoCtl;
use App\Apps\ItToolsV1\ItToolsV1ConverterCtl\ItToolsV1ConverterCtl;
use App\Apps\ItToolsV1\ItToolsV1WebCtl\ItToolsV1WebCtl;
use App\Apps\ItToolsV1\ItToolsV1TextCtl\ItToolsV1TextCtl;
use App\Apps\ItToolsV1\ItToolsV1MathCtl\ItToolsV1MathCtl;
use App\Apps\ItToolsV1\ItToolsV1NetworkCtl\ItToolsV1NetworkCtl;

Route::prefix('it-tools/v1')->group(function () {

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
        Route::post('/case', [ItToolsV1ConverterCtl::class, 'convertCase']);
        Route::post('/url/encode', [ItToolsV1ConverterCtl::class, 'urlEncode']);
        Route::post('/url/decode', [ItToolsV1ConverterCtl::class, 'urlDecode']);
        Route::post('/color', [ItToolsV1ConverterCtl::class, 'convertColor']);
        Route::post('/base', [ItToolsV1ConverterCtl::class, 'convertBase']);
        Route::post('/slugify', [ItToolsV1ConverterCtl::class, 'slugify']);
        Route::post('/json-to-yaml', [ItToolsV1ConverterCtl::class, 'jsonToYaml']);
        Route::post('/yaml-to-json', [ItToolsV1ConverterCtl::class, 'yamlToJson']);
        Route::post('/json-to-csv', [ItToolsV1ConverterCtl::class, 'jsonToCsv']);
        Route::post('/temperature', [ItToolsV1ConverterCtl::class, 'temperature']);
        Route::post('/roman/to-arabic', [ItToolsV1ConverterCtl::class, 'romanToArabic']);
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
    });

    // Math Endpoints
    Route::prefix('math')->group(function () {
        Route::post('/evaluate', [ItToolsV1MathCtl::class, 'evaluate']);
        Route::post('/percentage', [ItToolsV1MathCtl::class, 'percentage']);
        Route::post('/eta', [ItToolsV1MathCtl::class, 'eta']);
    });

    // Network Endpoints
    Route::prefix('network')->group(function () {
        Route::post('/ipv4/convert', [ItToolsV1NetworkCtl::class, 'ipv4Convert']);
        Route::post('/ipv4/subnet', [ItToolsV1NetworkCtl::class, 'ipv4Subnet']);
        Route::post('/ipv4/expand', [ItToolsV1NetworkCtl::class, 'ipv4Expand']);
        Route::post('/mac/generate', [ItToolsV1NetworkCtl::class, 'macGenerate']);
        Route::post('/chmod', [ItToolsV1NetworkCtl::class, 'chmod']);
        Route::post('/port/random', [ItToolsV1NetworkCtl::class, 'randomPort']);
    });
});
