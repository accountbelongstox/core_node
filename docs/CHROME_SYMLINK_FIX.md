# Chrome/Puppeteer Symbolic Link Loop Fix

## Problem Description

The error `ELOOP: too many symbolic links encountered, stat '/usr/bin/X11/X11/X11/.../FileCheck-18'` occurs when Chrome/Puppeteer tries to access system binaries but encounters circular symbolic links in the system directories, particularly in `/usr/bin/X11`.

This is a system-level issue where symbolic links create infinite loops, preventing Chrome from properly initializing.

## Root Causes

1. **Circular Symbolic Links**: The `/usr/bin/X11` directory or similar system directories contain symbolic links that point to themselves or create circular references.

2. **Broken X11 Installation**: Improper X11 installation or updates can create problematic symbolic link structures.

3. **FileCheck Binary Issues**: LLVM/Clang tools like `FileCheck` may have circular symbolic links that Chrome encounters during initialization.

## Solutions Implemented

### 1. Enhanced Chrome Path Detection

**File**: `ncore/utils/puppeteer_spider/config/libs/ensureAndFinderChrome.js`

- Added symbolic link loop detection in `findChromeExecutable()`
- Prevents following circular symbolic links
- Skips problematic X11 directories during Chrome search
- Uses `fs.lstatSync()` and `fs.realpathSync()` to safely handle symbolic links

### 2. Safe File System Scanning

**File**: `ncore/global_vars/tool/common/ffinder.js`

- Enhanced `searchFileInDirectory()` with loop detection
- Tracks visited real paths to prevent infinite recursion
- Skips symbolic links during directory traversal
- Added timeout protection for deep searches

### 3. Symbolic Link Loop Fixer

**File**: `ncore/utils/system/fix_symlink_loops.js`

- Detects circular symbolic links in system directories
- Safely removes problematic symbolic links
- Creates backups before making changes
- Focuses on Chrome-related paths and X11 directories

### 4. Chrome Wrapper with Protection

**File**: `ncore/utils/puppeteer_spider/config/libs/chromeWrapper.js`

- Launches Chrome with environment protection
- Sets clean PATH environment variable
- Adds Chrome arguments to avoid problematic system access
- Provides timeout and error handling for Chrome startup

## Quick Fix Scripts

### Automatic Fix (Recommended)

```bash
# Run the comprehensive fix script
./scripts/fix_chrome_symlink_issue.sh

# Or using Node.js
node scripts/fix_chrome_symlink_issue.js
```

### Manual Fix

```bash
# 1. Check for symbolic link loops
find /usr/bin -name "*FileCheck*" -type l -exec ls -la {} \;

# 2. Check X11 directory
ls -la /usr/bin/X11

# 3. Remove problematic symbolic links (be careful!)
sudo rm /usr/bin/X11  # if it's a circular link

# 4. Test Chrome
google-chrome --version --no-sandbox
```

## Prevention Measures

### 1. Environment Variables

Set these environment variables to bypass problematic paths:

```bash
export CHROME_BIN=/usr/bin/google-chrome-stable
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
```

### 2. Puppeteer Configuration

Use safe Chrome launch options:

```javascript
const browser = await puppeteer.launch({
    headless: true,
    args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions-file-access-check'
    ],
    executablePath: '/usr/bin/google-chrome-stable'
});
```

### 3. System Maintenance

```bash
# Regular system updates
sudo apt update && sudo apt upgrade

# Reinstall Chrome if needed
sudo apt install --reinstall google-chrome-stable

# Check for broken symbolic links
find /usr/bin -type l ! -exec test -e {} \; -print
```

## Troubleshooting

### If Chrome Still Fails to Start

1. **Check Chrome Installation**:
   ```bash
   which google-chrome
   google-chrome --version
   ```

2. **Verify X11 Setup** (for GUI applications):
   ```bash
   echo $DISPLAY
   xhost +local:
   ```

3. **Use Headless Mode**:
   ```javascript
   { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] }
   ```

4. **Check System Logs**:
   ```bash
   journalctl -u display-manager
   dmesg | grep -i chrome
   ```

### WSL-Specific Issues

If using Windows Subsystem for Linux:

```bash
# Install X11 server (like VcXsrv or X410)
export DISPLAY=:0
export LIBGL_ALWAYS_INDIRECT=1
```

## Code Changes Summary

1. **Enhanced Error Handling**: All Chrome-related functions now handle `ELOOP` errors gracefully
2. **Loop Detection**: Added visited path tracking to prevent infinite recursion
3. **Safe Path Resolution**: Use `lstat` instead of `stat` to avoid following problematic links
4. **Automatic Fixing**: Chrome initialization now attempts to fix symbolic link issues automatically
5. **Environment Protection**: Chrome launches with cleaned environment variables

## Testing

After applying the fixes, test with:

```bash
# Test the fix script
./scripts/fix_chrome_symlink_issue.sh

# Test Chrome directly
google-chrome --version --no-sandbox --disable-dev-shm-usage

# Test Puppeteer
node -e "
const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox']});
  console.log('Puppeteer launched successfully!');
  await browser.close();
})();
"
```

## Related Files

- `ncore/utils/puppeteer_spider/config/libs/ensureAndFinderChrome.js` - Chrome path detection
- `ncore/global_vars/tool/common/ffinder.js` - File system scanning
- `ncore/utils/system/fix_symlink_loops.js` - Symbolic link loop fixer
- `scripts/fix_chrome_symlink_issue.sh` - Automated fix script
- `scripts/fix_chrome_symlink_issue.js` - Node.js fix script
