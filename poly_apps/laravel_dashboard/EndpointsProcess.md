
# API Endpoint Implementation Progress

> Updated: 2025-05-20

## Summary
- **Total Endpoints Defined in Docs**: 40+
- **Total Endpoints Implemented in Client**: 40+
- **Mock Services Status**: Active & Comprehensive

## Implementation Details

### System API
- [x] `/api_info` (GET)
- [x] `/csrf-token` (GET)
- [x] Code Browser File Ops (GET/POST)
- [x] Static Resource Ops (GET/POST)

### Auth API
- [x] `/api/login` (POST)
- [x] `/api/register` (POST)
- [x] `/api/logout` (POST)

### ITTools
- **Crypto**: 
  - [x] Hash, Bcrypt, UUID, ULID, Token, Basic Auth, HMAC, RSA, OTP, Password Analysis, AES Encrypt/Decrypt
- **Converter**:
  - [x] Base64, URL, Case, JSON/YAML, DateTime, Temperature, Roman/Arabic
- **Web**:
  - [x] JSON Prettify/Minify, JWT Parse, Markdown to HTML, SQL Format, XML Format, YAML Format, QR Code, WiFi QR
- **Advanced**:
  - [x] Image Compress, Image Crop, PDF Split

### MCP (Media Control Protocol)
- **Screenshots**:
  - [x] Upload, Latest, Search
- **Task Dispatch**:
  - [x] Categories, Add to Queue
- **Voice Subtitle**:
  - [x] Add to Queue, Get Queue, Get Current, Controls (Next/Prev)

### Developer Utilities UI Alignment
- [x] Mapped `TOOL_UI_SCHEMAS` to all key ITTools endpoints.
- [x] Universal Tool handles inputs (File, Text, Color, Select) and outputs (Image, HTML, JSON).
- [x] Expanded Categories to match functionality (Crypto, Formatters, Web).

## Next Steps
- Implement `VoiceSubtitle` specific UI component for better playback control (currently relying on generic API tester).
- Add specific UI for `CodeBrowser` to use the new API endpoints instead of just mock constants (Mock logic is ready in `systemMock`).
