# Local Assets

This directory contains all required JavaScript and CSS libraries for offline usage.

## Libraries Included

### JavaScript (447 KB)

| Library | Version | Size | Purpose |
|---------|---------|------|---------|
| Alpine.js | 3.13.3 | 43 KB | Reactive framework |
| Tailwind CSS | 3.4.1 | 404 KB | CSS framework |

### CSS (101 KB)

| Library | Version | Size | Purpose |
|---------|---------|------|---------|
| Font Awesome | 6.5.1 | 101 KB | Icon library |

### Fonts (293 KB)

| File | Size | Purpose |
|------|------|---------|
| fa-solid-900.woff2 | 153 KB | Solid icons |
| fa-regular-400.woff2 | 25 KB | Regular icons |
| fa-brands-400.woff2 | 115 KB | Brand icons |

## Total Size

**Total**: ~841 KB (uncompressed)

## Directory Structure

```
assets/
├── css/
│   └── fontawesome.min.css          (101 KB)
├── js/
│   ├── alpine.min.js                (43 KB)
│   └── tailwind.min.js              (404 KB)
└── webfonts/
    ├── fa-brands-400.woff2          (115 KB)
    ├── fa-regular-400.woff2         (25 KB)
    └── fa-solid-900.woff2           (153 KB)
```

## Usage

All libraries are automatically loaded from local files:

```html
<!-- Tailwind CSS -->
<script src="assets/js/tailwind.min.js"></script>

<!-- Alpine.js -->
<script defer src="assets/js/alpine.min.js"></script>

<!-- Font Awesome -->
<link rel="stylesheet" href="assets/css/fontawesome.min.css">
```

## Offline Support

All dependencies are now local, enabling:
- ✅ Fully offline usage
- ✅ No external CDN dependencies
- ✅ Faster loading (no network requests)
- ✅ Better privacy (no third-party tracking)
- ✅ More reliable (no CDN downtime)

## Updating Libraries

To update libraries to newer versions:

### Alpine.js
```bash
cd assets/js
wget -O alpine.min.js https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js
```

### Tailwind CSS
```bash
cd assets/js
wget -O tailwind.min.js https://cdn.tailwindcss.com
```

### Font Awesome
```bash
# CSS
cd assets/css
wget -O fontawesome.min.css https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css

# Fonts
cd assets/webfonts
wget https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/webfonts/fa-solid-900.woff2
wget https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/webfonts/fa-regular-400.woff2
wget https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/webfonts/fa-brands-400.woff2

# Update font paths
cd assets/css
sed -i 's|https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/webfonts/|../webfonts/|g' fontawesome.min.css
```

## License

- **Alpine.js**: MIT License
- **Tailwind CSS**: MIT License
- **Font Awesome**: Free version (Font Awesome Free License)

## Notes

- Font paths in `fontawesome.min.css` have been updated to point to local `../webfonts/` directory
- All files are minified for production use
- No source maps included (to reduce size)
