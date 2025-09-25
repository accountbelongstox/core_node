# Core Node Unified Manager Development Guidelines

## Framework Architecture and Logic

### 1. Core Architectural Principles

#### 1.1 Unified Entry Point Architecture
The Core Node project implements a **unified entry point architecture** for maximum efficiency and maintainability:

- **Single Entry Point**: All NCore applications use `node ./main.js app={appname}` as the unified startup command
- **Shared Dependencies**: All applications share the root `package.json` and `node_modules` directory
- **Application Isolation**: Each application's logic resides in `apps/{appname}/main.js`
- **Parameter-Based Routing**: Applications are selected via the `app` parameter
- **Script Consistency**: All install/start/deploy/stop scripts follow identical patterns, differing only in the `appname` parameter

#### 1.2 Application Type Classification
Applications are strictly categorized by type with specific handling requirements:

```json
{
  "ncore-app": "NCore framework applications using unified entry point",
  "poly-vue": "Vue.js applications with independent package management",
  "poly-laravel": "Laravel applications with Composer dependency management",
  "poly-flutter": "Flutter applications with pub dependency management",
  "python": "Python applications managed via uv package manager",
  "java": "Java applications using Maven/Gradle build systems",
  "go": "Go applications with go mod dependency management",
  "php": "Pure PHP applications using Composer"
}
```

#### 1.3 Configuration Hardcoding Requirement
**CRITICAL**: All application configurations must be hardcoded in the registry system:

- **Prohibited**: Dynamic directory scanning or runtime discovery
- **Required**: Explicit definition in `app_registry.json`
- **Mandatory**: Complete specification of paths, commands, and dependencies
- **Enforced**: Type-specific validation and handling logic

### 2. Cross-Platform Execution Standards

#### 2.1 Windows Script Execution Architecture
Windows execution follows a **BAT-trigger-PS1** pattern for maximum compatibility:

**Execution Flow**:
```
User/System → .bat file → PowerShell script → Application
```

**Implementation Requirements**:
- **Entry Point**: Always use `.bat` files as the primary entry point
- **PowerShell Execution**: BAT files call PowerShell scripts with proper execution policies
- **Error Handling**: BAT files must validate PowerShell script existence and handle exit codes
- **Explorer Integration**: Use `explorer "path/to/script.bat"` for system integration

**Prohibited Practices**:
- ❌ Direct execution of `.ps1` files via explorer
- ❌ Relying on Windows file associations
- ❌ Using `explorer "script.ps1"` commands

**Required BAT Template**:
```batch
@echo off
REM Application Script (BAT Entry Point)
REM Complexity: [Simple|Complex] - [Description]

echo [INFO] Starting application...
set "SCRIPT_DIR=%~dp0"
set "PS1_SCRIPT=%SCRIPT_DIR%script.ps1"

if not exist "%PS1_SCRIPT%" (
    echo [ERROR] PowerShell script not found: %PS1_SCRIPT%
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1_SCRIPT%"
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Script execution failed with exit code: %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)

echo [SUCCESS] Script execution completed
exit /b 0
```

#### 2.2 Linux Script Execution Architecture
Linux execution uses direct shell script execution with service integration:

**Execution Flow**:
```
User/System → .sh file → Application
```

**Implementation Requirements**:
- **Direct Execution**: Shell scripts are executed directly
- **Service Integration**: Scripts can be registered as systemd services
- **Background Execution**: Support for `&` background execution
- **Resource Management**: Integration with systemd resource limits

#### 2.3 Path Resolution Standards
**Absolute Path Requirement**: All scripts must resolve absolute paths to prevent execution context issues:

**PowerShell Path Resolution**:
```powershell
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $SCRIPT_DIR)
$APP_DIR = Join-Path $PROJECT_ROOT "apps\AppName"
```

**Shell Path Resolution**:
```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
APP_DIR="$PROJECT_ROOT/apps/AppName"
```

### 3. Service Management Architecture

#### 3.1 System Service Integration
Applications can be deployed as system services with standardized naming and management:

**Service Naming Convention**:
- **Format**: `ncore-{appname}`
- **Case**: Lowercase application names
- **Uniqueness**: Each application gets a unique service name

**Service Management Features**:
- **Deployment**: Automatic service creation from application scripts
- **Resource Limits**: CPU and memory constraints via systemd
- **Auto-restart**: Automatic restart on failure
- **Logging**: Centralized logging via journald
- **Status Monitoring**: Real-time status and log viewing

#### 3.2 Service Template Architecture
Services use a standardized systemd template with resource management:

```ini
[Unit]
Description=NCore Service: {description}
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory={working_dir}
ExecStart={exec_command}
Restart=always
RestartSec=3
CPUQuota={cpu_limit}
MemoryMax={memory_limit}
MemoryHigh={memory_high}
TasksMax=100
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### 4. Development Workflow Standards

#### 4.1 Script Development Hierarchy
Scripts are organized in a hierarchical structure with clear separation of concerns:

**Directory Structure**:
```
scripts/unified_manager/
├── common/                    # Shared utilities and libraries
│   ├── utils.sh/.ps1         # Common utility functions
│   ├── debian_service_manager.sh  # Service management library
│   └── registry_parser.ps1   # Configuration parsing utilities
├── constants/                 # Configuration constants
│   ├── paths.json            # Path definitions
│   ├── commands.json         # Command templates
│   ├── versions.json         # Version requirements
│   └── services.json         # Service configurations
├── install_all.sh/.ps1       # Dependency installation
├── start_apps.sh/.ps1        # Application startup with service support
├── deploy_apps.sh            # Service deployment and management
└── build_apps.sh/.ps1        # Application building
```

#### 4.2 Script Complexity Classification
Each script must be classified by complexity in header comments:

**Simple Scripts**: Direct operations with minimal logic
```bash
# Complexity: Simple - Direct command execution
```

**Complex Scripts**: Multi-step operations requiring PowerShell/advanced shell features
```bash
# Complexity: Complex - Multi-step process with error handling
```

#### 4.3 Error Handling Standards
All scripts must implement comprehensive error handling:

**Required Error Handling**:
- **Exit Code Validation**: Check and propagate exit codes
- **Resource Validation**: Verify file/directory existence before operations
- **Dependency Checking**: Validate required tools and packages
- **Rollback Capability**: Ability to undo partial operations
- **Logging**: Comprehensive logging of operations and errors

### 5. Integration Standards

#### 5.1 DD.sh Menu Integration
The unified manager integrates with the main DD.sh menu system:

**Menu Structure**:
```
Unified App Manager
├── install     # Dependency installation
├── start       # Application startup (with service option)
├── build       # Application building
├── deploy      # Service deployment and management
└── list        # Available applications and presets
```

**Integration Requirements**:
- **Parameter Passing**: Support for command-line parameter integration
- **Interactive Mode**: Support for interactive selection menus
- **Background Execution**: Support for background process management
- **Service Integration**: Seamless integration with system service management

#### 5.2 Registry Integration
All operations must integrate with the centralized application registry:

**Registry Requirements**:
- **Hardcoded Configuration**: All applications must be explicitly defined
- **Type-Specific Handling**: Different logic for each application type
- **Command Specification**: Explicit definition of install/start/deploy commands
- **Dependency Declaration**: Clear specification of application dependencies

### 6. Technical Implementation Requirements

#### 6.1 Package Manager Integration
**CRITICAL**: Always use appropriate package managers instead of manual file editing:

**Supported Package Managers**:
- **JavaScript/Node.js**: npm, yarn, pnpm
- **Python**: pip, poetry, uv
- **PHP**: composer
- **Rust**: cargo
- **Go**: go mod
- **Java**: maven, gradle
- **C#/.NET**: dotnet

**Prohibited**: Direct editing of package.json, requirements.txt, composer.json, etc.

#### 6.2 Resource Management
Applications deployed as services must include resource management:

**Default Resource Limits**:
- **CPU**: 30% maximum usage
- **Memory**: 500MB maximum allocation
- **Tasks**: 100 maximum concurrent tasks
- **Restart**: Automatic restart with 3-second delay

#### 6.3 Security Standards
All scripts must implement security best practices:

**Security Requirements**:
- **Execution Policies**: Proper PowerShell execution policies
- **File Permissions**: Appropriate file and directory permissions
- **User Context**: Clear specification of execution user context
- **Input Validation**: Validation of all user inputs and parameters
- **Path Sanitization**: Prevention of path traversal attacks

### 7. Quality Assurance Standards

#### 7.1 Testing Requirements
All scripts must be tested across supported platforms:

**Testing Scope**:
- **Cross-Platform**: Windows PowerShell and Linux Shell
- **Error Conditions**: Handling of missing dependencies and files
- **Resource Limits**: Behavior under resource constraints
- **Service Integration**: Proper service creation and management
- **Rollback Testing**: Verification of rollback capabilities

#### 7.2 Documentation Standards
All scripts must include comprehensive documentation:

**Required Documentation**:
- **Header Comments**: Purpose, complexity, and usage instructions
- **Function Documentation**: Clear description of all functions
- **Parameter Documentation**: Description of all parameters and options
- **Example Usage**: Practical examples of script usage
- **Error Codes**: Documentation of all possible error conditions

### 8. Maintenance and Evolution

#### 8.1 Backward Compatibility
All changes must maintain backward compatibility:

**Compatibility Requirements**:
- **API Stability**: Existing command-line interfaces must remain functional
- **Configuration Migration**: Automatic migration of configuration changes
- **Script Compatibility**: Existing scripts must continue to function
- **Service Compatibility**: Existing services must remain operational

#### 8.2 Version Management
The framework includes version management for all components:

**Version Control**:
- **Semantic Versioning**: Use of semantic versioning for all components
- **Dependency Tracking**: Clear tracking of component dependencies
- **Update Management**: Automated update and migration processes
- **Rollback Capability**: Ability to rollback to previous versions

## Conclusion

These guidelines establish the technical foundation for the Core Node Unified Manager framework. They ensure consistency, reliability, and maintainability across all supported platforms while providing the flexibility needed for diverse application types and deployment scenarios.

All development must strictly adhere to these guidelines to maintain the integrity and functionality of the unified management system.