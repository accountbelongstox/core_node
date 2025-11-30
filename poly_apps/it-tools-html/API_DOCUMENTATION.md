# IT Tools API Documentation

**Base URL**: `https://api.si.12gm.com/it-tools/v1`

**API Version**: 1.0.0
**Last Updated**: 2025-01-07

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Request/Response Format](#requestresponse-format)
4. [Error Handling](#error-handling)
5. [API Endpoints](#api-endpoints)
   - [Crypto & Security](#crypto--security)
   - [Converters](#converters)
   - [Web Development](#web-development)
   - [Mathematics & Calculation](#mathematics--calculation)
   - [Network & System](#network--system)
   - [Text Processing](#text-processing)
   - [Media Tools](#media-tools)

---

## Overview

This API provides backend services for 88+ developer tools. All endpoints accept JSON payloads and return JSON responses.

---

## Authentication

Currently, no authentication is required. Rate limiting may be applied:
- **Rate Limit**: 100 requests per minute per IP
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## Request/Response Format

### Request Format
```json
{
  "input": "data to process",
  "options": {
    "option1": "value1"
  }
}
```

### Success Response Format
```json
{
  "success": true,
  "data": {
    "result": "processed data"
  },
  "timestamp": "2025-01-07T12:00:00Z"
}
```

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  },
  "timestamp": "2025-01-07T12:00:00Z"
}
```

---

## Error Handling

### HTTP Status Codes
- `200 OK` - Request successful
- `400 Bad Request` - Invalid input
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

### Common Error Codes
- `INVALID_INPUT` - Input validation failed
- `PROCESSING_ERROR` - Error during processing
- `UNSUPPORTED_FORMAT` - Format not supported
- `RATE_LIMIT_EXCEEDED` - Too many requests

---

## API Endpoints

---

## Crypto & Security

### 1. Token Generator
**POST** `/crypto/token/generate`

Generate random tokens with custom length and charset.

**Request:**
```json
{
  "length": 32,
  "charset": "alphanumeric",
  "includeSymbols": false,
  "count": 1
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tokens": ["Abc123Xyz789..."]
  }
}
```

---

### 2. Hash Text
**POST** `/crypto/hash`

Generate MD5, SHA1, SHA256, SHA512, SHA3 hashes.

**Request:**
```json
{
  "text": "hello world",
  "algorithm": "sha256"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "algorithm": "sha256",
    "hash": "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
  }
}
```

**Supported Algorithms**: `md5`, `sha1`, `sha256`, `sha512`, `sha3-256`, `sha3-512`

---

### 3. Bcrypt
**POST** `/crypto/bcrypt/hash`

Hash passwords with bcrypt.

**Request:**
```json
{
  "password": "mypassword",
  "rounds": 10
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "hash": "$2b$10$..."
  }
}
```

**POST** `/crypto/bcrypt/verify`

Verify bcrypt password.

**Request:**
```json
{
  "password": "mypassword",
  "hash": "$2b$10$..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true
  }
}
```

---

### 4. UUID Generator
**POST** `/crypto/uuid/generate`

Generate v4 UUIDs.

**Request:**
```json
{
  "count": 10,
  "version": 4,
  "uppercase": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "uuids": ["550e8400-e29b-41d4-a716-446655440000", "..."]
  }
}
```

---

### 5. ULID Generator
**POST** `/crypto/ulid/generate`

Generate ULIDs (Universally Unique Lexicographically Sortable Identifiers).

**Request:**
```json
{
  "count": 10,
  "timestamp": null
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ulids": ["01ARZ3NDEKTSV4RRFFQ69G5FAV", "..."]
  }
}
```

---

### 6. Encryption
**POST** `/crypto/encrypt`

Encrypt text using various algorithms.

**Request:**
```json
{
  "text": "secret message",
  "algorithm": "aes-256-cbc",
  "key": "encryption-key",
  "iv": "initialization-vector"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "encrypted": "base64-encrypted-text",
    "algorithm": "aes-256-cbc"
  }
}
```

**POST** `/crypto/decrypt`

Decrypt encrypted text.

**Request:**
```json
{
  "encrypted": "base64-encrypted-text",
  "algorithm": "aes-256-cbc",
  "key": "encryption-key",
  "iv": "initialization-vector"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "decrypted": "secret message"
  }
}
```

**Supported Algorithms**: `aes-256-cbc`, `aes-192-cbc`, `aes-128-cbc`, `des-ede3`, `rc4`

---

### 7. BIP39 Generator
**POST** `/crypto/bip39/generate`

Generate BIP39 mnemonic phrases.

**Request:**
```json
{
  "strength": 128,
  "language": "english"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "mnemonic": "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    "entropy": "00000000000000000000000000000000"
  }
}
```

**Strength Options**: `128`, `160`, `192`, `224`, `256` (bits)

---

### 8. Basic Auth Generator
**POST** `/crypto/basic-auth`

Generate basic authentication headers.

**Request:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "header": "Authorization: Basic YWRtaW46cGFzc3dvcmQxMjM=",
    "value": "YWRtaW46cGFzc3dvcmQxMjM="
  }
}
```

