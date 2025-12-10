# Build Versions Configuration

## 📋 Overview

This directory contains version configuration for the build system. All version numbers (Java, Gradle, AGP, SDK, etc.) are centralized in `build_versions_config.json` for easy maintenance.

## 📁 Configuration Files

### `build_versions_config.json`
Main configuration file containing:
- **Capacitor**: Required minimum major version
- **Java**: JDK version and download URLs
- **Android Build Tools**: AGP, Gradle, Android Studio versions
- **Android SDK**: compileSdk, targetSdk, minSdk, Kotlin version

### How It Works
1. `key_center.py` loads the configuration at module import
2. Prints configuration summary when build scripts run
3. All version numbers are read from the config file
4. No hardcoded versions in Python code

## 🔄 Updating Versions

### When to Update
- New Capacitor major version released
- Gradle/AGP security updates
- Android SDK version changes
- Java LTS version updates

### How to Update Using AI + MCP

#### Step 1: Query Latest Versions via MCP
```
Use MCP Context7 to query:

Library: /capacitor/capacitor
Topic: android requirements gradle agp java version sdk

Or use web search:
- Capacitor documentation: https://capacitorjs.com/docs/android
- Android Gradle Plugin releases
- Gradle releases: https://gradle.org/releases/
```

#### Step 2: Update `build_versions_config.json`
Edit the file with new version numbers:
```json
{
  "_last_verified": "2025-12-10",  // Update this date

  "android_build_tools": {
    "agp_version": "8.7.2",        // Update AGP version
    "gradle_version": "8.11.1"     // Update Gradle version
  },

  "android_sdk": {
    "compile_sdk": "35",           // Update SDK versions
    "target_sdk": "35",
    "kotlin_version": "1.9.25"
  }
}
```

#### Step 3: Test the Build
```bash
cd poly_apps/cmg-corporate-portal
./scripts/start.ps1  # Windows
./scripts/start.sh   # Linux
```

#### Step 4: Verify Compatibility
- Check that pnpm install succeeds
- Verify Gradle sync completes
- Ensure Android build works

## 🎯 Example: Updating to Capacitor 9

Assuming Capacitor 9 is released:

```json
{
  "_last_verified": "2026-01-15",
  "_verification_note": "Updated for Capacitor 9 via MCP query on 2026-01-15",

  "capacitor": {
    "required_major_version": 9,  // Changed from 8 to 9
    "description": "Minimum required @capacitor/core major version"
  },

  "java": {
    "version": "21",  // May need Java 22+ for Capacitor 9
    ...
  },

  "android_build_tools": {
    "agp_version": "8.8.0",  // Updated based on Capacitor 9 requirements
    "gradle_version": "8.12.0"
  }
}
```

## 🤖 AI Instructions

**For AI assistants updating this configuration:**

1. **Query MCP Context7** for latest versions:
   ```
   mcp__context7__get-library-docs
   context7CompatibleLibraryID: /capacitor/capacitor
   topic: android requirements gradle version agp java sdk
   ```

2. **Cross-reference** with official documentation:
   - Capacitor: https://capacitorjs.com/docs/android
   - Gradle: https://gradle.org/releases/
   - AGP: https://developer.android.com/studio/releases/gradle-plugin

3. **Update** `build_versions_config.json` with verified versions

4. **Update** `_last_verified` date to current date

5. **Add note** in `_verification_note` about what changed

6. **Test** by running the build script

## 📝 Version History

| Date       | Capacitor | AGP   | Gradle | Notes                           |
|------------|-----------|-------|--------|---------------------------------|
| 2025-12-10 | 8.x       | 8.7.2 | 8.11.1 | Initial configuration (MCP verified) |

## 🔗 References

- [Capacitor Android Guide](https://capacitorjs.com/docs/android)
- [Gradle Releases](https://gradle.org/releases/)
- [Android Gradle Plugin Releases](https://developer.android.com/studio/releases/gradle-plugin)
- [Java Download](https://www.oracle.com/java/technologies/downloads/)

---

**Last Updated**: 2025-12-10
**Maintained By**: Build System (Python + Shell)
