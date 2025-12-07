# Kotlin Multiplatform Debugging Scripts

This directory contains debugging scripts for Android and iOS platforms in the Kotlin Multiplatform project.

## Scripts Overview

### Shell Scripts (Linux/macOS)
- `android_debug.sh` - Android platform debugging
- `ios_debug.sh` - iOS platform debugging  
- `parallel_debug.sh` - Parallel debugging for both platforms

### PowerShell Scripts (Windows)
- `android_debug.ps1` - Android platform debugging
- `ios_debug.ps1` - iOS platform debugging
- `parallel_debug.ps1` - Parallel debugging for both platforms

## Prerequisites

### Android
- Android SDK with `adb` and `emulator` tools
- Android Virtual Device (AVD) created
- Gradle installed

### iOS (macOS only)
- Xcode installed
- Command Line Tools
- iOS Simulator

## Usage

### Android Debugging

#### Shell (Linux/macOS)
```bash
# List available emulators
./scripts/android_debug.sh list

# Start emulator and install app
./scripts/android_debug.sh emulator Pixel_6_API_34

# Install on connected device
./scripts/android_debug.sh device

# View logs
./scripts/android_debug.sh logs

# Setup wireless debugging
./scripts/android_debug.sh wireless
```

#### PowerShell (Windows)
```powershell
# List available emulators
.\scripts\android_debug.ps1 list

# Start emulator and install app
.\scripts\android_debug.ps1 emulator Pixel_6_API_34

# Install on connected device
.\scripts\android_debug.ps1 device

# View logs
.\scripts\android_debug.ps1 logs

# Setup wireless debugging
.\scripts\android_debug.ps1 wireless
```

### iOS Debugging

#### Shell (macOS)
```bash
# List available simulators
./scripts/ios_debug.sh list

# Start simulator
./scripts/ios_debug.sh simulator "iPhone 15 Pro"

# Build and open Xcode
./scripts/ios_debug.sh open

# Build and run to simulator
./scripts/ios_debug.sh run "iPhone 15 Pro"

# View logs
./scripts/ios_debug.sh logs

# Record screen
./scripts/ios_debug.sh record demo.mp4
```

#### PowerShell (macOS)
```powershell
# List available simulators
.\scripts\ios_debug.ps1 list

# Start simulator
.\scripts\ios_debug.ps1 simulator "iPhone 15 Pro"

# Build and open Xcode
.\scripts\ios_debug.ps1 open

# Build and run to simulator
.\scripts\ios_debug.ps1 run "iPhone 15 Pro"

# View logs
.\scripts\ios_debug.ps1 logs
```

### Parallel Debugging

#### Shell (macOS)
```bash
# Start both Android and iOS debugging
./scripts/parallel_debug.sh

# With custom emulator/simulator names
ANDROID_AVD=Pixel_7_API_34 IOS_SIMULATOR="iPhone 16 Pro" ./scripts/parallel_debug.sh
```

#### PowerShell (Windows/macOS)
```powershell
# Start both Android and iOS debugging
.\scripts\parallel_debug.ps1

# With custom emulator/simulator names
$env:ANDROID_AVD="Pixel_7_API_34"
$env:IOS_SIMULATOR="iPhone 16 Pro"
.\scripts\parallel_debug.ps1
```

## Commands Reference

### Android Debug Script

| Command | Description |
|---------|-------------|
| `list` | List available Android emulators |
| `emulator [name]` | Start emulator and install app |
| `device` | Install app on connected device |
| `install [device]` | Install app only |
| `launch` | Launch app only |
| `logs` | View app logs |
| `wireless` | Setup wireless debugging |

### iOS Debug Script

| Command | Description |
|---------|-------------|
| `list` | List available iOS simulators |
| `simulator [name]` | Start simulator |
| `build` | Build shared module |
| `open [simulator]` | Build and open Xcode |
| `run [simulator]` | Build and run to simulator |
| `logs` | View simulator logs |
| `record [filename]` | Record simulator screen |
| `language [name] [lang] [locale]` | Set simulator language |

## Configuration

You can customize the default configuration by modifying the variables at the top of each script:

- `APP_MODULE`: Gradle module name (default: `:app`)
- `APPLICATION_ID`: Android application ID (default: `com.escodro.alkaa`)
- `ANDROID_AVD`: Default Android emulator name
- `IOS_SIMULATOR`: Default iOS simulator name

## Troubleshooting

### Android Issues

**Emulator not starting:**
- Check if AVD exists: `emulator -list-avds`
- Ensure sufficient disk space and RAM
- Try starting with: `emulator -avd <name> -no-snapshot-load`

**Device not detected:**
- Enable USB debugging on device
- Authorize computer on device
- Check connection: `adb devices`

### iOS Issues

**Simulator not found:**
- List available simulators: `xcrun simctl list devices`
- Ensure Xcode is installed and updated

**Build failures:**
- Run `./gradlew :shared:packForXcode` manually
- Check Xcode project configuration
- Ensure signing certificates are set up

## Notes

- iOS debugging requires macOS
- PowerShell scripts work on Windows and macOS (with PowerShell installed)
- Shell scripts work on Linux and macOS
- All scripts use English language for output and messages