---

### 9. RSA Key Pair Generator
**POST** `/crypto/rsa/generate`

Generate RSA public/private key pairs.

**Request:**
```json
{
  "keySize": 2048,
  "format": "pem"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
    "privateKey": "-----BEGIN PRIVATE KEY-----\n...",
    "keySize": 2048
  }
}
```

**Key Sizes**: `1024`, `2048`, `4096`

---

### 10. HMAC Generator
**POST** `/crypto/hmac`

Generate HMAC signatures.

**Request:**
```json
{
  "text": "message",
  "secret": "secret-key",
  "algorithm": "sha256"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "hmac": "97d2a569059bbcd8ead4444ff99071f4c01d005bcefe0d3567e1be628e5fdcd9",
    "algorithm": "sha256"
  }
}
```

**Algorithms**: `sha1`, `sha256`, `sha512`

---

### 11. OTP Code Generator
**POST** `/crypto/otp/generate`

Generate TOTP/HOTP codes.

**Request:**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "type": "totp",
  "digits": 6,
  "period": 30
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "code": "123456",
    "remainingTime": 25,
    "type": "totp"
  }
}
```

**POST** `/crypto/otp/verify`

Verify OTP codes.

**Request:**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "code": "123456",
  "type": "totp"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true
  }
}
```

---

### 12. Password Strength Analyzer
**POST** `/crypto/password/analyze`

Analyze password strength.

**Request:**
```json
{
  "password": "MyP@ssw0rd123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "score": 3,
    "strength": "Good",
    "crackTime": "3 months",
    "suggestions": ["Add more characters", "Avoid predictable patterns"],
    "warnings": ["Common password pattern"],
    "entropy": 45.6
  }
}
```

**Score**: 0-4 (0=Very Weak, 1=Weak, 2=Fair, 3=Good, 4=Strong)

---

## Converters

### 13. Base64 String Converter
**POST** `/converter/base64/encode`

Encode string to base64.

**Request:**
```json
{
  "text": "hello world"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "encoded": "aGVsbG8gd29ybGQ="
  }
}
```

**POST** `/converter/base64/decode`

Decode base64 string.

**Request:**
```json
{
  "encoded": "aGVsbG8gd29ybGQ="
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "decoded": "hello world"
  }
}
```

---

### 14. Base64 File Converter
**POST** `/converter/base64/file/encode`

Convert file to base64.

**Request:**
```json
{
  "fileData": "binary data as base64",
  "fileName": "image.png"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "encoded": "data:image/png;base64,iVBORw0KGgo...",
    "size": 12345
  }
}
```

**POST** `/converter/base64/file/decode`

Decode base64 to file.

**Request:**
```json
{
  "encoded": "data:image/png;base64,iVBORw0KGgo..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fileData": "binary data as base64",
    "mimeType": "image/png",
    "size": 12345
  }
}
```

---

### 15. Color Converter
**POST** `/converter/color`

Convert between color formats.

**Request:**
```json
{
  "color": "#FF5733",
  "from": "hex",
  "to": "rgb"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "input": "#FF5733",
    "hex": "#FF5733",
    "rgb": "rgb(255, 87, 51)",
    "hsl": "hsl(12, 100%, 60%)",
    "hsv": "hsv(12, 80%, 100%)",
    "cmyk": "cmyk(0%, 66%, 80%, 0%)"
  }
}
```

**Formats**: `hex`, `rgb`, `hsl`, `hsv`, `cmyk`

---

### 16. Case Converter
**POST** `/converter/case`

Convert text case.

