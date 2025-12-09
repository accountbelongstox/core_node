# Web Resource Preview Feature

## Overview

Before building the Android APK, the build system now automatically launches a **web-based resource preview** that displays:

- 🖼️ **All Android images** (with thumbnails, dimensions, file sizes)
- 📦 **All package names** found in the project
- 📱 **All app names** found in the project

This allows you to review resources before the final build and catch any issues early.

## How It Works

### When Building for Android

1. **Select "Build for Android"** from the menu
2. Python scans the `android/` directory for resources
3. **Web browser automatically opens** showing the preview
4. **Review the resources** in the web interface
5. **Click "Continue Building"** or press `Y` in terminal to proceed
6. Build continues with APK compilation

### Preview Display

The web preview shows:

#### Statistics Dashboard
- Total number of images
- Number of image categories
- Package names count
- App names count

#### Package Names Section
Lists all package IDs found in:
- AndroidManifest.xml
- build.gradle files
- Kotlin/Java source files

Examples:
- `com.ddsj.cmg.club`
- `com.dd.myapp`

#### App Names Section
Lists all app display names found in:
- AndroidManifest.xml (`android:label`)
- strings.xml (`app_name`)
- Configuration files

#### Images Section
**Grouped by category** (e.g., mipmap-hdpi, drawable, etc.):
- Thumbnail preview
- Filename
- Dimensions (width × height)
- File size in KB
- Full file path

## User Actions

### In Web Browser

**Continue Building (✓)**
- Green button at the top
- Continues with the build process
- Closes the preview server

**Cancel (✗)**
- Red button at the top
- Aborts the build process
- Closes the preview server

### In Terminal

**Press 'Y'**
- Continue with build
- Same as clicking "Continue Building"

**Press 'N'**
- Cancel build
- Same as clicking "Cancel"

**Ctrl+C**
- Interrupt and cancel build

## Testing

### Standalone Test

Test the preview feature without running a full build:

```bash
cd scripts/build_scripts
python test_preview.py /path/to/android
```

Example:
```bash
python test_preview.py D:\programing\core_node\poly_apps\cmg-corporate-portal\android
```

This will:
1. Scan the Android directory
2. Show scan statistics in terminal
3. Launch web preview
4. Wait for user action

### Full Build Test

Run the full build system:

```powershell
cd scripts
.\start_new.ps1 build_android
```

The preview will automatically launch after resource scanning.

## Technical Details

### Resource Scanner (`resource_scanner.py`)

Scans for:
- **Images**: `.png`, `.jpg`, `.jpeg`, `.webp`, `.xml`
- **Package names**: Regex patterns in `.xml`, `.gradle`, `.kt`, `.java`
- **App names**: Patterns in manifest and strings files

### Web Server (`web_preview_server.py`)

- **Built-in HTTP server** (Python `http.server`)
- **Port**: 8899 (configurable)
- **Auto-opens browser**
- **REST API** for data and images
- **Shutdown endpoint** for clean exit

### Preview Features

1. **Image thumbnails**: Direct file serving with fallback
2. **Responsive design**: Works on different screen sizes
3. **Grouped display**: Images organized by resource type
4. **File paths**: Full paths shown for reference
5. **Statistics**: Quick overview of all resources

## File Structure

```
scripts/build_scripts/
├── resource_scanner.py        # Scans Android resources
├── web_preview_server.py      # HTTP server for preview
├── test_preview.py            # Standalone test script
└── main_controller.py         # Integrated into build flow
```

## Configuration

### Change Preview Port

Edit `main_controller.py`:

```python
user_continues = show_preview(resource_data, port=8899)
```

Change `8899` to your preferred port.

### Skip Preview (Future Enhancement)

To add a skip option, modify `main_controller.py`:

```python
# Add command-line flag or config option
skip_preview = False  # Set to True to skip

if not skip_preview:
    user_continues = show_preview(resource_data, port=8899)
    if not user_continues:
        return
```

## Troubleshooting

### Browser Doesn't Open

If the browser doesn't open automatically:
- Check terminal for the URL (e.g., `http://127.0.0.1:8899`)
- Open it manually in your browser
- Or press `Y` in terminal to continue without viewing

### Port Already in Use

If port 8899 is already in use:
- Change the port number in `main_controller.py`
- Or wait for the existing process to close

### No Images Shown

If no images appear:
- Check that the Android directory exists
- Run "Install Capacitor" first
- Verify images exist in `android/app/src/main/res/`

### Preview Hangs

If the preview doesn't respond:
- Press `Ctrl+C` in terminal
- Restart the build process
- Check for port conflicts

## Benefits

✅ **Catch errors early**: Spot wrong icons or package names before building

✅ **Visual verification**: See exactly what resources will be in the APK

✅ **Complete overview**: All resources in one organized view

✅ **Save time**: No need to build, install, and check on device

✅ **Professional**: Clean, modern web interface

## Example Output

```
[Python] Scanning Android resources for preview...
[Scanner] Scanning Android resources...
[Scanner] Found 24 images in 6 categories
[Scanner] Found 3 package names
[Scanner] Found 2 app names

============================================================
[Python] Launching resource preview...
============================================================

[Web] Resource preview server started at: http://127.0.0.1:8899
[Web] Opening browser...

============================================================
Review resources in the web browser
============================================================
Options:
  1. Click 'Continue Building' in the web interface
  2. Click 'Cancel' to abort
  3. Press 'Y' here to continue, 'N' to cancel
============================================================

Continue? [Y/n]:
```

## Screenshots

The web preview displays:

1. **Header**: Title and description
2. **Controls**: Continue/Cancel buttons
3. **Statistics**: Quick overview cards
4. **Package Names**: Bullet list
5. **App Names**: Bullet list
6. **Images**: Grid view with thumbnails grouped by category

Each image card shows:
- Preview thumbnail
- Filename
- File size
- Dimensions
- Relative path
