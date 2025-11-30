# Screen Monitor Application

Monitors the Cursor window's right edge (503px width, full window height) every 10 seconds, uses OCR to detect text, compares screenshots for changes, and performs Windows click on "Keep" when "Undo Keep Review" is detected (case-insensitive).

## Features

- **Window-Based Monitoring**: Automatically finds and monitors Cursor window
- **Adaptive Region**: Captures right 503px of Cursor window (full window height)
- **Image Similarity**: Compares each screenshot with previous one using histogram and MSE
- **Freeze Detection**: Alerts when screenshots are identical (software may be paused/frozen)
- **OCR Recognition**: Uses CnOCR engine for text recognition (General/English models)
- **Auto Click**: Automatically clicks on "Keep" word when "Undo Keep Review" is detected (case-insensitive)
- **Smart Cleanup**: Automatically removes old screenshots, keeps only last 10

## Architecture

Developed according to `PYTHON_PYCORE.md` standards:

### Used pycore Modules

- `pycore.pyutils.ocr` - OCR recognition using ocr_manager singleton
- `pycore.pyutils.window_ops` - Windows operations (click)
- `pycore.pyutils.image_comparator` - Image similarity comparison (histogram, MSE, SSIM)
- `pycore.pyutils.window_analyzer` - Window detection and region analysis
- `pycore.pyfoundations.color_print` - Colored console output
- `pycore.pyfoundations.third_party` - Lazy loading of third-party packages (mss, PIL_Image)
- `pycore.pygvar` - Global constants (PYTOOLS_TMP_DIR)

### Import Pattern (Absolute)

```python
from pycore.pyutils.ocr import ocr_manager
from pycore.pyutils.window_ops import WindowOps
from pycore.pyutils.image_comparator import ImageComparator
from pycore.pyutils.window_analyzer import WindowAnalyzer
from pycore.pyfoundations.third_party import get_third_package_mss, get_third_package_PIL_Image
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pygvar import PYTOOLS_TMP_DIR
```

## Usage

### Run with pymain

```bash
# Standard way
python3 -m pymain app=screen_monitor

# From project root
python3 -m pymain app=screen_monitor
```

### Run directly

```bash
cd pyapps/screen_monitor
python3 screen_monitor_main.py
```

### Run as module

```python
from pyapps.screen_monitor import start
start()
```

## Configuration

Edit `screen_monitor_main.py` ScreenMonitor.__init__():

```python
self.region_width = 503                      # Right edge width (px from right)
self.region_height = None                    # Auto-detect from window height
self.interval_seconds = 10                   # Check interval in seconds
self.target_text = "undo keep review"        # Text to detect (case-insensitive)
self.click_word = "keep"                     # Word to click when target detected
self.target_window_name = "Cursor"           # Window process name to monitor
```

## How It Works

1. **Find Window**: Uses `WindowAnalyzer` to locate "Cursor" window
2. **Calculate Region**: Determines right edge region (503px from right, full window height)
3. **Capture**: Uses `mss` to capture the calculated region
4. **Compare**: Compares with previous screenshot using `ImageComparator`
   - Histogram similarity (0-1, 1 = identical)
   - MSE (Mean Squared Error, 0 = identical)
   - Displays similarity percentage
   - **Freeze Detection**: If similarity >= 99.9% and MSE < 10, alerts that software may be frozen
5. **Save**: Saves screenshot to `PYTOOLS_TMP_DIR/screen_monitor/capture_YYYYMMDD_HHMMSS.png`
6. **OCR**: Uses `ocr_manager.recognize_image()` with "general" model (fallback to "english")
7. **Debug**: Prints ALL recognized words (no truncation)
8. **Detect**: Checks if normalized text contains "undo keep review" (case-insensitive)
9. **Find Word**: Searches for "keep" word in OCR results
10. **Click**: If found, clicks at "keep" word position using `window_ops.click_at_position()`
11. **Cleanup**: Automatically removes old screenshots, keeps only last 10
12. **Wait**: Sleeps 10 seconds before next cycle

