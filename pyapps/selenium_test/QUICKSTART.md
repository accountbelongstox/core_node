# Selenium Test - Quick Start Guide

## 5-Minute Setup

### Step 1: Setup ChromeDriver (One-Time)

```bash
# Run automated setup
python setup_driver.py

# Or manual download from:
# https://chromedriver.chromium.org/downloads
# Place in: D:/drivers/chromedriver.exe (Windows)
#       or: /usr/local/bin/chromedriver (Linux/Mac)
```

### Step 2: Choose Test Mode

#### Option A: Single Browser Test
```bash
# From project root
python pymain.py app=selenium_test

# Or quick start
cd pyapps/selenium_test
./run_test.bat      # Windows
./run_test.sh       # Linux/Mac
```

#### Option B: Multi-Browser Concurrent Test
```bash
# From selenium_test directory
python test_multi_browser.py
```

### Step 3: Verify Results

- Check console output for test progress
- Screenshots saved in `screenshots/` directory
- Browser windows open automatically (unless headless mode)

## Configuration Quick Reference

### Minimal Config (launcher_config.json)
```json
{
  "selenium_service": {
    "driver_mode": "local",
    "driver_path": "D:/drivers/chromedriver.exe"
  }
}
```

### Multi-Browser Config (multi_browser_config.json)
```json
{
  "browsers": [
    {
      "name": "browser_1",
      "config": {
        "driver_path": "D:/drivers/chromedriver.exe"
      }
    }
  ]
}
```

## Common Issues

| Problem | Solution |
|---------|----------|
| Driver not found | Run `python setup_driver.py` |
| Permission denied | `chmod +x /path/to/chromedriver` |
| Version mismatch | Download matching ChromeDriver version |
| Network error | Set `driver_mode: "local"` |

## Next Steps

1. Read [README.md](README.md) for detailed documentation
2. Check [SOLUTION_SUMMARY.md](SOLUTION_SUMMARY.md) for configuration options
3. Review [MULTITHREADING_ANALYSIS.md](MULTITHREADING_ANALYSIS.md) for architecture details

## Help

```bash
# Check driver status
python setup_driver.py --check-only

# Get help
python setup_driver.py --help
python test_multi_browser.py --help
```
