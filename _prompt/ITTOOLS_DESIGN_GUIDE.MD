# IT Tools Design Guide

> **Merged from**: `nust_ittool设计.txt`, `ITTOOLE工具设计.md`
> **Note**: `nust_ittool设计.txt` should be `nuxt_ittool设计.txt` (typo corrected)
> **Last Updated**: 2025-01-XX

## Table of Contents
1. [Tool List](#tool-list)
2. [UI Design](#ui-design)
3. [API Integration](#api-integration)
4. [Nuxt Integration](#nuxt-integration)
5. [Development Progress](#development-progress)

---

## Tool List

### AI Translation
- AI translation tool

### 🖼️ Image Tools
- Image Converter
- Image Compressor
- Image Resizer
- Image Cropper
- Image Rotator/Flipper
- Color Picker from Image

### 📄 PDF & Document Tools
- PDF Merger
- PDF Splitter
- PDF Compressor
- PDF Password Protector
- Unlock PDF
- PDF Watermark
- PDF Page Rotator
- PDF to JPG/PNG
- Image to PDF

### 🧮 Calculator Tools
- Age Calculator
- BMI Calculator
- Loan EMI Calculator
- GST Calculator
- Percentage Calculator
- Number to Words
- Unit Converter
- Currency Converter

### 🎨 Color Tools
- HEX to RGB Converter
- Gradient Generator
- Contrast Checker
- Palette Generator
- Color Blindness Simulator

### ✍️ Text Tools Advanced
- Remove Duplicate Lines
- Text Sorter
- Text Reverser
- Word Counter (SEO)
- Keyword Density Checker
- Text Encryptor/Decryptor

### 📈 SEO & Marketing
- Meta Tag Analyzer
- Keyword Density Checker
- Word Counter (Blog)

### 🔧 Utility Tools
- QR Code Scanner
- Barcode Generator
- Time Zone Converter
- Password Generator
- Password Strength Checker

### 🔐 Crypto & Security
- Token Generator
- Hash Generator
- Bcrypt Hash/Verify
- UUID Generator
- ULID Generator
- HMAC Generator
- Password Strength Analyzer
- Basic Auth Generator
- BIP39 Passphrase
- RSA Key Pair

### 🔄 Converters
- Base64 Encoder/Decoder
- URL Encoder/Decoder
- HTML Entities Encoder
- Case Converter
- Color Converter
- Timestamp Converter
- Integer Base Converter
- Roman Numeral Converter
- Text to NATO Alphabet
- Text to ASCII Binary
- JSON ⇄ YAML
- JSON ⇄ XML
- Markdown to HTML

### 📝 Text Tools
- Text Diff
- Text Statistics
- Lorem Ipsum Generator
- Slugify String
- Emoji Picker
- String Obfuscator
- Numeronym Generator
- ASCII Art Generator

### ✨ Formatters
- JSON Formatter
- XML Formatter
- YAML Formatter
- SQL Formatter
- HTML Formatter
- CSS Formatter

### 🌐 Web Tools
- URL Parser
- Query String Parser
- JWT Parser
- User Agent Parser
- HTTP Status Codes
- MIME Types
- Device Information
- Keycode Info

### 🎲 Generators
- QR Code Generator
- WiFi QR Code
- SVG Placeholder
- Random Port
- Crontab Generator
- Open Graph Meta
- OTP Code Generator

### 🔢 Math & Calc
- Math Evaluator
- Percentage Calculator
- ETA Calculator
- Temperature Converter
- Unit Converter

### 🌍 Network Tools
- IPv4 Subnet Calculator
- IPv4 Converter
- IPv6 ULA Generator
- MAC Address Lookup
- MAC Generator

### 💻 Development
- Regex Tester
- Regex Cheatsheet
- Git Cheatsheet
- Chmod Calculator
- Docker Run → Compose
- JSON Diff
- JSON to CSV

### 📊 Data Tools
- Phone Parser
- IBAN Validator
- Email Normalizer

### Other Features
- Browser Automation
- Windows Operations
- Nginx Management

---

## UI Design

### Layout Design

#### Toolbar
- Expandable toolbar on the right
- Tool menu displayed on the right, expandable

#### Online Clipboard
- Designed to be collapsible upward
- Can make room for tool area
- State saved in localStorage
- Persists after refresh
- Always keep Online Clipboard in center area

#### Tool Area Layout
- Upper half of center area: For Online Clipboard
- Lower half of center area: For tools
- Click tool to switch lower half
- Bottom: Sub-menu for categorized tools
- Bottom categorized tools set to small size
- All tools displayed as small table at bottom
- Also categorized

#### Multi-file Upload
- Support multi-file upload
- Display uploaded files

### State Management

- Use localStorage to save state
- State persists after refresh
- Unified state center

### Tool Marking

- Mark all tools as TODO
- Based on derived functionality that should exist
- Open several at once, no need to develop all at once

---

## API Integration

### API Endpoint Configuration

#### Primary API
- `api.si.12gm.com`

#### Secondary API
- `api.si.gm15.com`

#### Local API (Non-HTTPS)
- `local.api.12gm.com`
- `local.api.gm15.com`
- `192.168.2.1`
- `192.168.50.2`

#### Port Configuration
- Local IP port: Default 9003
- Remote API port: Default none
- Added to public configuration, sub-APPs can also extend and change

**Note**: All of these are placed in public configuration, and sub-apps will extend and use this basic configuration

### API Center

#### Endpoint Center File
- Create endpoint center file
- API point key
- Import `services/api.ts` / `mockData.ts`
- Abstract necessary data in mockData
- Call API center
- Return mock data directly when API is unavailable (currently API is set to unavailable)

#### Mock Data
- Extend `mockData.ts` to use multiple files
- Abstract necessary data

#### API Availability Detection
- Use whichever API is available from the above
- Cache in system
- Synchronous detection when checking
- Use globally, when API is available, use as globally available

### Unified HTTP Wrapper

#### Requirements
1. First check if global Nuxt has base class HTTP websocket wrapper
2. Move to correct public area
3. If not, create a powerful wrapper
4. Use unified HTTP wrapper for easy middleware usage

#### Health Check
- Add health check to API-HTTP-websocket wrapper
- When unavailable, put post/get requests in queue
- Wait and retry
- Queue only post requests
- Retry time is 2 seconds

#### CSRF Support
- Support CSRF requests and use in wrapper

### Login System

#### Endpoints
- `api/user`
- `api/register`
- `api/login`

#### UI
- Login area at the top
- Can display account
- Login button, etc.

#### Status
- Add login status at the very top

### Laravel Integration

#### Health Check
- Check `poly_apps\laravel_main` to add a public `/health`
- Affects this project

#### Interaction Instructions
- Note in Nuxt how to do basic interaction with Laravel

---

## Nuxt Integration

### Menu System

#### Top Menu
- IT Tools 88+
- Browser Automation
- Windows Operations
- Nginx Management

**Issue**: When in Windows Operations, still cannot switch to others

#### Login Status
- Add login status at the very top

### API Configuration

#### Multi-endpoint Support
- Note that each app can have multiple API endpoints
- Set up a series of APIs according to specifications
- Set up several APIs for Nuxt entire bottom layer first

#### Public Configuration
- All API endpoints placed in public configuration
- Sub-apps will extend and use this basic configuration

### Development Guide

#### Document Location
- `/www/programing/core_node/poly_apps/laravel_main/app/Http/EnvironmentApiInfo/debug_interface_template.html`
- Scan `/debug-assets/js/ittools-menu-config.js` in it

#### Development Progress Guide
- First complete development progress guide for IT Tools 88+
- Should explain where to find corresponding functions and endpoints needed by Nuxt
- Complete development guide is enough, no need to write the code

---

## Development Progress

### Phase 1: UI Design
- [x] Design toolbar layout
- [x] Design Online Clipboard
- [x] Design tool area
- [ ] Implement multi-file upload

### Phase 2: API Center
- [ ] Create endpoint center file
- [ ] Extend mockData.ts
- [ ] Bind existing pages and APIs (login, Developer Utilities)
- [ ] Prompt directly when API is set to unavailable

### Phase 3: Endpoint Alignment
- [ ] Align Developer Utilities and all endpoints
- [ ] Set as TODO first
- [ ] Extend incomplete endpoint center, login/register, bind with API center
- [ ] Extend Developer Utilities UI, bind with API center, align endpoints

### Phase 4: Documentation Update
- [ ] Update API port specification to `/www/programing/core_node/development-guides/NODE_NCORE_GUIDE.md`
- [ ] Use at most 5 lines to describe conflicting parts
- [ ] Update documentation within 5 lines, explaining that unified HTTP wrapper is for easy middleware usage

### Progress Tracking
- Update progress to `EndpointsProcess.md`

---

## Important Notes

### Code Standards
1. **Do NOT rewrite existing code**: Extend on current code
2. **Do NOT delete any files**: Extend incomplete endpoints, bind with API center, but do not delete any files or functionality
3. **Maintain compatibility**: Note not to rewrite current code, but extend on current code

### API Handling
1. **Mock Data**: Return mock data directly when API is unavailable (currently API is set to unavailable)
2. **Endpoint Definition**: Put endpoints in unified endpoint definition center and create MODEL
3. **API Availability**: Use globally, when API is available, use as globally available

### Documentation Maintenance
1. **Do NOT delete documentation**: Also do not delete `API_Endpoints_Documentation_Detailed.md` file
2. **Progress Update**: Update progress to `EndpointsProcess.md`

---

## Related Documents

- `API_Endpoints_Documentation_Detailed.md` - API endpoint detailed documentation
- `EndpointsProcess.md` - Endpoint development progress
- `/www/programing/core_node/development-guides/NODE_NCORE_GUIDE.md` - Nuxt core guide
- `/www/programing/core_node/poly_apps/laravel_main/app/Http/EnvironmentApiInfo/debug_interface_template.html` - Debug interface template