**Request:**
```json
{
  "text": "hello world",
  "to": "camelCase"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "camelCase": "helloWorld",
    "PascalCase": "HelloWorld",
    "snake_case": "hello_world",
    "kebab-case": "hello-world",
    "SCREAMING_SNAKE_CASE": "HELLO_WORLD",
    "lowercase": "hello world",
    "UPPERCASE": "HELLO WORLD",
    "Title Case": "Hello World"
  }
}
```

---

### 17. Date Time Converter
**POST** `/converter/datetime`

Convert between date formats and timestamps.

**Request:**
```json
{
  "input": "2025-01-07T12:00:00Z",
  "inputFormat": "iso",
  "outputFormat": "timestamp"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "iso": "2025-01-07T12:00:00Z",
    "timestamp": 1736251200,
    "unix": 1736251200000,
    "utc": "Tue, 07 Jan 2025 12:00:00 GMT",
    "locale": "1/7/2025, 12:00:00 PM",
    "relative": "in 11 months"
  }
}
```

---

### 18. Integer Base Converter
**POST** `/converter/base`

Convert between number bases.

**Request:**
```json
{
  "value": "255",
  "from": 10,
  "to": 16
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "binary": "11111111",
    "octal": "377",
    "decimal": "255",
    "hexadecimal": "FF"
  }
}
```

**Bases**: `2` (binary), `8` (octal), `10` (decimal), `16` (hexadecimal)

---

### 19. Roman Numeral Converter
**POST** `/converter/roman/to-arabic`

Convert Roman to Arabic numerals.

**Request:**
```json
{
  "roman": "MCMXCIV"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "arabic": 1994
  }
}
```

**POST** `/converter/roman/to-roman`

Convert Arabic to Roman numerals.

**Request:**
```json
{
  "arabic": 1994
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "roman": "MCMXCIV"
  }
}
```

---

### 20. Temperature Converter
**POST** `/converter/temperature`

Convert temperature units.

**Request:**
```json
{
  "value": 100,
  "from": "celsius"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "celsius": 100,
    "fahrenheit": 212,
    "kelvin": 373.15
  }
}
```

---

### 21. JSON to YAML
**POST** `/converter/json-to-yaml`

Convert JSON to YAML.

**Request:**
```json
{
  "json": "{\"name\": \"John\", \"age\": 30}"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "yaml": "name: John\nage: 30"
  }
}
```

---

### 22. YAML to JSON
**POST** `/converter/yaml-to-json`

Convert YAML to JSON.

**Request:**
```json
{
  "yaml": "name: John\nage: 30"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "json": "{\"name\":\"John\",\"age\":30}"
  }
}
```

---

### 23. JSON to XML
**POST** `/converter/json-to-xml`

Convert JSON to XML.

**Request:**
```json
{
  "json": "{\"person\": {\"name\": \"John\", \"age\": 30}}"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "xml": "<?xml version=\"1.0\"?>\n<person>\n  <name>John</name>\n  <age>30</age>\n</person>"
  }
}
```

---

### 24. XML to JSON
**POST** `/converter/xml-to-json`

Convert XML to JSON.

**Request:**
```json
{
  "xml": "<?xml version=\"1.0\"?>\n<person>\n  <name>John</name>\n  <age>30</age>\n</person>"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "json": "{\"person\":{\"name\":\"John\",\"age\":30}}"
  }
}
```

---

### 25. JSON to CSV
**POST** `/converter/json-to-csv`

Convert JSON array to CSV.

**Request:**
```json
{
  "json": "[{\"name\":\"John\",\"age\":30},{\"name\":\"Jane\",\"age\":25}]",
  "delimiter": ",",
  "includeHeaders": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "csv": "name,age\nJohn,30\nJane,25"
  }
}
```

---

### 26. JSON to TOML
**POST** `/converter/json-to-toml`

Convert JSON to TOML.

**Request:**
```json
{
  "json": "{\"database\": {\"host\": \"localhost\", \"port\": 5432}}"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "toml": "[database]\nhost = \"localhost\"\nport = 5432"
  }
}
```

---

### 27. TOML to JSON
**POST** `/converter/toml-to-json`

Convert TOML to JSON.

**Request:**
```json
{
  "toml": "[database]\nhost = \"localhost\"\nport = 5432"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "json": "{\"database\":{\"host\":\"localhost\",\"port\":5432}}"
  }
}
```

---

### 28. TOML to YAML
**POST** `/converter/toml-to-yaml`

Convert TOML to YAML.

