# Java 21 Environment Upgrade Guide

## 📋 Overview

Your project is upgrading to **Capacitor 7**, which requires **Java 21**.

## 🎯 Requirements

- **Java Version**: 21
- **Android Gradle Plugin (AGP)**: 8.7.2
- **Gradle**: 8.11.1
- **Android Studio**: 2024.2.1 or later
- **compileSdk**: 35
- **targetSdk**: 35

## 📥 Installation Options

### Option 1: Install via Android Studio (Recommended)

1. **Download Android Studio 2024.2.1+**
   - URL: https://developer.android.com/studio
   - Java 21 is bundled with Android Studio Ladybug | 2024.2.1+

2. **Set JAVA_HOME**

   **Windows:**
   ```powershell
   # Android Studio's bundled JDK location
   $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
   [Environment]::SetEnvironmentVariable("JAVA_HOME", $env:JAVA_HOME, "User")
   ```

   **Linux/macOS:**
   ```bash
   export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
   # Add to ~/.bashrc or ~/.zshrc
   ```

3. **Verify Installation**
   ```bash
   java -version
   # Should show: openjdk version "21.x.x"
   ```

### Option 2: Install JDK 21 Separately

**Windows:**
- Download: https://download.oracle.com/java/21/latest/jdk-21_windows-x64_bin.exe
- Run installer and follow prompts
- Set JAVA_HOME to installation directory

**Linux:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install openjdk-21-jdk

# Fedora/RHEL
sudo dnf install java-21-openjdk-devel

# Set JAVA_HOME
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk
echo 'export JAVA_HOME=/usr/lib/jvm/java-21-openjdk' >> ~/.bashrc
```

**macOS:**
```bash
brew install openjdk@21

# Link it
sudo ln -sfn $(brew --prefix)/opt/openjdk@21/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-21.jdk

# Set JAVA_HOME
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
echo 'export JAVA_HOME=$(/usr/libexec/java_home -v 21)' >> ~/.zshrc
```

## 🔧 Gradle Configuration Updates

The following files will be automatically updated:

1. **`android/build.gradle`**
   - AGP: `8.2.1` → `8.7.2`

2. **`android/gradle/wrapper/gradle-wrapper.properties`**
   - Gradle: `8.2.1` → `8.11.1`

3. **`android/app/capacitor.build.gradle`**
   - Java: `VERSION_17` → `VERSION_21`

4. **`android/variables.gradle`**
   - compileSdk: `34` → `35`
   - targetSdk: `34` → `35`

## ✅ Verification Steps

After installing Java 21:

1. **Verify Java Version**
   ```bash
   java -version
   # Expected: openjdk version "21.x.x"
   ```

2. **Verify JAVA_HOME**
   ```bash
   echo $JAVA_HOME  # Linux/macOS
   echo %JAVA_HOME%  # Windows CMD
   echo $env:JAVA_HOME  # Windows PowerShell
   ```

3. **Clean Gradle Cache**
   ```bash
   cd android
   ./gradlew --stop  # Windows: .\gradlew.bat --stop
   rm -rf ~/.gradle/caches  # Windows: Remove-Item -Recurse -Force $env:USERPROFILE\.gradle\caches
   ```

4. **Re-run Build Script**
   ```bash
   ./scripts/start.ps1  # Windows
   ./scripts/start.sh   # Linux
   ```

## 🚨 Common Issues

### Issue 1: "Unsupported class file major version"
**Cause**: Gradle is using old Java version
**Solution**: Verify JAVA_HOME points to Java 21

### Issue 2: "Could not determine java version"
**Cause**: Java not in PATH
**Solution**: Add Java bin directory to PATH

### Issue 3: Build fails with "AGP requires Java 21"
**Cause**: Android Studio using old JDK
**Solution**: In Android Studio, go to:
- **File → Project Structure → SDK Location**
- Set **JDK Location** to Java 21 path

## 📚 References

- [Capacitor 7 Upgrade Guide](https://capacitorjs.com/docs/updating/7-0)
- [Android Studio Requirements](https://developer.android.com/studio)
- [Gradle Java Compatibility](https://docs.gradle.org/current/userguide/compatibility.html)

---

**Generated**: 2025-12-10 23:10:51
**For Project**: cmg-corporate-portal
