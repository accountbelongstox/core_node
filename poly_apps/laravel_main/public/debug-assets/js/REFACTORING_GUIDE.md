# JS Refactoring Guide

## Architecture Principles

1. **No HTML Generation in JS**
   - All HTML in template files
   - Use `TemplateUtils.loadAndRender()` to render templates
   - JS only handles API calls and JSON data

2. **Code Reuse**
   - Use `TemplateUtils` for template operations
   - Use `ApiUtils` for API data processing
   - Use `DomUtils` for DOM manipulation
   - Use `ApiClient` for API calls

3. **Template System**
   - All templates in `/debug-assets/debug-tools/templates/`
   - Templates use Tailwind CSS classes
   - Use `{variable}` syntax for data binding

4. **Event Handling**
   - Use event delegation when possible
   - Attach listeners to existing elements only
   - No dynamic event binding to generated elements

## Refactoring Steps

1. **Identify HTML Generation**
   ```javascript
   // BAD
   const div = document.createElement('div');
   div.innerHTML = '<span>Hello</span>';
   
   // GOOD
   const template = await TemplateUtils.loadTemplate('/path/to/template.html');
   const div = TemplateUtils.renderToElement(template, { text: 'Hello' });
   ```

2. **Extract to Template**
   - Create HTML template file
   - Use Tailwind CSS classes
   - Use `{variable}` for data binding

3. **Update JS Code**
   - Remove `createElement` calls
   - Remove `innerHTML` assignments
   - Use `TemplateUtils.loadAndRender()`
   - Use `DomUtils` for DOM operations

4. **Test**
   - Verify functionality
   - Check Tailwind CSS styling
   - Ensure no console errors

## Example

### Before
```javascript
function renderItem(data) {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `<span>${data.name}</span>`;
    return div;
}
```

### After
```javascript
async function renderItem(data) {
    const template = await TemplateUtils.loadTemplate('/templates/item.html');
    return TemplateUtils.renderToElement(template, { name: data.name });
}
```

Template file (`/templates/item.html`):
```html
<div class="item bg-white p-4 rounded">
    <span class="text-gray-900">{name}</span>
</div>
```
