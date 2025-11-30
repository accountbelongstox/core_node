# ITTools Multi-File Architecture Specification

## File Size Rules

**CRITICAL**: All HTML/JS/CSS files MUST NOT exceed 500 lines to maintain code quality and readability.

## File Naming Convention

### JavaScript Files
```
ittools-impl-{category}.js  - Category implementations
```

### Categories & Files
1. **ittools-impl-images.js** (< 500 lines)
   - Image Compressor
   - Image Cropper
   - Image Resizer
   - Image Rotator/Flipper

2. **ittools-impl-crypto.js** (< 500 lines)
   - Bcrypt Tool
   - ULID Generator
   - BIP39 Generator
   - RSA Key Pair Generator
   - OTP Generator

3. **ittools-impl-converters.js** (< 500 lines)
   - Base Converter
   - Roman Numeral Converter
   - JSON ⇄ YAML
   - JSON ⇄ XML
   - XML ⇄ JSON
   - Temperature Converter
   - Markdown to HTML

4. **ittools-impl-formatters.js** (< 500 lines)
   - XML Formatter
   - YAML Formatter
   - SQL Formatter
   - JSON Formatter

5. **ittools-impl-web.js** (< 500 lines)
   - JWT Parser
   - User Agent Parser
   - HTTP Status Codes
   - MIME Types
   - Query String Parser

6. **ittools-impl-generators.js** (< 500 lines)
   - QR Code Generator
   - WiFi QR Code
   - Random Port Generator
   - OTP Code Generator

7. **ittools-impl-text.js** (< 500 lines)
   - Emoji Picker
   - String Obfuscator
   - Numeronym Generator
   - Text Diff
   - Lorem Ipsum

8. **ittools-impl-dev.js** (< 500 lines)
   - Chmod Calculator
   - Regex Tester
   - ETA Calculator

## HTML Import Order

```html
<!-- Core Framework (Load First) -->
<script src="/debug-assets/js/ittools-menu-config.js"></script>
<script src="/debug-assets/js/ittools-core.js"></script>
<script src="/debug-assets/js/ittools-client-tools.js"></script>
<script src="/debug-assets/js/ittools-advanced-tools.js"></script>
<script src="/debug-assets/js/ittools-tools.js"></script>

<!-- Category Implementations (Load After Core) -->
<script src="/debug-assets/js/ittools-impl-images.js"></script>
<script src="/debug-assets/js/ittools-impl-crypto.js"></script>
<script src="/debug-assets/js/ittools-impl-converters.js"></script>
<script src="/debug-assets/js/ittools-impl-formatters.js"></script>
<script src="/debug-assets/js/ittools-impl-web.js"></script>
<script src="/debug-assets/js/ittools-impl-generators.js"></script>
<script src="/debug-assets/js/ittools-impl-text.js"></script>
<script src="/debug-assets/js/ittools-impl-dev.js"></script>
```

## File Structure Template

```javascript
// ============================================
// NAMESPACE: ITTools.Implementations.{Category}
// FILE: ittools-impl-{category}.js  
// PURPOSE: {Category} tool implementations
// ============================================

// Tool 1 Registration
ITTools.Tools.Registry.register('tool-id', {
    name: 'Tool Name',
    category: 'category',
    render() {
        return `<!-- HTML -->`
    }
});

// Tool 1 Implementation
ITTools.Implementations.ToolName = {
    method1() { },
    method2() { }
};

// Tool 2...
// Tool 3...

console.log('ITTools {Category} Implementations loaded');
```

## Backend Controller Architecture

Each category should have corresponding backend controllers:

```
app/Apps/ItToolsV1/
├── ItToolsV1Controllers/
│   ├── ItToolsV1BaseCtl.php          (Base controller, < 200 lines)
│   ├── ItToolsV1UnifiedCtl.php       (Simple tools, < 500 lines)
│   └── ItToolsV1AdvancedCtl.php      (Complex tools, < 500 lines)
├── ItToolsV1Utils/
│   ├── ItToolsV1CommonUtil.php       (< 500 lines)
│   ├── ItToolsV1ImageUtil.php        (< 300 lines)
│   ├── ItToolsV1CalculatorUtil.php   (< 300 lines)
│   └── ItToolsV1PdfUtil.php          (< 400 lines)
```

## CSS File Architecture

```
assets/css/
├── ittools-layout.css          (< 500 lines - Main layout)
├── ittools-components.css      (< 500 lines - Reusable components)
└── ittools-themes.css          (< 300 lines - Colors & themes)
```

## Benefits

1. **Maintainability**: Each file focuses on one category
2. **Performance**: Load only needed files
3. **Collaboration**: Multiple developers can work simultaneously
4. **Debugging**: Easier to locate issues
5. **Code Review**: Smaller files are easier to review
6. **Version Control**: Cleaner git diffs

## Migration Strategy

When a file exceeds 450 lines (warning threshold):
1. Identify logical groups within the file
2. Create new category files
3. Move implementations to new files
4. Update HTML imports
5. Test all tools

## Testing Checklist

After splitting files:
- [ ] All tools render correctly
- [ ] All API calls work
- [ ] No JavaScript console errors
- [ ] No duplicate function definitions
- [ ] File size < 500 lines verified
