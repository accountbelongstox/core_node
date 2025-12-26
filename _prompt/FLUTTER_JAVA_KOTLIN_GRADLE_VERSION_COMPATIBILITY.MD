# Flutter, Java, Kotlin, Gradle Version Compatibility Table

## Version Compatibility Matrix

### Android Gradle Plugin (AGP) and Related Version Correspondence

| AGP Version | Gradle Version Required | Java (JDK) Version Required | Kotlin Version Required | Notes |
|-------------|------------------------|----------------------------|------------------------|-------|
| 8.13+       | 8.11.1+                | Java 17+                   | 1.9.0+                 | Latest version |
| 8.11        | 8.9+                   | Java 17+                   | 1.9.0+                 | Stable version |
| 8.9         | 8.7+                   | Java 17+                   | 1.9.0+                 | Stable version |
| 8.5         | 8.5+                   | Java 17+                   | 1.9.0+                 | |
| 8.3         | 8.4+                   | Java 17+                   | 1.9.0+                 | |
| 8.2         | 8.2+                   | Java 17+                   | 1.8.22+                | |
| 8.1         | 8.0+                   | Java 17+                   | 1.8.22+                | |
| 8.0         | 8.0+                   | Java 17+                   | 1.8.22+                | |
| 7.4         | 7.5+                   | Java 11+                   | 1.7.20+                | |
| 7.3         | 7.4+                   | Java 11+                   | 1.7.20+                | |
| 7.2         | 7.3.3+                 | Java 11+                   | 1.7.10+                | |
| 7.1         | 7.2+                   | Java 11+                   | 1.6.21+                | |
| 7.0         | 7.0+                   | Java 11+                   | 1.6.21+                | |
| 4.2         | 6.7.1+                 | Java 8+                    | 1.4.32+                | Legacy version |

### Flutter Version and Android Build Requirements

| Flutter Version | Minimum Java Version | Recommended AGP Version | Recommended Gradle Version | Recommended Kotlin Version | Notes |
|-----------------|---------------------|------------------------|---------------------------|---------------------------|-------|
| 3.29+           | Java 17              | 8.2+                   | 8.2+                      | 1.9.0+                    | Latest version, imperative plugins removed |
| 3.24+           | Java 17              | 8.0+                   | 8.0+                      | 1.9.0+                    | |
| 3.19+           | Java 17              | 8.0+                   | 8.0+                      | 1.9.0+                    | |
| 3.16+           | Java 11               | 7.4+                   | 7.5+                      | 1.8.22+                   | |
| 3.13+           | Java 11               | 7.3+                   | 7.4+                      | 1.8.20+                   | |
| 3.10+           | Java 11               | 7.2+                   | 7.3.3+                    | 1.8.10+                   | |
| 3.7+            | Java 11               | 7.1+                   | 7.2+                      | 1.7.20+                   | |
| 3.3+            | Java 11               | 7.0+                   | 7.0+                      | 1.7.10+                   | |
| 3.0+            | Java 8                | 4.2+                   | 6.7.1+                    | 1.5.30+                   | |

### Gradle Version and Java Version Correspondence

| Gradle Version | Minimum Java Version | Maximum Java Version | Notes |
|---------------|---------------------|---------------------|-------|
| 8.11+         | Java 17              | Java 21              | Latest version |
| 8.9           | Java 17              | Java 21              | |
| 8.7           | Java 17              | Java 21              | |
| 8.5           | Java 17              | Java 21              | |
| 8.4           | Java 17              | Java 21              | |
| 8.2           | Java 17              | Java 21              | |
| 8.0           | Java 17              | Java 21              | |
| 7.6           | Java 11              | Java 19              | |
| 7.5           | Java 11              | Java 19              | |
| 7.4           | Java 11              | Java 19              | |
| 7.3           | Java 11              | Java 19              | |
| 7.2           | Java 11              | Java 19              | |
| 7.0           | Java 11              | Java 19              | |
| 6.9           | Java 8               | Java 15              | |
| 6.7           | Java 8               | Java 15              | |

### Kotlin Version and Java Version Correspondence

| Kotlin Version | Minimum Java Version | Maximum Java Version | Notes |
|---------------|---------------------|---------------------|-------|
| 2.0+          | Java 8              | Java 21              | Latest version |
| 1.9.24        | Java 8              | Java 21              | |
| 1.9.22        | Java 8              | Java 21              | |
| 1.9.20        | Java 8              | Java 21              | |
| 1.9.0         | Java 8              | Java 21              | |
| 1.8.22        | Java 8              | Java 19              | |
| 1.8.20        | Java 8              | Java 19              | |
| 1.8.10        | Java 8              | Java 19              | |
| 1.7.20        | Java 8              | Java 19              | |
| 1.7.10        | Java 8              | Java 19              | |
| 1.6.21        | Java 8              | Java 18              | |
| 1.5.30        | Java 8              | Java 16              | |

## Recommended Configuration Combinations

### Latest Recommended Configuration (2024-2025)

```
Flutter: 3.29+
Java (JDK): 17 or 21
Kotlin: 1.9.24+
AGP: 8.9+
Gradle: 8.9+
```

### Stable Recommended Configuration

```
Flutter: 3.24+
Java (JDK): 17
Kotlin: 1.9.20+
AGP: 8.5+
Gradle: 8.5+
```

### Legacy Project Compatible Configuration

```
Flutter: 3.16+
Java (JDK): 11
Kotlin: 1.8.22+
AGP: 7.4+
Gradle: 7.5+
```

## Version Check Commands

### Check Flutter Version
```bash
flutter --version
```

### Check Java Version
```bash
java -version
javac -version
```

### Check Kotlin Version
```bash
kotlin -version
```

### Check Gradle Version
```bash
gradle --version
```

### Check AGP Version
View in `android/build.gradle` file:
```gradle
dependencies {
    classpath 'com.android.tools.build:gradle:8.5.2'
}
```

## Common Issues

### 1. Flutter 3.29+ Version Changes
- Removed Flutter Gradle imperative plugins
- Must use declarative plugin configuration
- Requires Java 17+

### 2. AGP 8.0+ Version Requirements
- Must use Java 17+
- Must use Gradle 8.0+
- Recommended Kotlin 1.9.0+

### 3. Version Upgrade Path
- **From Java 11 to Java 17**: Need to upgrade AGP to 8.0+ and Gradle to 8.0+ simultaneously
- **From AGP 7.x to 8.x**: Requires Java 17+ and Gradle 8.0+
- **From Kotlin 1.8 to 1.9**: Requires AGP 8.0+ and Gradle 8.0+

## Important Notes

1. **Java Version Selection**:
   - Java 17 is an LTS version, recommended for production environments
   - Java 21 is the latest LTS version, but ensure all toolchains support it

2. **Kotlin Version**:
   - Kotlin 2.0+ introduces a new compiler, ensure compatibility
   - Recommend using 1.9.x series for best stability

3. **Gradle Version**:
   - Use Gradle Wrapper to ensure team uses same version
   - Regularly update to stable versions for security fixes

4. **Flutter Version**:
   - Use `flutter upgrade` to stay current
   - Check [Flutter Release Notes](https://docs.flutter.dev/release/breaking-changes) for breaking changes

## References

- [Flutter Official Documentation](https://docs.flutter.dev)
- [Android Gradle Plugin Release Notes](https://developer.android.com/build/releases/gradle-plugin)
- [Gradle Compatibility Matrix](https://docs.gradle.org/current/userguide/compatibility.html)
- [Kotlin Version Notes](https://kotlinlang.org/docs/releases.html)

---

**Last Updated**: December 2024
**Maintainer**: Development Team

