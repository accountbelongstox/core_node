# Escrcpy Start Scripts Usage Guide

This directory contains startup scripts for simplifying Escrcpy project development and build processes.

## Script Files

- `start.ps1` - Windows PowerShell script
- `start.sh` - Unix/Linux/macOS Bash script

---

## Quick Start

### Windows (PowerShell)

```powershell
# Method 1: Direct execution
.\scripts\start.ps1

# Method 2: If execution policy blocks
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\scripts\start.ps1

# Method 3: Bypass execution policy temporarily
powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1

# Important: If script changes don't take effect, close and reopen PowerShell
# to clear the script cache
```

### macOS/Linux (Bash)

```bash
# Method 1: Direct execution (script has execute permission)
./scripts/start.sh

# Method 2: If no execute permission
chmod +x ./scripts/start.sh
./scripts/start.sh

# Method 3: Use bash command
bash ./scripts/start.sh
```

---

## Features

### 1. Start Development Server
- Launch Vite + Electron development environment
- Automatic hot reload
- Server address: `http://localhost:1535`

### 2. Build Project
Choose build platform:
- **Windows** - Generate Windows installer (.exe)
- **macOS** - Generate macOS app bundle (.dmg, .app)
- **Linux** - Generate Linux packages (.AppImage, .deb)
- **All Platforms** - Build for all platforms simultaneously

### 3. Initialize Environment
Auto-check and configure development environment:
- Check if Node.js is installed
- Check and install pnpm
- Install project dependencies (node_modules)

### 4. Code Linting
Run ESLint to check code quality and standards

### 5. Fix Code Issues
Auto-fix fixable code issues (ESLint --fix)

### 6. Clean Project
Delete build artifacts and dependencies:
- node_modules
- dist
- dist-electron

### 7. Project Information
Display project details:
- Project name, version, description, author
- Project path
- Node.js and pnpm versions

---

## Usage Examples

### Scenario 1: First-time Development
```bash
# 1. Run script
./scripts/start.sh

# 2. Select "3. Initialize Environment"
#    Auto-install pnpm and project dependencies

# 3. Select "1. Start Development Server"
#    Begin development
```

### Scenario 2: Build Release
```bash
# 1. Run script
./scripts/start.sh

# 2. Select "2. Build Project"

# 3. Select target platform (e.g., "1. Windows")

# 4. Wait for build completion
#    Output files in dist and dist-electron directories
```

### Scenario 3: Code Quality Check
```bash
# 1. Run script
./scripts/start.sh

# 2. Select "4. Code Linting"
#    View code issues

# 3. Select "5. Fix Code Issues"
#    Auto-fix fixable issues
```

---

## Environment Requirements

### Required
- **Node.js** >= 16.0.0 ([Download](https://nodejs.org/))

### Auto-installed
- **pnpm** (script will prompt for installation)

### Additional Build Requirements

#### Windows Build
- Windows 10/11
- [Microsoft Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist)

#### macOS Build
- macOS 10.13 or higher
- Xcode Command Line Tools

#### Linux Build
- Linux distribution supporting AppImage/Deb
- `fakeroot` and `dpkg` (for .deb packages)

---

## Troubleshooting

### PowerShell Script Won't Run

**Problem**: "Cannot load file because running scripts is disabled on this system"

**Solution**:
```powershell
# Check current execution policy
Get-ExecutionPolicy

# Set execution policy
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Or bypass temporarily
powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1
```

### Bash Script Won't Run

**Problem**: "Permission denied"

**Solution**:
```bash
# Add execute permission
chmod +x ./scripts/start.sh

# Then run
./scripts/start.sh
```

### pnpm Installation Failed

**Problem**: npm install -g pnpm failed

**Solution**:
```bash
# Method 1: Use npm (recommended)
npm install -g pnpm

# Method 2: Use official install script (Unix/macOS)
curl -fsSL https://get.pnpm.io/install.sh | sh -

# Method 3: Use official install script (Windows PowerShell)
iwr https://get.pnpm.io/install.ps1 -useb | iex
```

### Node.js Version Too Old

**Problem**: Project requires Node.js >= 16

**Solution**:
1. Download and install latest Node.js: https://nodejs.org/
2. Or use nvm to manage Node.js versions:
   ```bash
   # Install nvm (Unix/macOS)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

   # Install and use Node.js 18
   nvm install 18
   nvm use 18
   ```

---

## Build Artifacts

After build completion, artifacts are located in:

```
dist/              # Vite build output
dist-electron/     # Electron build output
release/           # Final installers (may vary)
  ├── escrcpy-1.34.2-win.exe         # Windows installer
  ├── escrcpy-1.34.2-mac.dmg         # macOS installer
  └── escrcpy-1.34.2-linux.AppImage  # Linux installer
```

---

## Related Documentation

- [Escrcpy Official Docs](https://viarotel.eu.org/)
- [Development Guide](../develop.md)
- [Project README](../README.md)
- [Electron Docs](https://www.electronjs.org/docs)
- [Vite Docs](https://vitejs.dev/)
- [pnpm Docs](https://pnpm.io/)

---

## Tips

- First-time users should select "Initialize Environment" first
- Ensure all dependencies are installed before building
- Large project builds may take time, please be patient
- If issues occur, try "Clean Project" then reinstall dependencies

---

## Contributing

If you find bugs or have improvement suggestions, feel free to submit Issues or PRs!

---

**Happy Coding!**