**Request:**
```json
{
  "toml": "[database]\nhost = \"localhost\"\nport = 5432"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "yaml": "database:\n  host: localhost\n  port: 5432"
  }
}
```

---

### 29. YAML to TOML
**POST** `/converter/yaml-to-toml`

Convert YAML to TOML.

**Request:**
```json
{
  "yaml": "database:\n  host: localhost\n  port: 5432"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "toml": "[database]\nhost = \"localhost\"\nport = 5432"
  }
}
```

---

### 30. Docker Run to Docker Compose
**POST** `/converter/docker-run-to-compose`

Convert docker run commands to docker-compose.yml.

**Request:**
```json
{
  "command": "docker run -d -p 80:80 --name webserver nginx"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "compose": "version: '3'\nservices:\n  webserver:\n    image: nginx\n    ports:\n      - \"80:80\"\n    container_name: webserver"
  }
}
```

---

### 31. Text to Binary
**POST** `/converter/text-to-binary`

Convert text to binary representation.

**Request:**
```json
{
  "text": "Hello"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "binary": "01001000 01100101 01101100 01101100 01101111"
  }
}
```

---

### 32. Text to Unicode
**POST** `/converter/text-to-unicode`

Convert text to Unicode code points.

**Request:**
```json
{
  "text": "Hello"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "unicode": "U+0048 U+0065 U+006C U+006C U+006F",
    "codePoints": [72, 101, 108, 108, 111]
  }
}
```

---

### 33. Text to NATO Alphabet
**POST** `/converter/text-to-nato`

Convert text to NATO phonetic alphabet.

**Request:**
```json
{
  "text": "SOS"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "nato": "Sierra Oscar Sierra"
  }
}
```

---

### 34. URL Encoder
**POST** `/converter/url/encode`

Encode URL.

**Request:**
```json
{
  "url": "https://example.com/search?q=hello world"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "encoded": "https%3A%2F%2Fexample.com%2Fsearch%3Fq%3Dhello%20world"
  }
}
```

**POST** `/converter/url/decode`

Decode URL.

**Request:**
```json
{
  "encoded": "https%3A%2F%2Fexample.com%2Fsearch%3Fq%3Dhello%20world"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "decoded": "https://example.com/search?q=hello world"
  }
}
```

---

### 35. HTML Entities
**POST** `/converter/html/encode`

Encode HTML entities.

**Request:**
```json
{
  "html": "<div>Hello & goodbye</div>"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "encoded": "&lt;div&gt;Hello &amp; goodbye&lt;/div&gt;"
  }
}
```

**POST** `/converter/html/decode`

Decode HTML entities.

**Request:**
```json
{
  "encoded": "&lt;div&gt;Hello &amp; goodbye&lt;/div&gt;"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "decoded": "<div>Hello & goodbye</div>"
  }
}
```

---

### 36. List Converter
**POST** `/converter/list`

Convert between list formats.

**Request:**
```json
{
  "list": "apple,banana,orange",
  "from": "comma",
  "to": "newline"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "comma": "apple,banana,orange",
    "newline": "apple\nbanana\norange",
    "space": "apple banana orange",
    "semicolon": "apple;banana;orange",
    "pipe": "apple|banana|orange"
  }
}
```

---

### 37. Slugify String
**POST** `/converter/slugify`

Convert text to URL-friendly slugs.

**Request:**
```json
{
  "text": "Hello World! This is a Test.",
  "separator": "-",
  "lowercase": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "slug": "hello-world-this-is-a-test"
  }
}
```

---

## Web Development

### 38. JSON Viewer
**POST** `/web/json/prettify`

Pretty print JSON data.

**Request:**
```json
{
  "json": "{\"name\":\"John\",\"age\":30}",
  "indent": 2
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "prettified": "{\n  \"name\": \"John\",\n  \"age\": 30\n}"
  }
}
```

---

### 39. JSON Minify
**POST** `/web/json/minify`

Minify JSON data.

**Request:**
```json
{
  "json": "{\n  \"name\": \"John\",\n  \"age\": 30\n}"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "minified": "{\"name\":\"John\",\"age\":30}"
  }
}
```

---

### 40. JSON Diff
**POST** `/web/json/diff`

Compare two JSON objects.

**Request:**
```json
{
  "json1": "{\"name\":\"John\",\"age\":30}",
  "json2": "{\"name\":\"John\",\"age\":31}"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "differences": [
      {
        "path": "age",
        "oldValue": 30,
        "newValue": 31,
        "type": "modified"
      }
    ],
    "hasDifferences": true
  }
}
```

