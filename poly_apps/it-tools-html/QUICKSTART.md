# Quick Start Guide

> Get IT Tools Static Frontend up and running in 5 minutes

---

## Option 1: Open Directly (Simplest)

1. Navigate to the folder:
   ```
   D:\programing\core_node\poly_apps\it-tools-html
   ```

2. Double-click `index.html`

3. Your default browser will open the application

⚠️ **Note**: Some features may require a local server (see Option 2)

---

## Option 2: Local Server (Recommended)

### Using Python (Built-in)

```bash
# Navigate to folder
cd D:\programing\core_node\poly_apps\it-tools-html

# Start server
python -m http.server 8000
```

Visit: **http://localhost:8000**

### Using Node.js

```bash
# Install http-server (one-time)
npm install -g http-server

# Navigate to folder
cd D:\programing\core_node\poly_apps\it-tools-html

# Start server
http-server -p 8000
```

Visit: **http://localhost:8000**

### Using PHP

```bash
# Navigate to folder
cd D:\programing\core_node\poly_apps\it-tools-html

# Start server
php -S localhost:8000
```

Visit: **http://localhost:8000**

---

## Option 3: Deploy to Cloud (Production)

### Netlify (Easiest - 2 minutes)

1. Go to https://app.netlify.com
2. Sign up/Login
3. Drag and drop the `it-tools-html` folder
4. Get your live URL: `https://your-site.netlify.app`

### Vercel

```bash
npm install -g vercel
cd D:\programing\core_node\poly_apps\it-tools-html
vercel --prod
```

### CloudFlare Pages

1. Visit https://dash.cloudflare.com
2. Pages → Create a project
3. Upload folder or connect Git
4. Deploy

---

## Configuration

### Set API Base URL

**Default**: `https://api.si.12gm.com/it-tools/v1`

**To Change**:

1. Click the ⚙️ **Settings** icon (top right)
2. Enter your API URL
3. Click **Save Settings**

**Or Edit Config File**:

In `config.js`, line 6:
```javascript
API_BASE_URL: 'https://your-api-domain.com/v1'
```

All API endpoints and parameters are centralized in `config.js` for easy configuration.

---

## File Structure

```
it-tools-html/
├── index.html              ← Main page (open this)
├── config.js               ← Centralized configuration (API endpoints, params)
├── app.js                  ← App logic
├── tools.js                ← Tool data generator
├── tool-implementations.js ← Tool UIs (part 1)
├── tool-implementations-extended.js ← Tool UIs (part 2)
│
├── assets/                 ← Local static resources (fully offline)
│   ├── js/                 ← JavaScript libraries
│   ├── css/                ← CSS styles
│   └── webfonts/           ← Font files
│
├── API_DOCUMENTATION.md    ← Complete API specs
├── README.md               ← Full documentation
├── BACKEND_GUIDE.md        ← Backend implementation guide
├── QUICKSTART.md           ← This file
├── PROJECT_SUMMARY.md      ← Project overview
│
└── IMPLEMENTATION_STATUS.md ← Backend implementation status
```

---

## Testing the Application

### 1. Open the Application

After starting the server, you should see:
- Header with "IT Tools" logo
- Search bar
- Category filters (Crypto, Converters, Web Dev, etc.)
- Grid of tool cards

### 2. Try a Tool

Click on any tool card, for example:
- **Hash Text** - Try hashing "hello world"
- **Base64 Converter** - Encode/decode text
- **UUID Generator** - Generate unique IDs
- **JSON Viewer** - Format JSON data
- **QR Code Generator** - Create QR codes

### 3. Test Search

Type in the search bar:
- "hash" → Shows hash-related tools
- "json" → Shows JSON tools
- "convert" → Shows converters

### 4. Test Filters

Click category buttons:
- 🔐 Crypto & Security (12 tools)
- 🔄 Converters (25 tools)
- 🌐 Web Dev (15 tools)
- etc.

---

## Backend Setup (For Backend Developers)

### Quick Backend Test Server

If you need to test with a local backend:

