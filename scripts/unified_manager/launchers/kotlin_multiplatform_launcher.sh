#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Kotlin Multiplatform Framework Launcher
# Launches Kotlin Multiplatform applications with Gradle

# Variable Declarations
APP_PATH="$1"
APP_NAME="$2"
ACTION="${3:-start}"

# Check parameters
if [ -z "$APP_PATH" ] || [ -z "$APP_NAME" ]; then
    echo "Usage: $0 <app_path> <app_name> [action]"
    exit 1
fi

# Check if app directory exists
if [ ! -d "$APP_PATH" ]; then
    echo "ERROR: App directory not found: $APP_PATH"
    exit 1
fi

# Check for Kotlin Multiplatform files
BUILD_GRADLE_KTS="$APP_PATH/build.gradle.kts"
BUILD_GRADLE="$APP_PATH/build.gradle"
GRADLEW="$APP_PATH/gradlew"

if [ ! -f "$BUILD_GRADLE_KTS" ] && [ ! -f "$BUILD_GRADLE" ]; then
    echo "ERROR: build.gradle(.kts) not found in: $APP_PATH"
    exit 1
fi

# Verify it's a Kotlin Multiplatform project
MULTIPLATFORM_FOUND=false
if [ -f "$BUILD_GRADLE_KTS" ] && grep -q "kotlin.*multiplatform" "$BUILD_GRADLE_KTS" 2>/dev/null; then
    MULTIPLATFORM_FOUND=true
elif [ -f "$BUILD_GRADLE" ] && grep -q "kotlin.*multiplatform" "$BUILD_GRADLE" 2>/dev/null; then
    MULTIPLATFORM_FOUND=true
fi

if [ "$MULTIPLATFORM_FOUND" = false ]; then
    echo "ERROR: This doesn't appear to be a Kotlin Multiplatform project"
    exit 1
fi

echo "=== Kotlin Multiplatform Framework Launcher ==="
echo "App: $APP_NAME"
echo "Path: $APP_PATH"
echo "Action: $ACTION"
echo ""

# Change to app directory
cd "$APP_PATH"

# Use gradlew if available, otherwise gradle
GRADLE_CMD="gradle"
if [ -f "$GRADLEW" ]; then
    GRADLE_CMD="./gradlew"
    chmod +x "$GRADLEW"
fi

case "$ACTION" in
    "install")
        echo "Building Kotlin Multiplatform project..."
        $GRADLE_CMD build
        ;;
    "start"|"run")
        echo "Running Kotlin Multiplatform application..."
        $GRADLE_CMD run
        ;;
    "build")
        echo "Building all targets..."
        $GRADLE_CMD build
        ;;
    "build-js")
        echo "Building JavaScript target..."
        $GRADLE_CMD jsMainClasses
        ;;
    "build-jvm")
        echo "Building JVM target..."
        $GRADLE_CMD jvmMainClasses
        ;;
    "build-native")
        echo "Building native target..."
        $GRADLE_CMD nativeMainKlibrary
        ;;
    "test")
        echo "Running tests..."
        $GRADLE_CMD test
        ;;
    "test-js")
        echo "Running JavaScript tests..."
        $GRADLE_CMD jsTest
        ;;
    "test-jvm")
        echo "Running JVM tests..."
        $GRADLE_CMD jvmTest
        ;;
    "clean")
        echo "Cleaning Kotlin Multiplatform project..."
        $GRADLE_CMD clean
        ;;
    "tasks")
        echo "Showing available Gradle tasks..."
        $GRADLE_CMD tasks
        ;;
    *)
        echo "Unknown action: $ACTION"
        echo "Available actions: install, start, run, build, build-js, build-jvm, build-native, test, test-js, test-jvm, clean, tasks"
        exit 1
        ;;
esac

echo ""
echo "Kotlin Multiplatform launcher finished."