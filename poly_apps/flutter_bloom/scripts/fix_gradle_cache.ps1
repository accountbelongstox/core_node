# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using Split-Path, Join-Path, or Resolve-Path.
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Define the root directory of the Flutter project
$flutterProjectRoot = (Get-Item -Path $PSScriptRoot).Parent.FullName

# Change to the Flutter project root directory
Set-Location -Path $flutterProjectRoot

Write-Host "Starting comprehensive Gradle cache cleanup..." -ForegroundColor Green

# Stop all Gradle daemons
Write-Host "Stopping Gradle daemons..." -ForegroundColor Yellow
try {
    & "$env:USERPROFILE\.gradle\wrapper\dists\gradle-8.11.1-bin\*\gradle-8.11.1\bin\gradle.bat" --stop 2>$null
} catch {
    Write-Host "Could not stop Gradle daemons (this is normal if no daemons are running)" -ForegroundColor Yellow
}

# Clean Flutter project
Write-Host "Cleaning Flutter project..." -ForegroundColor Yellow
flutter clean

# Remove Flutter build directories  
Write-Host "Removing Flutter build directories..." -ForegroundColor Yellow
Remove-Item -Path (Join-Path $flutterProjectRoot "build") -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path $flutterProjectRoot ".dart_tool") -Recurse -Force -ErrorAction SilentlyContinue

# Remove Android build directories
Write-Host "Removing Android build directories..." -ForegroundColor Yellow
Remove-Item -Path (Join-Path $flutterProjectRoot "android\.gradle") -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path $flutterProjectRoot "android\build") -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path $flutterProjectRoot "android\app\build") -Recurse -Force -ErrorAction SilentlyContinue

# Clean Gradle global cache (the problematic one)
Write-Host "Cleaning Gradle global cache..." -ForegroundColor Yellow
$gradleCacheDir = Join-Path $env:USERPROFILE ".gradle\caches"
if (Test-Path $gradleCacheDir) {
    Write-Host "Removing Gradle cache directory: $gradleCacheDir" -ForegroundColor Red
    Remove-Item -Path $gradleCacheDir -Recurse -Force -ErrorAction SilentlyContinue
}

# Clean Gradle wrapper cache
Write-Host "Cleaning Gradle wrapper cache..." -ForegroundColor Yellow
$gradleWrapperDir = Join-Path $env:USERPROFILE ".gradle\wrapper"
if (Test-Path $gradleWrapperDir) {
    Remove-Item -Path $gradleWrapperDir -Recurse -Force -ErrorAction SilentlyContinue
}

# Clean Gradle daemon directory
Write-Host "Cleaning Gradle daemon directory..." -ForegroundColor Yellow
$gradleDaemonDir = Join-Path $env:USERPROFILE ".gradle\daemon"
if (Test-Path $gradleDaemonDir) {
    Remove-Item -Path $gradleDaemonDir -Recurse -Force -ErrorAction SilentlyContinue
}

# Get Flutter packages
Write-Host "Getting Flutter packages..." -ForegroundColor Yellow
flutter pub get

Write-Host "Gradle cache cleanup completed!" -ForegroundColor Green
Write-Host "You can now try building your project again." -ForegroundColor Green