---

### 41. JWT Parser
**POST** `/web/jwt/parse`

Decode and parse JWT tokens.

**Request:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "header": {
      "alg": "HS256",
      "typ": "JWT"
    },
    "payload": {
      "sub": "1234567890",
      "name": "John Doe",
      "iat": 1516239022
    },
    "signature": "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
  }
}
```

**POST** `/web/jwt/verify`

Verify JWT token.

**Request:**
```json
{
  "token": "eyJ...",
  "secret": "your-secret-key",
  "algorithm": "HS256"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "expired": false,
    "payload": {}
  }
}
```

---

### 42. HTML WYSIWYG Editor
**POST** `/web/html/render`

Render HTML from markdown or text.

**Request:**
```json
{
  "markdown": "# Hello\n\nThis is **bold** text."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "html": "<h1>Hello</h1>\n<p>This is <strong>bold</strong> text.</p>"
  }
}
```

---

### 43. Markdown to HTML
**POST** `/web/markdown/to-html`

Convert Markdown to HTML.

**Request:**
```json
{
  "markdown": "# Hello World\n\nThis is a paragraph.",
  "sanitize": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "html": "<h1>Hello World</h1>\n<p>This is a paragraph.</p>"
  }
}
```

---

### 44. SQL Prettify
**POST** `/web/sql/format`

Format and prettify SQL queries.

**Request:**
```json
{
  "sql": "SELECT * FROM users WHERE age>25 AND city='NYC'",
  "indent": "  ",
  "uppercase": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "formatted": "SELECT\n  *\nFROM\n  users\nWHERE\n  age > 25\n  AND city = 'NYC'"
  }
}
```

---

### 45. XML Formatter
**POST** `/web/xml/format`

Format and validate XML.

**Request:**
```json
{
  "xml": "<root><item>value</item></root>",
  "indent": 2
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "formatted": "<?xml version=\"1.0\"?>\n<root>\n  <item>value</item>\n</root>",
    "valid": true
  }
}
```

---

### 46. YAML Viewer
**POST** `/web/yaml/validate`

View and validate YAML files.

**Request:**
```json
{
  "yaml": "name: John\nage: 30"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "parsed": {
      "name": "John",
      "age": 30
    }
  }
}
```

---

### 47. HTTP Status Codes
**GET** `/web/http-status/:code`

Get HTTP status code information.

**Response:**
```json
{
  "success": true,
  "data": {
    "code": 404,
    "message": "Not Found",
    "description": "The requested resource could not be found."
  }
}
```

**GET** `/web/http-status`

Get all HTTP status codes.

---

### 48. MIME Types
**GET** `/web/mime-types/:extension`

Get MIME type by file extension.

**Response:**
```json
{
  "success": true,
  "data": {
    "extension": "png",
    "mimeType": "image/png"
  }
}
```

**GET** `/web/mime-types`

Get all MIME types.

---

### 49. Meta Tag Generator
**POST** `/web/meta-tags/generate`

Generate SEO meta tags.

**Request:**
```json
{
  "title": "My Website",
  "description": "A great website",
  "keywords": ["web", "development"],
  "author": "John Doe",
  "ogType": "website",
  "ogImage": "https://example.com/image.png"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "html": "<meta name=\"title\" content=\"My Website\">\n<meta name=\"description\" content=\"A great website\">..."
  }
}
```

---

### 50. QR Code Generator
**POST** `/web/qr-code/generate`

Generate QR codes.

**Request:**
```json
{
  "text": "https://example.com",
  "size": 256,
  "errorCorrectionLevel": "M"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "qrCode": "data:image/png;base64,iVBORw0KGgo..."
  }
}
```

**Error Correction Levels**: `L`, `M`, `Q`, `H`

---

### 51. WiFi QR Code Generator
**POST** `/web/wifi-qr-code/generate`

Generate WiFi connection QR codes.

**Request:**
```json
{
  "ssid": "MyNetwork",
  "password": "password123",
  "encryption": "WPA",
  "hidden": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "qrCode": "data:image/png;base64,iVBORw0KGgo..."
  }
}
```

---

### 52. SVG Placeholder Generator
**POST** `/web/svg/placeholder`

Generate SVG placeholder images.

**Request:**
```json
{
  "width": 400,
  "height": 300,
  "text": "Placeholder",
  "bgColor": "#cccccc",
  "textColor": "#333333"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "svg": "<svg width=\"400\" height=\"300\">...</svg>"
  }
}
```

---

## Mathematics & Calculation

### 53. Math Evaluator
**POST** `/math/evaluate`

Evaluate mathematical expressions.

**Request:**
```json
{
  "expression": "2 + 2 * 3",
  "precision": 10
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "result": 8,
    "expression": "2 + 2 * 3"
  }
}
```

---

### 54. Percentage Calculator
**POST** `/math/percentage`

Calculate percentages.

**Request:**
```json
{
  "operation": "percent_of",
  "value1": 20,
  "value2": 100
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "result": 20,
    "formula": "20% of 100 = 20"
  }
}
```

**Operations**: `percent_of`, `percentage_change`, `what_percent`

---

### 55. ETA Calculator
**POST** `/math/eta`

Calculate estimated time of arrival.

**Request:**
```json
{
  "totalItems": 1000,
  "completedItems": 250,
  "elapsedTime": 3600,
  "unit": "seconds"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "eta": 10800,
    "remainingTime": 7200,
    "estimatedCompletion": "2025-01-07T15:00:00Z",
    "itemsPerSecond": 0.0694
  }
}
```

---

### 56. Chronometer
**POST** `/math/chronometer/start`

Start chronometer (returns session ID).

**POST** `/math/chronometer/stop`

Stop chronometer.

**POST** `/math/chronometer/lap`

Record lap time.

---

### 57. Benchmark Builder
**POST** `/math/benchmark`

Build and run performance benchmarks.

**Request:**
```json
{
  "iterations": 10000,
  "operation": "sort",
  "data": [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "averageTime": 0.0234,
    "minTime": 0.0189,
    "maxTime": 0.0456,
    "iterations": 10000,
    "unit": "ms"
  }
}
```

---

## Network & System

### 58. IPv4 Address Converter
**POST** `/network/ipv4/convert`

Convert IPv4 addresses to different formats.

**Request:**
```json
{
  "ip": "192.168.1.1"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "dotted": "192.168.1.1",
    "decimal": 3232235777,
    "hexadecimal": "0xC0A80101",
    "binary": "11000000101010000000000100000001"
  }
}
```

---

### 59. IPv4 Subnet Calculator
**POST** `/network/ipv4/subnet`

Calculate subnet information.

**Request:**
```json
{
  "ip": "192.168.1.0",
  "cidr": 24
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "networkAddress": "192.168.1.0",
    "broadcastAddress": "192.168.1.255",
    "subnetMask": "255.255.255.0",
    "cidr": 24,
    "wildcard": "0.0.0.255",
    "firstHost": "192.168.1.1",
    "lastHost": "192.168.1.254",
    "hostCount": 254,
    "ipClass": "C"
  }
}
```

---

### 60. IPv4 Range Expander
**POST** `/network/ipv4/expand`

Expand IP ranges to individual IPs.

**Request:**
```json
{
  "range": "192.168.1.1-192.168.1.5"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ips": ["192.168.1.1", "192.168.1.2", "192.168.1.3", "192.168.1.4", "192.168.1.5"],
    "count": 5
  }
}
```

---

### 61. IPv6 ULA Generator
**POST** `/network/ipv6/ula`

Generate IPv6 Unique Local Addresses.

**Request:**
```json
{
  "count": 1
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "addresses": ["fd12:3456:789a::/48"]
  }
}
```

---

### 62. MAC Address Generator
**POST** `/network/mac/generate`

Generate random MAC addresses.

**Request:**
```json
{
  "count": 5,
  "separator": ":",
  "uppercase": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "addresses": ["00:1B:63:84:45:E6", "00:1B:63:84:45:E7", "..."]
  }
}
```

---

### 63. MAC Address Lookup
**POST** `/network/mac/lookup`

Look up MAC address vendor information.

**Request:**
```json
{
  "mac": "00:1B:63:84:45:E6"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "vendor": "Apple, Inc.",
    "prefix": "00:1B:63",
    "country": "United States"
  }
}
```

---

### 64. User Agent Parser
**POST** `/network/user-agent/parse`

Parse and analyze user agent strings.

**Request:**
```json
{
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "browser": "Chrome",
    "version": "91.0.4472.124",
    "os": "Windows",
    "osVersion": "10",
    "platform": "Desktop",
    "engine": "Blink"
  }
}
```

---

### 65. Device Information
**GET** `/network/device-info`

Get server/system device information (limited for privacy).

**Response:**
```json
{
  "success": true,
  "data": {
    "serverTime": "2025-01-07T12:00:00Z",
    "timezone": "UTC"
  }
}
```

---

### 66. Chmod Calculator
**POST** `/network/chmod`

Calculate Unix file permissions.

**Request:**
```json
{
  "mode": "755"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "octal": "755",
    "symbolic": "rwxr-xr-x",
    "owner": "rwx",
    "group": "r-x",
    "others": "r-x",
    "description": "Owner: read, write, execute; Group: read, execute; Others: read, execute"
  }
}
```

---

### 67. Random Port Generator
**POST** `/network/port/random`

Generate random port numbers.

**Request:**
```json
{
  "count": 5,
  "min": 1024,
  "max": 65535,
  "excludeWellKnown": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ports": [12345, 23456, 34567, 45678, 56789]
  }
}
```

---

### 68. Keycode Info
**POST** `/network/keycode`

Get keyboard key codes and event info.

**Request:**
```json
{
  "key": "a"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "key": "a",
    "keyCode": 65,
    "code": "KeyA",
    "which": 65
  }
}
```

---

## Text Processing

### 69. Text Statistics
**POST** `/text/statistics`

Analyze text statistics.

**Request:**
```json
{
  "text": "Hello world. This is a test."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "characters": 28,
    "charactersWithoutSpaces": 23,
    "words": 6,
    "sentences": 2,
    "paragraphs": 1,
    "lines": 1,
    "readingTime": "0.03 minutes",
    "speakingTime": "0.02 minutes"
  }
}
```

---

### 70. Text Diff
**POST** `/text/diff`

Compare two texts and show differences.

**Request:**
```json
{
  "text1": "Hello world",
  "text2": "Hello there"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "changes": [
      {
        "type": "removed",
        "value": "world",
        "position": 6
      },
      {
        "type": "added",
        "value": "there",
        "position": 6
      }
    ],
    "similarity": 0.54
  }
}
```

---

### 71. Lorem Ipsum Generator
**POST** `/text/lorem-ipsum`

Generate placeholder text.

**Request:**
```json
{
  "count": 3,
  "unit": "paragraphs",
  "startWithLorem": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "text": "Lorem ipsum dolor sit amet..."
  }
}
```

**Units**: `words`, `sentences`, `paragraphs`

---

### 72. ASCII Text Drawer
**POST** `/text/ascii-art`

Draw text with ASCII art fonts.

**Request:**
```json
{
  "text": "HELLO",
  "font": "standard"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ascii": " _   _ _____ _     _     ___  \n| | | | ____| |   | |   / _ \\ \n..."
  }
}
```

---

### 73. String Obfuscator
**POST** `/text/obfuscate`

Obfuscate strings for code protection.

**Request:**
```json
{
  "text": "secret",
  "method": "base64"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "obfuscated": "c2VjcmV0",
    "method": "base64"
  }
}
```

---

### 74. Regex Tester
**POST** `/text/regex/test`

Test regular expressions.

**Request:**
```json
{
  "pattern": "\\d+",
  "text": "There are 123 apples",
  "flags": "g"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "matches": ["123"],
    "matchCount": 1,
    "isValid": true
  }
}
```

---

### 75. Regex Memo
**GET** `/text/regex/cheatsheet`

Get regular expression reference.

**Response:**
```json
{
  "success": true,
  "data": {
    "patterns": [
      {
        "pattern": "\\d",
        "description": "Any digit",
        "example": "\\d+ matches 123"
      }
    ]
  }
}
```

---

### 76. Crontab Generator
**POST** `/text/crontab/generate`

Generate and explain cron expressions.

**Request:**
```json
{
  "expression": "0 0 * * *"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "expression": "0 0 * * *",
    "description": "At 00:00 every day",
    "nextRuns": [
      "2025-01-08T00:00:00Z",
      "2025-01-09T00:00:00Z"
    ]
  }
}
```

**POST** `/text/crontab/parse`

Parse cron expression.

---

### 77. Email Normalizer
**POST** `/text/email/normalize`

Normalize and validate email addresses.

**Request:**
```json
{
  "email": "John.Doe+tag@EXAMPLE.COM"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "normalized": "john.doe@example.com",
    "valid": true,
    "localPart": "john.doe",
    "domain": "example.com"
  }
}
```

---

### 78. Phone Parser
**POST** `/text/phone/parse`

Parse and format phone numbers.

**Request:**
```json
{
  "phone": "+1-234-567-8900",
  "country": "US"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "international": "+1 234 567 8900",
    "national": "(234) 567-8900",
    "e164": "+12345678900",
    "country": "US",
    "type": "FIXED_LINE_OR_MOBILE"
  }
}
```

---

### 79. Numeronym Generator
**POST** `/text/numeronym`

Generate numeronyms.

**Request:**
```json
{
  "text": "internationalization"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "numeronym": "i18n",
    "original": "internationalization",
    "length": 20
  }
}
```

---

### 80. Safelink Decoder
**POST** `/text/safelink/decode`

Decode Microsoft SafeLinks.

**Request:**
```json
{
  "url": "https://nam02.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "decoded": "https://example.com",
    "isSafelink": true
  }
}
```

---

### 81. IBAN Validator
**POST** `/text/iban/validate`

Validate and parse IBAN numbers.

**Request:**
```json
{
  "iban": "GB82 WEST 1234 5698 7654 32"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "iban": "GB82WEST12345698765432",
    "country": "GB",
    "countryName": "United Kingdom",
    "bban": "WEST12345698765432",
    "bankCode": "WEST",
    "accountNumber": "12345698765432"
  }
}
```

---

### 82. URL Parser
**POST** `/text/url/parse`

Parse and analyze URLs.

**Request:**
```json
{
  "url": "https://user:pass@example.com:8080/path?query=value#hash"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "protocol": "https:",
    "host": "example.com:8080",
    "hostname": "example.com",
    "port": "8080",
    "pathname": "/path",
    "search": "?query=value",
    "hash": "#hash",
    "username": "user",
    "password": "pass",
    "origin": "https://example.com:8080"
  }
}
```

---

### 83. Emoji Picker
**GET** `/text/emoji`

Get emoji list.

**Response:**
```json
{
  "success": true,
  "data": {
    "emojis": [
      {
        "emoji": "😀",
        "name": "grinning face",
        "category": "smileys",
        "keywords": ["happy", "smile"]
      }
    ]
  }
}
```

**GET** `/text/emoji/search?q=happy`

Search emojis.

---

### 84. Git Memo
**GET** `/text/git/cheatsheet`

Get Git commands reference.

**Response:**
```json
{
  "success": true,
  "data": {
    "commands": [
      {
        "command": "git init",
        "description": "Initialize a new Git repository",
        "category": "setup"
      }
    ]
  }
}
```

---

### 85. Archive Creator
**POST** `/text/archive/create`

Create ZIP archives from files (not implemented in static version - requires backend).

---

### 86. PDF Signature Checker
**POST** `/text/pdf/check-signature`

Check PDF digital signatures (requires backend processing).

---

## Media Tools

### 87. Camera Recorder
Not applicable for backend API (client-side only).

---

### 88. Image Compressor
**POST** `/media/image/compress`

Compress images.

**Request:**
```json
{
  "image": "data:image/png;base64,...",
  "quality": 80,
  "format": "jpeg"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "compressed": "data:image/jpeg;base64,...",
    "originalSize": 1024000,
    "compressedSize": 256000,
    "compressionRatio": 0.75
  }
}
```

---

### 89. Video Compressor
**POST** `/media/video/compress`

Compress video files (requires backend processing with FFmpeg).

**Request:**
```json
{
  "video": "base64-encoded-video",
  "quality": "medium",
  "format": "mp4"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "compressed": "base64-encoded-compressed-video",
    "originalSize": 10240000,
    "compressedSize": 2560000,
    "compressionRatio": 0.75
  }
}
```

---

## Rate Limiting

All endpoints are subject to rate limiting:
- **Limit**: 100 requests per minute per IP
- **Headers**:
  - `X-RateLimit-Limit`: Maximum requests per window
  - `X-RateLimit-Remaining`: Remaining requests in current window
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

---

## CORS

CORS is enabled for all origins in development. Production will have specific allowed origins.

---

## Versioning

API version is included in the base URL. Breaking changes will result in a new version (e.g., `/v2`).

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/your-repo/it-tools-api
- Email: support@example.com

---

**Last Updated**: 2025-01-07
**API Version**: 1.0.0
