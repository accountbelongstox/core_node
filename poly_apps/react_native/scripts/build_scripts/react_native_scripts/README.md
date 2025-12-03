# React Native Multi-App Scripts

This directory contains the multi-app helper scripts for React Native project management.

## Directory Structure

```
scripts/build_scripts/react_native_scripts/
├── AppScanner.ps1           # App discovery and configuration scanning
├── Prerequisites.ps1        # Environment prerequisite checks
├── ResourceManager.ps1      # Platform resource management and replacement
├── PlatformBuilder.ps1      # Platform-specific build utilities
├── ErrorHandler.ps1         # Error handling and logging
├── InteractiveMenu.ps1      # Interactive menu system
├── build-multi-app.ps1      # Multi-app build script
├── test-multi-app.ps1       # Multi-app test runner
└── README.md                # This file
```

## Script Descriptions

### Core Helper Modules

#### AppScanner.ps1
- Scans `configs/` directory for app configurations
- Discovers and registers available apps
- Provides app lookup and validation functions

**Key Functions:**
- `Initialize-AppConfigs` - Scans and loads app configurations
- `Get-AppConfigs` - Returns all registered apps
- `Get-AppConfig` - Gets specific app configuration
- `Test-AppExists` - Validates app namespace

#### Prerequisites.ps1
- Checks development environment prerequisites
- Validates Node.js, npm, Java, Android SDK, Xcode, CocoaPods
- Provides detailed installation guidance

**Key Functions:**
- `Test-Prerequisites` - Comprehensive environment check
- `Test-NodeInstallation` - Node.js validation
- `Test-AndroidSdk` - Android SDK verification
- `Test-XcodeInstallation` - Xcode verification (macOS only)

#### ResourceManager.ps1
- Manages platform-specific resources (icons, splash screens)
- Backs up and restores original resources
- Copies app-specific resources to platform directories

**Key Functions:**
- `Backup-PlatformResources` - Creates timestamped backups
- `Copy-AppResources` - Copies app resources to platform dirs
- `Restore-PlatformResources` - Restores from backup
- `Update-AppJson` - Updates app.json configuration

#### PlatformBuilder.ps1
- Provides platform-specific build and run utilities
- Handles Metro server, Android, and iOS operations

**Key Functions:**
- `Start-MetroServer` - Launches Metro bundler
- `Start-AndroidDebug` - Runs Android debug build
- `Start-IosDebug` - Runs iOS debug build
- `Build-AndroidRelease` - Builds Android release APK
- `Build-IosRelease` - Builds iOS release archive
- `Start-TestRunner` - Executes test suites

#### ErrorHandler.ps1
- Provides error handling utilities
- Standardized command execution with error reporting

**Key Functions:**
- `Invoke-CommandWithErrorHandling` - Executes commands with error handling

#### InteractiveMenu.ps1
- Provides interactive menu system for app selection
- Supports keyboard navigation and mode toggling

**Key Functions:**
- `Show-InteractiveMenu` - Displays interactive app selection menu

### Standalone Scripts

#### build-multi-app.ps1
Multi-app build script with resource management.

**Usage:**
```powershell
.\build-multi-app.ps1 <app> <platform> [configuration]

# Examples:
.\build-multi-app.ps1 myapp android release
.\build-multi-app.ps1 myapp ios debug
```

**Features:**
- Automatic resource backup and restoration
- Platform-specific resource replacement
- app.json configuration updates
- Build status reporting

#### test-multi-app.ps1
Multi-app test runner with filtering support.

**Usage:**
```powershell
.\test-multi-app.ps1               # Run all tests
.\test-multi-app.ps1 <app>         # Run tests for specific app
.\test-multi-app.ps1 <app> --watch # Run tests in watch mode
.\test-multi-app.ps1 --coverage    # Generate coverage report

# Examples:
.\test-multi-app.ps1 myapp
.\test-multi-app.ps1 myapp --watch
```

**Features:**
- App-specific test filtering
- Watch mode support
- Coverage reporting
- Detailed test output

## Integration with start.ps1

The main `scripts/start.ps1` automatically loads these helper scripts when:
1. Scripts are present in `scripts/build_scripts/react_native_scripts/`
2. A `configs/` directory exists with `*.config.ts` files

### Multi-App Mode Detection

```powershell
# Automatic detection
if (configs/*.config.ts exists) {
    Enable Multi-App Mode
    Load helper scripts
    Scan and register apps
} else {
    Use Single-App Legacy Mode
}
```

### App Selection Flow

1. User runs `scripts/start.ps1`
2. Script detects multi-app configuration
3. User presses 'S' to select app
4. Build/Debug operations use selected app's resources

## Creating New Apps

To add a new app to the multi-app system:

1. **Create Config File:**
   ```
   configs/myapp.config.ts
   ```

2. **Create App Structure:**
   ```
   apps/app_myapp/
   ├── components_app_myapp/
   ├── screens_app_myapp/
   ├── navigation_app_myapp/
   └── ...
   ```

3. **Create Resources:**
   ```
   assets/apps/app_myapp/
   ├── android/     # Android resources
   ├── ios/         # iOS resources
   └── common/      # Shared resources
   ```

4. **Run start.ps1:**
   - Script will automatically detect new app
   - Select app with 'S' key
   - Build/Debug as normal

## Script Execution Flow

### Build Flow
```
start.ps1
  ↓
Load helper scripts
  ↓
Detect multi-app mode
  ↓
User selects app
  ↓
Backup platform resources
  ↓
Copy app-specific resources
  ↓
Update app.json
  ↓
Run platform build
  ↓
Restore original resources
```

### Debug Flow
```
start.ps1
  ↓
Load helper scripts
  ↓
User selects app
  ↓
Prepare resources
  ↓
Start Metro server
  ↓
Launch platform (Android/iOS)
  ↓
Restore resources
```

## Environment Variables

When multi-app mode is active, these environment variables are set:

- `APP_ENTRY` - Selected app namespace
- `APP_DISPLAY_NAME` - App display name

## Troubleshooting

### Scripts not loading
- Verify scripts are in `scripts/build_scripts/react_native_scripts/`
- Check file permissions (Windows: unblock files)
- Run: `Get-ExecutionPolicy` (should be RemoteSigned or Unrestricted)

### App not detected
- Ensure `configs/myapp.config.ts` exists
- Verify file has `.config.ts` extension
- Check console output for scan errors

### Resource replacement fails
- Verify `assets/apps/app_{namespace}/` exists
- Check platform subdirectories (android/, ios/)
- Ensure backup directory is writable

### Build errors
- Check selected app configuration
- Verify all resources are present
- Review Metro bundler output
- Check platform-specific logs

## Dependencies

Required PowerShell version: 5.1 or higher

External dependencies:
- Node.js and npm
- React Native CLI
- Platform SDKs (Android SDK, Xcode)
- pnpm (package manager)

## License

Part of the core_node React Native multi-app system.
