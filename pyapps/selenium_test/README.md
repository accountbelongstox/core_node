# Selenium Test Application

**Version:** 1.0
**Created:** 2025-11-09
**Purpose:** Test and demonstrate PyBrowser ThreadedBrowser library integration with UnifiedLauncher

---

## Overview

This application demonstrates the newly refactored PyBrowser ThreadedBrowser library working as an independent thread through the UnifiedLauncher service orchestration system.

### Key Features
- ✅ ThreadedBrowser integration with UnifiedLauncher
- ✅ Config-based selenium service startup
- ✅ Browser automation in threaded mode
- ✅ Graceful shutdown handling
- ✅ Complete deployment scripts

---

## Quick Start

### 1. Install Dependencies

```powershell
cd pyapps\selenium_test
.\scripts\install.ps1
```

This will install:
- `selenium` - WebDriver automation
- `webdriver-manager` - Automatic driver management
- Check browser installations (Chrome/Edge/Firefox)
- Create screenshot directory

### 2. Validate Deployment

```powershell
.\scripts\deploy.ps1
```

This validates:
- Python and pip installation
- Required packages
- PyCore modules
- File structure
- Browser availability

### 3. Run Application

**Option A: Using start script (recommended)**
```powershell
.\scripts\start.ps1
```

**Option B: Using pymain.py**
```powershell
# From project root
python pymain.py app=selenium_test
```

**Option C: Direct execution**
```powershell
python main.py
```

### 4. Stop Application

Press `Ctrl+C` to gracefully shutdown, or run:
```powershell
.\scripts\stop.ps1
```

---

## Configuration

### Launcher Configuration
**File:** `config/launcher_config.json`

```json
{
  "selenium_service": {
    "browser_type": "chrome",     // chrome, edge, firefox
    "headless": false,             // true for headless mode
    "disable_gpu": true,           // GPU acceleration
    "no_sandbox": true,            // Sandbox mode
    "enabled": true                // Enable service
  },
  "auto_start_all": true,
  "startup_delay": 0.5,
  "graceful_shutdown_timeout": 10
}
```

### Browser Test Configuration
**File:** `config/browser_test_config.json`

```json
{
  "test_urls": [
    "https://google.com",
    "https://github.com",
    "https://stackoverflow.com"
  ],
  "screenshot_dir": "screenshots",
  "test_duration": 30,              // Test duration in seconds
  "enable_screenshots": true,
  "navigation_delay": 3             // Delay between navigations
}
```

---

## How It Works

### Architecture

```
Main Thread (main.py)
    ↓
UnifiedLauncher
    ↓
ServiceThread (selenium_service)
    ↓
ThreadedBrowser (ChromeBrowser)
    ├── Command Queue
    ├── Result Queue
    └── WebDriver Instance
```

### Thread Flow

1. **Application starts** → `main.py:start()`
2. **Load configurations** → JSON files in `config/`
3. **Create launcher** → `UnifiedLauncher(config)`
4. **Start services** → `launcher.start_all()`
5. **Selenium service starts** → `_selenium_service_entry()`
6. **Browser thread created** → `BrowserFactory.create(auto_start=True)`
7. **Browser launches** → Chrome/Edge/Firefox WebDriver
8. **Tests run** → Browser operations in separate thread
9. **Graceful shutdown** → `browser.stop()` + `browser.join()`

### Key Code Flow

**launcher.py:328-379** - Selenium service entry point
```python
def _selenium_service_entry(self, config):
    # Create browser as thread
    browser = BrowserFactory.create(
        browser_type=config.browser_type,
        config=browser_config,
        thread_name='SeleniumService-Browser',
        auto_start=True
    )

    # Wait for ready
    browser.wait_until_ready(timeout=30)

    # Keep running
    while self.services['selenium_service'].running:
        time.sleep(0.1)

    # Cleanup
    browser.stop()
    browser.join()
```

**main.py** - Application entry point
```python
def start():
    app = SeleniumTestApp()

    # Load config
    launcher_config = app.load_config()

    # Create launcher
    app.launcher = UnifiedLauncher(launcher_config)

    # Start services (selenium_service)
    app.launcher.start_all()

    # Run tests
    app.run_browser_tests()

    # Cleanup
    app.stop()
```

---

## File Structure

```
pyapps/selenium_test/
├── README.md                       # This file
├── development_analysis.md         # Pre-development analysis
├── main.py                         # Entry point with start()
├── config/
│   ├── launcher_config.json        # Launcher configuration
│   └── browser_test_config.json    # Test-specific config
├── scripts/
│   ├── start.ps1                   # Start application
│   ├── stop.ps1                    # Stop processes
│   ├── install.ps1                 # Install dependencies
│   └── deploy.ps1                  # Validate deployment
└── screenshots/                    # Screenshot output (auto-created)
```

---

## Common Tasks

### Change Browser Type

Edit `config/launcher_config.json`:
```json
{
  "selenium_service": {
    "browser_type": "edge",  // Change to: chrome, edge, firefox
    ...
  }
}
```

