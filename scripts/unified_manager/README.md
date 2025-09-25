# Core Node Unified Application Manager

A comprehensive management system for all applications in the Core Node project, supporting Node.js, Python, PHP, Vue.js, Flutter, and Nuxt.js applications.

## Features

- **One-click dependency installation** for all project applications
- **Unified application startup** with support for single/multiple apps and presets
- **Automated build management** for buildable applications
- **Cross-platform support** (Windows PowerShell and Linux Shell)
- **Application registry** for centralized configuration management

## Quick Start

### Installation
```bash
# Install all dependencies
./scripts/unified_manager/install_all.sh

# Install specific type
./scripts/unified_manager/install_all.sh --type=frontend

# Install specific apps
./scripts/unified_manager/install_all.sh --apps=DevOps,nuxt_main:admin
```

### Starting Applications
```bash
# List available apps and presets
./scripts/unified_manager/start_apps.sh --list

# Start single application
./scripts/unified_manager/start_apps.sh --apps=DevOps

# Start multiple applications
./scripts/unified_manager/start_apps.sh --apps=DevOps,nuxt_main:dev,laravel_main

# Start preset configuration
./scripts/unified_manager/start_apps.sh --preset=dev-suite

# Start in background
./scripts/unified_manager/start_apps.sh --preset=dev-suite --background
```

### Building Applications
```bash
# List buildable applications
./scripts/unified_manager/build_apps.sh --list

# Build all buildable apps
./scripts/unified_manager/build_apps.sh --all

# Build specific apps
./scripts/unified_manager/build_apps.sh --apps=nuxt_main:admin,flutter_bloom

# Production build
./scripts/unified_manager/build_apps.sh --all --production
```

## Application Registry

The system uses `app_registry.json` to manage application configurations:

```json
{
  "apps": {
    "DevOps": {
      "type": "node",
      "category": "backend",
      "path": "apps/DevOps",
      "start_cmd": "node ../../main.js app=DevOps",
      "install_cmd": "npm install",
      "dependencies": ["ncore"],
      "ports": [3000]
    }
  },
  "presets": {
    "dev-suite": {
      "description": "Complete development environment",
      "apps": ["DevOps", "nuxt_main:dev", "laravel_main"]
    }
  }
}
```

## Integration with DD Scripts

The unified manager is integrated into the main dd.sh menu:

1. Run `./dd.sh`
2. Navigate to "Unified App Manager"
3. Choose from: install, start, build, list

## Supported Applications

### Apps Directory (9 applications)
- **DevOps**: DevOps management system
- **DocumentOffline**: Offline document processing
- **GetDocFromUrlByPuppeteer**: Web document scraping
- **VideoCompression**: Video compression service
- **VoiceClientAndCaddy**: Voice client with Caddy
- **WebLocalAreaNetwork**: Local area network web service
- **ai_translator_app**: AI translation application
- **flutter_icon_manager**: Flutter icon management
- **d3check**: Diablo III automation (Python)

### Poly Apps Directory (5 applications)
- **nuxt_main**: Multi-entry Nuxt.js application (5 sub-apps)
- **admin-vue-tailwind**: Vue.js admin dashboard
- **it-tools**: Developer tools collection
- **laravel_main**: Laravel API backend
- **flutter_bloom**: Flutter cross-platform app

## Command Reference

### install_all.ps1/.sh
```bash
Options:
  --type TYPE        Install apps of specific type (all, node, poly, python)
  --apps APPS        Comma-separated list of specific apps to install
  --force            Force reinstall dependencies
  --parallel         Install dependencies in parallel
  --skip-root        Skip root package.json installation
  --verbose          Verbose output
```

### start_apps.ps1/.sh
```bash
Options:
  --apps APPS        Comma-separated list of apps to start (app:subapp format)
  --preset PRESET    Preset configuration to start
  --background       Start apps in background
  --sequential       Start apps sequentially instead of parallel
  --list             List available apps and presets
  --verbose          Verbose output
  --delay SECONDS    Delay between starting apps (default: 2)
```

### build_apps.ps1/.sh
```bash
Options:
  --apps APPS        Comma-separated list of apps to build (app:subapp format)
  --type TYPE        Build apps of specific type (frontend, backend, mobile)
  --all              Build all buildable apps
  --production       Production build
  --clean            Clean before build
  --parallel         Build in parallel
  --list             List buildable apps
  --verbose          Verbose output
```

## Architecture

```
scripts/unified_manager/
├── app_registry.json          # Application configuration registry
├── install_all.ps1/.sh        # Dependency installation scripts
├── start_apps.ps1/.sh         # Application startup scripts
├── build_apps.ps1/.sh         # Application build scripts
└── common/
    ├── utils.ps1/.sh          # Common utility functions
    └── README.md              # This documentation
```

## Requirements

- **Node.js**: For Node.js and poly applications
- **Python**: For Python applications
- **PHP**: For Laravel applications
- **Flutter**: For Flutter applications
- **jq**: For JSON parsing in shell scripts
- **Package managers**: npm, yarn, pnpm, composer (as needed)

## Troubleshooting

### Common Issues

1. **Missing dependencies**: Run `install_all.sh` first
2. **Permission errors**: Ensure scripts are executable (`chmod +x`)
3. **Port conflicts**: Check if ports are already in use
4. **Missing package managers**: Install required tools (npm, yarn, etc.)

### Debug Mode
Add `--verbose` flag to any command for detailed output:
```bash
./scripts/unified_manager/start_apps.sh --apps=DevOps --verbose
```

## Contributing

When adding new applications:

1. Update `app_registry.json` with application configuration
2. Test installation, startup, and build processes
3. Update presets if the application should be included
4. Verify cross-platform compatibility
