# Troubleshooting Guide

## Build Errors

### Unresolved Reference: `wordFlowModule` or `wordflow`

**Error:**
```
e: Unresolved reference 'wordflow'.
e: Unresolved reference 'wordFlowModule'.
```

**Solution:**
The `wordflow` module needs to be added as a dependency in the `shared` module's `build.gradle.kts`:

```kotlin
// In shared/build.gradle.kts
commonMain.dependencies {
    // ... other dependencies
    implementation(projects.features.wordflow)
}
```

**Files to check:**
- `shared/build.gradle.kts` - Ensure `wordflow` is in dependencies
- `shared/src/commonMain/kotlin/com/escodro/shared/di/KoinHelper.kt` - Check import statement

**Reference:**
- [Gradle Multi-Project Builds](https://docs.gradle.org/current/userguide/multi_project_builds.html)
- [Kotlin Multiplatform Project Structure](https://kotlinlang.org/docs/multiplatform-discover-project.html)

### Unresolved Reference: Koin (`org.koin`)

**Error:**
```
e: Unresolved reference 'koin'.
e: Unresolved reference 'module'.
e: Unresolved reference 'single'.
```

**Solution:**
If you're using Koin in platform-specific source sets (like `androidMain`), you need to add Koin dependency to `commonMain`:

```kotlin
// In build.gradle.kts
sourceSets {
    commonMain.dependencies {
        implementation(libs.koin.core)  // Add here, not in androidMain
    }
    
    androidMain.dependencies {
        // Platform-specific dependencies only
    }
}
```

**Why:**
Koin core classes (`Module`, `module`, `single`, etc.) are multiplatform and should be available in `commonMain`. Platform-specific source sets inherit from `commonMain`, so they can access these classes.

**Reference:**
- [Koin Multiplatform Documentation](https://insert-koin.io/docs/reference/koin-multiplatform/multiplatform)
- [Gradle Source Sets](https://docs.gradle.org/current/userguide/java_plugin.html#sec:source_sets)

### Sealed Interface Extension Error

**Error:**
```
e: Extending sealed classes or interfaces from a different module is prohibited.
e: A class can only extend a sealed class or interface declared in the same package.
```

**Solution:**
In Kotlin, sealed interface/class subclasses must be in the same module. Move destinations and events to the `navigation-api` module:

```kotlin
// ❌ Wrong: In wordflow module
data object Login : Destination  // Destination is in navigation-api

// ✅ Correct: In navigation-api module
// features/navigation-api/src/commonMain/.../WordFlowDestination.kt
object WordFlowDestination {
    data object Login : Destination
}
```

**Why:**
Kotlin's sealed classes/interfaces enforce that all subclasses are in the same module for type safety and exhaustiveness checking.

**Reference:**
- [Kotlin Sealed Classes Documentation](https://kotlinlang.org/docs/sealed-classes.html)
- [Kotlin Multiplatform Module Structure](https://kotlinlang.org/docs/multiplatform-discover-project.html)

### Suspend Function Call Error

**Error:**
```
e: Suspend function 'share' can only be called from a coroutine or another suspend function.
```

**Solution:**
Use `rememberCoroutineScope()` and `launch` to call suspend functions from non-suspend contexts:

```kotlin
@Composable
fun MyScreen(shareManager: ShareManager) {
    val coroutineScope = rememberCoroutineScope()
    
    Button(
        onClick = {
            coroutineScope.launch {
                shareManager.share(content)
            }
        }
    ) { ... }
}
```

**Reference:**
- [Kotlin Coroutines in Compose](https://developer.android.com/jetpack/compose/side-effects#launchedeffect)
- [Compose Side Effects](https://developer.android.com/jetpack/compose/side-effects)

### Unresolved Reference: `libs.androidx.core.ktx`

**Error:**
```
e: Unresolved reference 'ktx'.
Line: implementation(libs.androidx.core.ktx)
```

**Solution:**
In `libs.versions.toml`, the library is defined as `androidx_corektx` (with underscore, not dot). Use the correct reference:

```kotlin
// ❌ Wrong
implementation(libs.androidx.core.ktx)

// ✅ Correct
implementation(libs.androidx.corektx)
```

**Files to check:**
- `features/share-api/build.gradle.kts`
- `features/wordflow/build.gradle.kts`
- Any other feature modules using AndroidX Core KTX

**Reference:**
- [Gradle Version Catalog Documentation](https://docs.gradle.org/current/userguide/platforms.html#sec:version-catalog)
- [AndroidX Core KTX](https://developer.android.com/kotlin/ktx#core)

## Emulator Issues

### Multiple Emulator Instances

**Error:**
```
ERROR | Another emulator instance is running. Please close it or run all emulators with -read-only flag.
```

**Solution:**
The script automatically handles this by:
1. Detecting running emulators
2. Offering options:
   - Use existing emulator
   - Start with `-read-only` flag
   - Stop all and start fresh

**Manual Solution:**
```powershell
# Stop all emulators
.\scripts\android_debug.ps1 stop

# Or use -read-only flag manually
emulator -avd <AVD_NAME> -read-only
```

**Reference:**
- [Android Emulator Command-Line Guide](https://developer.android.com/studio/run/emulator-commandline)

### Activity Not Found

**Error:**
```
Error: Activity class {com.escodro.alkaa/com.escodro.alkaa.MainActivity} does not exist.
```

**Solution:**
1. Ensure the app is properly installed:
   ```powershell
   .\scripts\android_debug.ps1 install
   ```

2. Check AndroidManifest.xml:
   ```xml
   <activity
       android:name="com.escodro.alkaa.MainActivity"
       ...
   ```

3. Verify the package name matches:
   - `AndroidManifest.xml`: `package="com.escodro.alkaa"`
   - `build.gradle.kts`: `applicationId = "com.escodro.alkaa"`

## Gradle Issues

### Type-safe Project Accessors Warning

**Warning:**
```
Project accessors enabled, but root project name not explicitly set for 'kmpapp_1'.
```

**Solution:**
This is a warning, not an error. To fix:
1. Add to `settings.gradle.kts`:
   ```kotlin
   rootProject.name = "kmpapp_1"
   ```

2. Or ignore (it's just a caching optimization warning)

**Reference:**
- [Gradle Type-safe Project Accessors](https://docs.gradle.org/current/userguide/declaring_dependencies.html#sec:type-safe-project-accessors)

## Common Commands

### Clean Build
```powershell
.\gradlew.bat clean
.\gradlew.bat build
```

### Rebuild All
```powershell
.\gradlew.bat clean build --refresh-dependencies
```

### Check Dependencies
```powershell
.\gradlew.bat :app:dependencies
```

## Getting Help

1. Check build logs: `build/reports/problems/problems-report.html`
2. Run with stacktrace: `.\gradlew.bat build --stacktrace`
3. Run with info: `.\gradlew.bat build --info`
4. Check official documentation:
   - [Kotlin Multiplatform](https://kotlinlang.org/docs/multiplatform.html)
   - [Android Developer Guide](https://developer.android.com/)
   - [Gradle User Guide](https://docs.gradle.org/current/userguide/userguide.html)

