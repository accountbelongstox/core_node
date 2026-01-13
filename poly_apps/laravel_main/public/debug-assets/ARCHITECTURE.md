# Multi-HTML iframe Framework Architecture

## Core Principles

1. **NO HTML Generation in JS**
   - All HTML in template files
   - JS only handles API calls and JSON data processing
   - Use `TemplateUtils.loadAndRender()` for all HTML rendering

2. **Template System**
   - All templates in `/debug-assets/debug-tools/templates/`
   - Templates use Tailwind CSS classes
   - Use `{variable}` syntax for data binding

3. **iframe Framework**
   - Main page: `debug_interface_template.html`
   - All sections are independent HTML files
   - Sections loaded via iframe: `section-iframe`
   - Each section is self-contained with its own scripts

4. **Code Reuse**
   - `TemplateUtils`: Template loading and rendering
   - `ApiUtils`: API data processing
   - `DomUtils`: DOM manipulation (no HTML generation)
   - `ApiClient`: Unified API client

5. **All Code in English**
   - No Chinese comments or variable names
   - All user-facing text in English

## File Structure

```
public/debug-assets/
├── debug_interface_template.html  # Main page with iframe
├── debug-tools/
│   ├── sections/                  # Section HTML files (loaded in iframe)
│   │   ├── api-testing-section.html
│   │   ├── mcp-manager-section.html
│   │   └── ...
│   └── templates/                 # HTML templates
│       ├── api-item.html
│       ├── feature-docs.html
│       └── ...
└── js/
    ├── template-utils.js          # Template system
    ├── api-utils.js                # API data processing
    ├── dom-utils.js                # DOM operations
    ├── api-client.js               # API client
    └── [section]-section.js        # Section logic (API only)
```

## Refactoring Pattern

1. Extract all HTML to template files
2. Use `TemplateUtils.loadAndRender()` instead of `createElement`
3. Use `DomUtils` for DOM operations
4. Use `ApiUtils` for data processing
5. Remove all `innerHTML` and `createElement` calls