1. See `BACKEND_GUIDE.md` for complete instructions

2. Quick Node.js example:

```javascript
// test-server.js
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// Hash endpoint
app.post('/crypto/hash', (req, res) => {
  const { text, algorithm = 'sha256' } = req.body;
  const hash = crypto.createHash(algorithm).update(text).digest('hex');
  res.json({
    success: true,
    data: { algorithm, hash },
    timestamp: new Date().toISOString()
  });
});

app.listen(3000, () => console.log('API running on http://localhost:3000'));
```

3. Run:
```bash
node test-server.js
```

4. Update frontend API URL to `http://localhost:3000`

---

## Troubleshooting

### Issue: "API Error" messages

**Solution**:
- Check if backend API is running
- Verify API base URL in settings
- Check browser console for CORS errors

### Issue: Styles not loading

**Solution**:
- Ensure internet connection (CDN resources)
- Check browser console for errors
- Try hard refresh: `Ctrl + Shift + R`

### Issue: Tools not appearing

**Solution**:
- Check browser console for JavaScript errors
- Ensure all files are in the same directory
- Try different browser

### Issue: 404 on deployment

**Solution**:
- Configure SPA routing (see `DEPLOYMENT.md`)
- For Nginx: `try_files $uri /index.html;`
- For Apache: Check `.htaccess`

---

## Next Steps

### For Frontend Use:
1. ✅ Start local server
2. ✅ Open browser
3. ✅ Configure API URL
4. ✅ Test tools
5. ⏳ Deploy to production

### For Development:
1. ✅ Read `README.md`
2. ✅ Review `API_DOCUMENTATION.md`
3. ⏳ Set up backend (see `BACKEND_GUIDE.md`)
4. ⏳ Implement API endpoints
5. ⏳ Deploy both frontend and backend

### For Production:
1. ✅ Choose deployment platform
2. ⏳ Deploy frontend (see `DEPLOYMENT.md`)
3. ⏳ Deploy backend
4. ⏳ Configure domain & SSL
5. ⏳ Set up monitoring

---

## Resources

### Documentation
- 📘 **README.md** - Complete documentation
- 📗 **API_DOCUMENTATION.md** - All 88+ API endpoints
- 📙 **BACKEND_GUIDE.md** - Backend implementation
- 📕 **DEPLOYMENT.md** - Deployment guide
- 📊 **PROJECT_SUMMARY.md** - Project overview

### External Links
- [Alpine.js Docs](https://alpinejs.dev)
- [Tailwind CSS Docs](https://tailwindcss.com)
- [Original IT Tools](https://github.com/CorentinTh/it-tools)

---

## Support

### Common Questions

**Q: Do I need Node.js to run this?**
A: No, for frontend only. Just open index.html or use any HTTP server.

**Q: Where is the backend code?**
A: Backend needs to be implemented separately. See `BACKEND_GUIDE.md` for examples.

**Q: Can I use this without internet?**
A: Yes! All resources (Tailwind, Alpine.js, Font Awesome) are now hosted locally in the `assets/` folder. Fully offline capable.

**Q: How do I add new tools?**
A: See "Development Guide" in `README.md`

**Q: Is the API included?**
A: No, only frontend. API specs are in `API_DOCUMENTATION.md`. Implementation is needed.

---

## Quick Commands Reference

```bash
# Local server (Python)
python -m http.server 8000

# Local server (Node.js)
npx http-server -p 8000

# Deploy to Netlify
netlify deploy --prod --dir=.

# Deploy to Vercel
vercel --prod

# Build Docker image
docker build -t it-tools-html .

# Run Docker container
docker run -d -p 80:80 it-tools-html
```

---

## Success Checklist

- [ ] Application loads in browser
- [ ] Search functionality works
- [ ] Category filters work
- [ ] At least one tool opens
- [ ] Settings can be changed
- [ ] API URL is configured
- [ ] No console errors

---

**You're all set! 🎉**

For detailed information, see the other documentation files.

---

**Last Updated**: 2025-01-07