## Code Standards Compliance

- ✅ All imports at file top
- ✅ No relative imports, only absolute
- ✅ Uses singleton patterns (ocr_manager)
- ✅ No try-except blocks (error handling via ColorPrint)
- ✅ Lazy loading for third-party packages
- ✅ Entry points: `start()` and `main()`

## Dependencies

Auto-installed via `third_party.py`:

- `mss` - Screenshot capture
- `Pillow` - Image processing
- `cnocr[ort-cpu]` - OCR engine
- `pywin32` - Windows operations

## Example Output

```
[INIT] Screen Monitor initialized
[CONFIG] Target window: 'Cursor'
[CONFIG] Monitoring region: Right 503px (height: auto-detect)
[CONFIG] Interval: 10 seconds
[CONFIG] Target text: 'undo keep review' (case-insensitive)
[CONFIG] Click word: 'keep'
[START] Screen Monitor started
============================================================
[MONITOR] Starting monitoring cycle
============================================================
[WINDOW] Found 'Cursor - myproject' window
[WINDOW] Position: (100, 50)
[WINDOW] Size: 1800x1000
[CAPTURE] Window: (100, 50) size: 1800x1000
[CAPTURE] Region: (1397, 50) size: 503x1000
[SUCCESS] Screenshot saved: capture_20251123_143015.png
[SIMILARITY] Comparison with last screenshot:
  - Histogram similarity: 0.9823 (1.0 = identical)
  - MSE value: 45.67 (0 = identical)
[SIMILARITY] Screenshot similar to previous (similarity: 98.23%)

# OR if screenshot is identical (frozen):
======================================================================
[IDENTICAL] Screenshot IDENTICAL to previous - Software may be paused!
======================================================================
[TODO] Possible actions:
  1. Check if Cursor is frozen or unresponsive
  2. Try clicking in the Cursor window to activate it
  3. Check if any dialog boxes are blocking the window
  4. Verify that 'Undo Keep Review' text is visible
  5. Consider restarting Cursor if it's stuck
======================================================================
[OCR] Recognizing text from: capture_20251123_143015.png
[OCR] Recognized text (confidence: 0.95): Undo Keep Review
[OCR] Found 3 words
[OCR] Recognized words (ALL):
  [1] 'Undo' (confidence: 0.96)
  [2] 'Keep' (confidence: 0.98)
  [3] 'Review' (confidence: 0.94)
[DETECT] Found target text: 'undo keep review'
[DEBUG] Found word 'keep' at region (180, 240)
[DEBUG] Screen position: (1600, 820)
[CLICK] Clicking 'keep' at position: (1600, 820)
[SUCCESS] Click performed
[RESULT] Target found and clicked!
[WAIT] Waiting 10 seconds for next cycle...
```

## Troubleshooting

### Window not found

- Ensure "Cursor" window is open
- Check window title matches (case-sensitive in some cases)
- Try changing `target_window_name` to match exact window title

### OCR not recognizing text

- Try different model types: `"general"`, `"scene"`, `"english"`
- Check screenshot clarity in `PYTOOLS_TMP_DIR/screen_monitor/`
- Increase region size if text is outside 503px width
- Review all recognized words in debug output

### Click not working

- Verify Cursor window is active
- Check if position calculation is correct
- Manually inspect word bbox in OCR result
- Ensure "Keep" word is within monitored region

### Screenshot always shows high similarity

- This is normal if window content doesn't change
- OCR will still run to detect text
- No action taken if target text not found

### High memory usage

- Cleanup is automatic (keeps last 10 screenshots)
- Increase `interval_seconds` to reduce frequency
- Check screenshot file sizes (large windows = larger files)

## Project Structure

```
pyapps/screen_monitor/
├── __init__.py                 # Package exports
├── screen_monitor_main.py      # Main application
└── README.md                   # This file
```