### Enable Headless Mode

Edit `config/launcher_config.json`:
```json
{
  "selenium_service": {
    "headless": true,  // Run without visible browser window
    ...
  }
}
```

### Modify Test URLs

Edit `config/browser_test_config.json`:
```json
{
  "test_urls": [
    "https://your-url-1.com",
    "https://your-url-2.com"
  ]
}
```

### Change Test Duration

Edit `config/browser_test_config.json`:
```json
{
  "test_duration": 60,  // Seconds to keep browser running
  ...
}
```

---

## Troubleshooting

### Browser doesn't start

**Check browser installation:**
```powershell
.\scripts\deploy.ps1
```

**Verify browser paths:**
- Chrome: `C:\Program Files\Google\Chrome\Application\chrome.exe`
- Edge: `C:\Program Files\Microsoft\Edge\Application\msedge.exe`
- Firefox: `C:\Program Files\Mozilla Firefox\firefox.exe`

### WebDriver errors

**Update webdriver-manager:**
```powershell
pip install --upgrade webdriver-manager
```

**Clear driver cache:**
```powershell
# Delete cached drivers
Remove-Item -Recurse -Force $env:USERPROFILE\.wdm
```

### Process won't stop

**Force kill processes:**
```powershell
.\scripts\stop.ps1
```

**Manual cleanup:**
```powershell
# Kill Python processes
Get-Process python | Where-Object {$_.CommandLine -like "*selenium_test*"} | Stop-Process -Force

# Kill driver processes
Get-Process chromedriver, geckodriver, msedgedriver -ErrorAction SilentlyContinue | Stop-Process -Force
```

### Import errors

**Verify Python path:**
```powershell
python -c "import sys; print('\n'.join(sys.path))"
```

**Check PyCore modules:**
```powershell
python -c "from pycore.pylauncher import UnifiedLauncher; print('OK')"
python -c "from pycore.pyutils.pybrowser import BrowserFactory; print('OK')"
```

---

## Development Guide Compliance

This application follows all standards from `PYTHON_PYCORE_BASE_GUIDE_THIS_FILE_NO_AI_EDIT.md`:

✅ **Pre-development Analysis** - `development_analysis.md` created
✅ **Entry Point** - `main.py` with `start()` function
✅ **Configuration** - `config/` directory with JSON files
✅ **Deployment Scripts** - `scripts/` with PowerShell files
✅ **Absolute Imports** - `from pyapps.selenium_test.module import Class`
✅ **ColorPrint Logging** - No `print()` statements, only `ColorPrint`
✅ **Signal Handling** - Graceful shutdown on SIGINT/SIGTERM
✅ **Error Handling** - Try/except blocks with proper cleanup

---

## Related Documentation

- **PyBrowser Thread Mode Analysis**: `pycore/pyutils/pybrowser/THREAD_MODE_ANALYSIS.md`
- **PyBrowser Usage Examples**: `pycore/pyutils/pybrowser/USAGE_EXAMPLES.md`
- **Thread vs Process Clarification**: `pycore/pyutils/pybrowser/THREAD_VS_PROCESS_CLARIFICATION.md`
- **Refactoring Summary**: `pycore/pyutils/pybrowser/THREAD_MODE_REFACTORING_SUMMARY.md`
- **Launcher Documentation**: `pycore/pylauncher/launcher.py`
- **Development Guide**: `development-guides/PYTHON_PYCORE_BASE_GUIDE_THIS_FILE_NO_AI_EDIT.md`

---

## Testing Checklist

- [ ] Install dependencies: `.\scripts\install.ps1`
- [ ] Validate deployment: `.\scripts\deploy.ps1`
- [ ] Run with Chrome: Set `browser_type: "chrome"` and run
- [ ] Run with Edge: Set `browser_type: "edge"` and run
- [ ] Run with Firefox: Set `browser_type: "firefox"` and run
- [ ] Test headless mode: Set `headless: true` and run
- [ ] Test graceful shutdown: Press Ctrl+C during execution
- [ ] Verify cleanup: Check no orphaned processes after stop
- [ ] Test error recovery: Kill browser manually, verify service handles it

---

## Next Steps

### For Users
1. Run the application to validate ThreadedBrowser integration
2. Modify configurations to test different browsers
3. Extend `main.py` to add custom browser automation logic
4. Use this as a template for browser automation projects

### For Developers
1. Study the ThreadedBrowser pattern implementation
2. Understand the service orchestration model
3. Learn the command queue pattern for thread-safe operations
4. Explore creating custom browser automation workflows

---

## Support

**Issues:**
- Review `development_analysis.md` for architecture details
- Check PyBrowser documentation in `pycore/pyutils/pybrowser/`
- Run `.\scripts\deploy.ps1` for environment validation

**Questions:**
- Refer to development guide for standards
- Check ThreadedBrowser usage examples
- Review launcher configuration options

---

**Status:** ✅ READY FOR TESTING
**Last Updated:** 2025-11-09
**Maintainer:** Development Team
