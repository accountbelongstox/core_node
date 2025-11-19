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

<#
.SYNOPSIS
    Applications list management and export utility

.DESCRIPTION
    This script manages application package definitions and can export them in JSON format
    for use by backup systems and other automation tools.

.PARAMETER OutputApplicationsList
    When specified, outputs the applications list in JSON format and exits.
    This is used by backup systems to get the list of applications to backup.

.EXAMPLE
    .\ApplicationsList.ps1 -OutputApplicationsList
    Outputs JSON array of all applications with their installation paths

.EXAMPLE
    . .\ApplicationsList.ps1
    Loads the applications configuration (normal usage)
#>

param(
    [Parameter(Mandatory=$false)]
    [switch]$OutputApplicationsList
)

# Import GlobalVars for access to global variables
$GlobalVarsPath = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common\GlobalVars.ps1"
. $GlobalVarsPath

<#POSTINSTALL_CALLBACKS_ANCHOR#>
<#
.SYNOPSIS
    Global base packages configuration for automated installation

.DESCRIPTION
    This hashtable defines base packages that will be automatically installed
    during the system setup process. Each package can specify its installation
    method and configuration.

.PARAMETER InstallType
    Supported installation methods:
    - "winget"  : Windows Package Manager (default, recommended for Windows)
    - "npm"     : Node.js Package Manager (for JavaScript/Node.js packages)
    - "pip"     : Python Package Installer (for Python packages)
    - "pipx"    : Python Package Installer for Applications (isolated Python apps)
    - "uv"      : Fast Python package installer and resolver
    - "poetry"  : Python dependency management and packaging tool
    - "choco"   : Chocolatey Package Manager (Windows alternative to winget)
    - "scoop"   : Scoop Package Manager (command-line installer for Windows)
    - "cargo"   : Rust Package Manager (for Rust crates)
    - "go"      : Go Module Manager (for Go packages)
    - "gem"     : RubyGems Package Manager (for Ruby gems)
    - "brew"    : Homebrew Package Manager (if available on Windows)
    - "powershell" : PowerShell Script Installation (for PowerShell-based installers)

.PARAMETER Required Properties
    - PackageId: Package ID for winget installation
    - ChocoId: Package ID for Chocolatey installation (fallback)
    - Exec: Main executable name for verification
    - Category: Package category for organization
    - Description: Human-readable description

.PARAMETER Optional Properties 
    - InstallType: Installation method (defaults to "winget")
    - EnvVars: Environment variables to set after installation
      * Type: @("Path") - Add to Windows PATH
      * Type: @("AddExec") - Create symbolic links to global executable directory
      * ExecutableFiles: @("file1.exe", "file2.exe") - Multiple binaries for AddExec (new feature)
    - DesktopShortcuts: Desktop shortcut configurations for easy access
    - AdditionalKeywords: Additional search keywords for executable detection
      * Used for binary file detection during installation verification
      * Should be specific to avoid false matches with other software
      * Minimum 2 keywords recommended for accurate detection
      * Avoid overly broad terms (e.g., "ai", "google", "code") that match many binaries
      * Use specific tool names, hyphenated variants, or unique identifiers
    - PowerShellCommand: PowerShell command to execute for installation (required for powershell InstallType)
      * Used for PowerShell-based installations (e.g., irm https://app.factory.ai/cli/windows | iex)
      * Should be a complete PowerShell command that can be executed with Invoke-Expression
      * Chinese software should use Unicode variables for cross-platform compatibility
    - ForceToInstallDir: Force to install to install directory, bucase some package need to install to install directory
    - AppCustomInstallDir: App specific install directory, if not specified, uses LANG_COMPILER_DIR\app_name
    - VerifySuffix: Verification suffix to test installation (e.g., "--version", "-v", "--help"). Will be appended to executable path for verification.
    - PostInstallCallbacks: Array of post-installation operations (copy/rename/delete/configure/registry)
      * Type: "copy" - Copy file (SourceFile -> TargetFile)
      * Type: "rename" - Rename/move file (SourceFile -> TargetFile)  
      * Type: "delete" - Delete file (TargetFile)
      * Type: "configurator" - Configure package manager settings (Executable -> Parameters)
      * Type: "registry_template" - Apply registry template with placeholder replacement
        - TemplateFile: Path to registry template file (relative to scripts directory)
        - Replacements: Hashtable of placeholder -> replacement mappings
          * "{{PLACEHOLDER}}" -> "EXECUTABLE_PATH" (uses actual executable path)
          * "{{PLACEHOLDER}}" -> "INSTALL_DIR" (uses installation directory)
          * "{{PLACEHOLDER}}" -> "ICON_PATH" (uses icon file path, falls back to executable if not found)
          * "{{PLACEHOLDER}}" -> "custom_value" (uses literal value)
        - Description: Description of the operation (optional)
        - RequiresAdmin: Whether admin privileges are required (optional, default: true)
      * Type: "mcp" - MCP (Model Context Protocol) configuration processor
        - Operation: "replace_path" - Replace executable path in MCP JSON config
        - Operation: "copy_config" - Copy MCP configuration to target directory
        - Operation: "merge_servers" - Merge MCP server configurations
        - McpConfigPath: Relative path to MCP configuration file
        - SearchValue: Value to search for in JSON (for replace_path operation)
        - TemplatePath: Template file path (optional, for initialization)
      * All file paths relative to executable directory (except registry_template)
      * Supports Unicode filenames via $Global:CHINESE_* variables
      * Configurator respects SELECTED_REGION global variable
      * Registry templates support automatic path escaping for Windows registry format

.PARAMETER DesktopShortcuts Details
    Array of desktop shortcut configurations. Each item can contain:
    - Name: (Optional) Custom shortcut name, defaults to Name ,if Name is not specified, uses Exec without extension
    - Keyword: (Optional) Custom keyword for finding executable, defaults to Exec
    - DesktopCategory: (Optional) Category folder name for organization
    
    Shortcuts are created in LANG_COMPILER_DIR\.desktopIcons\category\ and linked to desktop.
    This provides centralized management and category-based organization.

.EXAMPLE
    Pandoc = @{
        Name = "Pandoc"
        PackageId = "JohnMacFarlane.Pandoc"
        Exec = "pandoc.exe"
        DesktopCategory = "DocTools"
        Description = "Universal document converter"
        InstallType = "winget"
        ForceToInstallDir = $true # default is $true, if not specified, uses $false
        AdditionalKeywords = @() # if not specified, uses @($NAME without extension)
        AppCustomInstallDir = "c:\program files\pandoc"  it's app specific install dir, if not specified, uses LANG_COMPILER_DIR\app_name
        VerifySuffix = "--version" # if not specified, uses ""
        RegistrySearchKeyword = "Pandoc"  # if not specified, uses ""???if specified, will be used to search for uninstall entries
        EnvVars = @(
            @{
                Type = @("AddExec") # or @("Path")  Path is for Windows PATH, AddExec is for symbolic link to GlobalEnvs-Dir.
                # Type can also be @("TypeName", @("exec1", "exec2")) to specify multiple executables for environment variable configuration
            }
        )
        DesktopShortcuts = @(
            @{
                Name = "Pandoc"  # Shortcut name, if not specified uses Exec without extension
                # Keyword = "pandoc.exe"  # Optional, if not specified uses AdditionalKeywords
                CreateDesktopShortcut = $true
            }
        )
        # PostInstallCallbacks example for packages with multiple binaries or non-ASCII names
        PostInstallCallbacks = @(
            @{
                Type       = "copy"
                SourceFile = "$($Global:CHINESE_CUNZHI).exe"  # Chinese filename
                TargetFile = "cunzhi.exe"                     # English alias
            }
            @{
                Type       = "rename"
                SourceFile = "old_name.exe"
                TargetFile = "new_name.exe"
            }
            @{
                Type       = "configurator"
                Executable = "pip.exe"
                GlobalParameters = @()  # No configuration for Global region
                NonGlobalParameters = @(
                    @("config", "set", "global.index-url", "https://mirrors.huaweicloud.com/repository/pypi/simple"),
                    @("config", "set", "global.trusted-host", "mirrors.huaweicloud.com")
                )
            }
        )
        # EnvVars with ExecutableFiles for multiple binaries
        EnvVars = @(
            @{
                Type = @("AddExec")
                ExecutableFiles = @("binary1.exe", "binary2.exe", "alias1.exe", "alias2.exe")
            }
        )
    }

.NOTES
    - InstallType determines which package manager will be used
    - If InstallType is not specified, "winget" is used as default
    - Each installation method has its own implementation in Step32_InstallBasePackages.ps1
    - Environment variables are automatically configured after successful installation
    - Installation directory is automatically generated based on LANG_COMPILER_DIR and PackageId
    
    - IncludeSystemPaths: Controls whether system paths are included in package detection and installation
      * $true: Includes system paths (C:\Program Files, C:\Program Files (x86), etc.) 
               Useful for packages that should integrate with system installations
               Example: NodeJS (can use system Node.js if available)
      * $false: Only uses custom installation directories (LANG_COMPILER_DIR, APP_INSTALL_DIR)
               Prevents conflicts with system installations
               Example: Python (isolated installation to avoid version conflicts)
               
    - This parameter affects:
      * Package detection (Find-ExecutableByKeyword)
      * Installation verification
      * Environment variable setup
      * Binary path resolution
      
    - PostInstallCallbacks: Advanced post-installation operations
      * Executed after installation but before environment variable setup
      * All file paths are relative to the executable's parent directory
      * Callbacks are skipped if the main executable is not found
      * Failed callbacks generate warnings but do not fail the installation
      * Use Unicode variables ($Global:CHINESE_*) for non-ASCII filenames
      * Supports multiple binaries via ExecutableFiles in EnvVars
      * Configurator type: Uses SELECTED_REGION to choose parameters (China vs Global)
        - GlobalParameters: Commands executed when SELECTED_REGION is "Global"
        - NonGlobalParameters: Commands executed when SELECTED_REGION is "China"


# For PostInstallCallbacks usage, see: <#POSTINSTALL_CALLBACKS_ANCHOR#>

# Windows 10 Essential Patches Group - Critical system patches specifically for Windows 10
# This group contains essential Windows components that are missing in Windows 10 but built-in in Windows 11
# These patches are ONLY installed on Windows 10 systems for compatibility and feature parity
# Windows 11 systems already have these components built-in and do not need these patches
$Global:WINDOWS_10_ESSENTIAL_PATCHES = @{
    WindowsTerminal = @{
        PackageId          = "Microsoft.WindowsTerminal"
        Exec              = "wt.exe"
        Name              = "Windows Terminal"
        Description       = "Modern terminal application for Windows - Essential system component"
        InstallType       = "winget"
        ForceToInstallDir = $false
        VerifySuffix      = ""
        IncludeSystemPaths = $true
        AdditionalKeywords = @("wt")
        EnvVars           = @()
        DesktopShortcuts  = @()
        PostInstallCallbacks = @(
            @{
                Type = "registry_template"
                TemplateFile = "registry_templates\WindowsTerminal_ContextMenu.reg"
                Replacements = @{
                    "{{WT_EXECUTABLE_PATH}}" = "EXECUTABLE_PATH"
                    "{{WT_ICON_PATH}}" = "ICON_PATH"
                }
                Description = "Add Windows Terminal to right-click context menu"
                RequiresAdmin = $true
            }
        )
    }
}

$Global:BasePackages = @{
    Rust       = @{
        PackageId          = "Rustlang.Rust.MSVC"
        Exec              = "rustc.exe"
        Name              = "Rust"
        Description       = "Rust Programming Language - MSVC toolchain"
        InstallType       = "winget"
        ForceToInstallDir = $true
        VerifySuffix      = "--version"
        AdditionalKeywords = @("rustdoc", "cargo")
        EnvVars           = @(
            @{
                Type    = @("Path")
                Keyword = @("rustc.exe")
                SubPath = "bin"
            }
            @{
                Type    = @("Var")
                Name    = "RUST_HOME"
                Keyword = @("rustc.exe")
                SubPath = ""
            }
            @{
                Type    = @("Var")
                Name    = "CARGO_HOME"
                Keyword = @("rustc.exe")
                SubPath = ".cargo"
            }
        )
        DesktopShortcuts    = @()
        PostInstallCallbacks = @(
            @{
                Type = "rust"
                Operation = "full_setup"
                GlobalParameters = @()
                NonGlobalParameters = @(
                    # Use faster registry mirror for China region
                    @("--registry", "https://mirrors.ustc.edu.cn/crates.io-index")
                )
                ConfigNote = "Rust/Cargo registry configuration for China region"
            }
        )
    }
    NodeJS     = @{
        PackageId                       = "OpenJS.NodeJS.LTS"
        Exec                           = "node.exe"
        Name                           = "node"
        Description                    = "NodeJS - JavaScript Runtime"
        InstallType                    = "winget"
        ForceToInstallDir              = $true
        VerifySuffix                   = "--version"
        EnvVars                        = @(
            @{
                Type    = @("Path")
                Keyword = @("node.exe")
            }
        )
        DesktopShortcuts               = $null
        AdditionalInstallationPackages = @(
            @{
                installType    = "npm"
                installPackage = @("yarn", "pnpm", "pm2")
            }
        )
        PostInstallCallbacks = @(
            @{
                Type       = "configurator"
                Executable = "npm.cmd"
                GlobalParameters = @()  # No mirror configuration for Global region
                NonGlobalParameters = @(
                    @("config", "set", "registry", "https://registry.npmmirror.com"),
                    @("config", "set", "disturl", "https://npmmirror.com/dist"),
                    @("config", "set", "electron_mirror", "https://npmmirror.com/mirrors/electron/"),
                    @("config", "set", "sass_binary_site", "https://npmmirror.com/mirrors/node-sass"),
                    @("config", "set", "phantomjs_cdnurl", "https://npmmirror.com/mirrors/phantomjs")
                )
            }
        )
    }
    Python313  = @{
        Version           = "3.13"
        PackageId          = "Python.Python.3.13"
        Exec              = "python.exe"
        Name              = "python313"
        Description       = "Python 3.13 - Programming Language"
        InstallType       = "winget"
        ForceToInstallDir = $true
        VerifySuffix      = "--version"
        IncludeSystemPaths = $false
        IsDefault         = $true
        EnvVars           = @(
            @{
                Type    = @("Path")
                Keyword = @("python.exe")
            }
            @{
                Type    = @("Path")
                Keyword = @("pip.exe")
            }
            @{
                Type    = @("Path")
                Keyword = @("uv.exe")
            }
            @{
                Type    = @("Path")
                Keyword = @("pipx.exe")
            }
            @{
                Type    = @("Path")
                Keyword = @("poetry.exe")
            }
            @{
                Type    = @("Path")
                Keyword = @("uvx.exe")
            }
        )
        AdditionalInstallationPackages = @(
            @{
                installType    = "pip"
                installPackage = @(
                     "pipx",
                     "uv",
                     "poetry",
                    "flake8",
                    @{
                        packageName = "numpy"
                        validationType = "import"
                        importName = "numpy"
                    }, 
                    @{
                        packageName = "pandas"
                        validationType = "import"
                        importName = "pandas"
                    }, 
                    @{
                        packageName = "matplotlib"
                        validationType = "import"
                        importName = "matplotlib"
                    },
                    @{
                        packageName = "pillow"
                        validationType = "import"
                        importName = "PIL"
                    },
                    @{
                        packageName = "requests"
                        validationType = "import"
                        importName = "requests"
                    }, 
                    "flask", 
                    "django", 
                    "jupyter", 
                    @{
                        packageName = "scipy"
                        validationType = "import"
                        importName = "scipy"
                    }, 
                    @{
                        packageName = "scikit-learn"
                        validationType = "import"
                        importName = "sklearn"
                    },
                    @{
                        packageName = "edge-tts"
                        validationType = "import"
                        importName = "edge_tts"
                    }
                )
            }
        )
        PostInstallCallbacks = @(
            @{
                Type       = "copy"
                SourceFile = "python.exe"
                TargetFile = "python3.exe"
            }
            @{
                Type       = "copy"
                SourceFile = "Scripts\pip.exe"
                TargetFile = "Scripts\pip3.exe"
            }
            @{
                Type       = "configurator"
                Executable = "Scripts\pip.exe"
                GlobalParameters = @()  # No mirror configuration for Global region
                NonGlobalParameters = @(
                    @("config", "set", "global.index-url", "https://mirrors.huaweicloud.com/repository/pypi/simple"),
                    @("config", "set", "global.trusted-host", "mirrors.huaweicloud.com")
                )
            }
        )
    }
    PHP84      = @{
        Exec              = "php.exe"
        Name              = "php84"
        Description       = "PHP 8.4 - Server-side scripting language"
        InstallType       = "combo"
        ForceToInstallDir = $true
        VerifySuffix      = "--version"
        AdditionalKeywords = @("php-cli", "php8")
        ComboMethods      = @(
            @{
                InstallType = "winget"
                PackageId   = "PHP.PHP.8.4"
            }
            @{
                InstallType    = "choco"
                PackageId      = "php"
                ChocoOptions   = @("--version=8.4")
            }
            @{
                InstallType = "scoop"
                PackageId   = "php84"
            }
            @{
                InstallType     = "web"
                PackageId       = "php-8.4.12-Win32-vs17-x64.zip"
                DownloadUrl     = "https://downloads.php.net/~windows/releases/php-8.4.12-Win32-vs17-x64.zip"
                ExecutableName  = "php.exe"
                IsArchive       = $true
                ArchiveType     = "zip"
            }
        )
        EnvVars           = @(
            @{
                Type    = @("Path")
                Keyword = @("php.exe", "composer.exe", "composer.bat")
            }
        )
        DesktopShortcuts  = $null
        PostInstallCallbacks = @(
            @{
                Type = "php"
                Operation = "full_setup"
            }
        )
    }
    Pandoc     = @{
        PackageId           = "JohnMacFarlane.Pandoc"
        Exec               = "pandoc.exe"
        Name               = "Pandoc"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_DOCUMENT_TOOLS
        Description        = "Universal document converter"
        InstallType        = "winget"
        ForceToInstallDir  = $true
        AdditionalKeywords = @()
        VerifySuffix       = "--version"
        EnvVars            = @(
            @{
                Type = @("AddExec")
            }
        )
        DesktopShortcuts   = $null
    }
    Fnm        = @{
        PackageId            = "Schniz.fnm"
        Exec                = "fnm.exe"
        Name                = "Fnm"
        DesktopCategory     = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS
        Description         = "Fast Node Manager"
        InstallType         = "winget"
        ForceToInstallDir   = $true
        VerifySuffix        = ""
        MenuName            = ""
        AppCustomInstallDir = ""
        DesktopShortcuts    = @()
        EnvVars             = @(
            @{
                Type = @("AddExec")
            }
        )
    }
    GNUWget    = @{
        PackageId          = "JernejSimoncic.Wget"
        Exec              = "wget.exe"
        Name              = "GNUWget"
        DesktopCategory   = $Global:DESKTOP_CATEGORY_NETWORK_TOOLS
        Description       = "GNU Wget - Network downloader"
        InstallType       = "winget"
        ForceToInstallDir = $true
        VerifySuffix      = ""
        MenuName          = ""
        DesktopShortcuts  = @()
        EnvVars           = @(
            @{
                Type = @("AddExec")
            }
        )
    }
    DartSDK    = @{
        PackageId          = "Google.DartSDK"
        Exec              = "dart.exe"
        Name              = "dart_sdk"
        DesktopCategory   = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS
        Description       = "Dart SDK for building fast apps on any platform"
        InstallType       = "winget"
        ForceToInstallDir = $true
        VerifySuffix      = "--version"
        EnvVars           = @(
            @{
                Type = @("Path")
            }
        )
    }
    MermaidCLI = @{
        NpmPackageName     = "@mermaid-js/mermaid-cli"
        Exec               = "mmdc"
        Name               = "MermaidCLI"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_DOCUMENT_TOOLS
        Description        = "Mermaid CLI - Command line interface for Mermaid diagrams"
        InstallType        = "npm"
        ForceToInstallDir  = $false
        VerifySuffix       = "--version"
        AdditionalKeywords = @("mermaid", "mermaid-cli")
        EnvVars            = @(
            @{
                Type = @("AddExec")
            }
        )
        DesktopShortcuts   = $null
    }
    Java       = @{
        PackageId          = "Oracle.JDK.17"
        Exec              = "java.exe"
        Name              = "Java"
        DesktopCategory   = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS
        Description       = "Java Development Kit - Programming language and runtime"
        InstallType       = "winget"
        ForceToInstallDir = $true
        VerifySuffix      = "--version"
        AdditionalKeywords = @("openjdk", "java-jdk")
        EnvVars           = @(
            @{
                Type    = @("Path")
                Keyword = @("java.exe")
                SubPath = "bin"
            }
            @{
                Type    = @("Path") 
                Keyword = @("javac.exe")
                SubPath = "bin"
            }
            @{
                Type    = @("Var")
                Name    = "JAVA_HOME"
                Keyword = @("java.exe")
                SubPath = ""
            }
            @{
                Type    = @("Var")
                Name    = "JDK_HOME"
                Keyword = @("java.exe")
                SubPath = ""
            }
        )
        DesktopShortcuts  = $null
        PostInstallCallbacks = @(
            @{
                Type = "java"
                Operation = "full_setup"
                GlobalParameters = @()  # No mirror configuration for Global region
                NonGlobalParameters = @(
                    # Set Maven mirror for faster downloads in China
                    @("-Dmaven.repo.remote=https://maven.aliyun.com/repository/public"),
                    @("-Dmaven.wagon.http.ssl.insecure=true")
                )
                ConfigNote = "Java/Maven mirror configuration for China region"
            }
        )
    }
    Go         = @{
        PackageId          = "GoLang.Go"
        Exec              = "go.exe"
        Name              = "Go"
        DesktopCategory   = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS
        Description       = "Go Programming Language - Fast, reliable, and efficient software"
        InstallType       = "winget"
        ForceToInstallDir = $true
        VerifySuffix      = "version"
        AdditionalKeywords = @("golang", "go-lang")
        EnvVars           = @(
            @{
                Type    = @("Path")
                Keyword = @("go.exe")
                SubPath = "bin"
            }
            @{
                Type    = @("Var")
                Name    = "GOROOT"
                Keyword = @("go.exe")
                SubPath = ""
            }
            @{
                Type    = @("Var")
                Name    = "GOPATH"
                Keyword = @("go.exe")
                SubPath = "go"
            }
        )
        DesktopShortcuts  = $null
        PostInstallCallbacks = @(
            @{
                Type = "go"
                Operation = "full_setup"
                GlobalParameters = @()
                NonGlobalParameters = @(
                    # Use faster proxy for China region
                    @("GOPROXY=https://goproxy.cn,direct"),
                    @("GOSUMDB=sum.golang.google.cn")
                )
                ConfigNote = "Go proxy configuration for China region"
            }
        )
    }
    Ruby       = @{
        PackageId          = "RubyInstallerTeam.RubyWithDevKit.3.4"
        Exec              = "ruby.exe"
        Name              = "Ruby"
        DesktopCategory   = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS
        Description       = "Ruby Programming Language - Dynamic, open source programming language"
        InstallType       = "winget"
        ForceToInstallDir = $true
        VerifySuffix      = "--version"
        AdditionalKeywords = @("ruby-lang", "gem", "bundler")
        EnvVars           = @(
            @{
                Type    = @("Path")
                Keyword = @("ruby.exe")
                SubPath = "bin"
            }
            @{
                Type    = @("Var")
                Name    = "RUBY_HOME"
                Keyword = @("ruby.exe")
                SubPath = ""
            }
        )
        DesktopShortcuts  = $null
        PostInstallCallbacks = @(
            @{
                Type = "ruby"
                Operation = "full_setup"
                GlobalParameters = @()
                NonGlobalParameters = @(
                    # Use faster gem source for China region
                    @("--source", "https://gems.ruby-china.com/")
                )
                ConfigNote = "Ruby gem source configuration for China region"
            }
        )
    }
}
# For PostInstallCallbacks usage, see: <#POSTINSTALL_CALLBACKS_ANCHOR#>
$Global:APPLICATIONS_PACKAGES = @{
    VSCode          = @{
        PackageId            = "Microsoft.VisualStudioCode"
        Exec                = "Code.exe"
        Name                = "VSCode"
        DesktopCategory     = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS
        Description         = "Visual Studio Code - Code editor"
        InstallType         = "winget"
        ForceToInstallDir   = $true
        VerifySuffix        = ""
        # Legacy fields preserved
        MenuName            = "Open with VSCode"
        AppCustomInstallDir = "C:\Users\$env:USERNAME\AppData\Local\Programs\Microsoft VS Code"
        EnvVars             = @(
            @{
                Type = @("AddExec")
            }
        )
        DesktopShortcuts    = @(
            @{
                Name = "VSCode"
            }
        )
        PostInstallCallbacks = @(
            @{
                Type = "context_menu"
                Operation = "add_file_context"
                FileExtensions = @("*")
                MenuText = "Open with VSCode"
                IconPath = "EXECUTABLE_PATH"
                Description = "Add VSCode to file context menu for all file types"
            }
            @{
                Type = "context_menu"
                Operation = "add_folder_context"
                MenuText = "Open Folder in VSCode"
                Command = "`"{{EXECUTABLE_PATH}}`" `"%1`""
                IconPath = "EXECUTABLE_PATH"
                Description = "Add folder context menu to open folder in VSCode"
            }
        )
    }
    RustDesk        = @{
        PackageId           = "RustDesk.RustDesk"
        Exec               = "RustDesk.exe"
        Name               = "RustDesk"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_NETWORK_TOOLS
        Description        = "RustDesk - Open source remote desktop software"
        InstallType        = "winget"
        ForceToInstallDir  = $true
        VerifySuffix       = ""
        AdditionalKeywords = @("rustdesk", "remote-desktop", "remote-access")
        EnvVars            = @(
            @{
                Type = @("AddExec")
            }
        )
        DesktopShortcuts   = @(
            @{
                Name = "RustDesk"
            }
        )
    }
    ACLI            = @{
        Exec              = "acli.exe"
        Name              = "ACLI"
        DesktopCategory   = $Global:DESKTOP_CATEGORY_AI_CLI_TOOLS
        Description       = "Atlassian CLI - Command line interface for Atlassian products"
        InstallType       = "web"
        ForceToInstallDir = $true
        VerifySuffix      = "--help"
        PackageId         = "https://acli.atlassian.com/windows/latest/acli_windows_amd64/acli.exe"
        ExecutableName    = "acli.exe"
        MenuName          = "Atlassian CLI"
        EnvVars           = @(
            @{
                Type = @("AddExec")
            }
        )
    }
    Windsurf        = @{
        PackageId          = "Codeium.Windsurf"
        Exec              = "Windsurf.exe"
        Name              = "Windsurf"
        DesktopCategory   = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS
        Description       = "Windsurf - AI-powered code editor by Codeium"
        InstallType       = "winget"
        ForceToInstallDir = $true
        VerifySuffix      = ""
        MenuName          = "Open with Windsurf"
        # AppCustomInstallDir = "C:\Users\$env:USERNAME\AppData\Local\Programs\Windsurf"
        EnvVars           = @(
            @{
                Type = @("AddExec")
            }
        )
        DesktopShortcuts  = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    VSCodium        = @{
        PackageId            = "VSCodium.VSCodium"
        Exec                = "VSCodium.exe"
        Name                = "VSCodium"
        DesktopCategory     = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS
        Description         = "VSCodium - Open source binary distribution of VS Code"
        InstallType         = "winget"
        ForceToInstallDir   = $true
        VerifySuffix        = ""
        MenuName            = "Open with VSCodium"
        AppCustomInstallDir = "C:\Users\$env:USERNAME\AppData\Local\Programs\VSCodium"
        RegistrySearchKeyword = "VSCodium"
        EnvVars             = @(
            @{
                Type = @("AddExec")
            }
        )
        DesktopShortcuts    = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    Neovim          = @{
        PackageId            = "Neovim.Neovim"
        Exec                = "nvim.exe"
        Name                = "Neovim"
        DesktopCategory     = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS
        Description         = "Neovim - Hyperextensible Vim-based text editor"
        InstallType         = "winget"
        ForceToInstallDir   = $false
        VerifySuffix        = ""
        MenuName            = "Open with Neovim"
        AppCustomInstallDir = "C:\Program Files\Neovim"
        DesktopShortcuts    = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
        EnvVars             = @(
            @{
                Type = @("AddExec")
            }
        )
    }
    Vim             = @{
        PackageId            = "vim.vim"
        Exec                = "vim.exe"
        Name                = "Vim"
        DesktopCategory     = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS
        Description         = "Vim - Highly configurable text editor"
        InstallType         = "winget"
        ForceToInstallDir   = $false
        VerifySuffix        = ""
        MenuName            = "Open with Vim"
        AppCustomInstallDir = ""
        DesktopShortcuts    = @(
            @{
                CreateDesktopShortcut = $false
            }
        )
        EnvVars             = @(
            @{
                Type = @("AddExec")
            }
        )
    }
    PuTTY           = @{
        PackageId            = "PuTTY.PuTTY"
        Exec                = "putty.exe"
        Name                = "PuTTY"
        DesktopCategory     = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS
        Description         = "PuTTY - Free SSH and Telnet client"
        InstallType         = "winget"
        ForceToInstallDir   = $false
        VerifySuffix        = ""
        AppCustomInstallDir = ""
        DesktopShortcuts    = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
        EnvVars             = @(
            @{
                Type = @("AddExec")
            }
        )
    }
    NotepadPlusPlus = @{
        PackageId          = "Notepad++.Notepad++"
        Exec              = "notepad++.exe"
        Name              = "notepad++"
        DesktopCategory   = $Global:DESKTOP_CATEGORY_TEXT_EDITORS
        Description       = "Notepad++ - Text editor"
        InstallType       = "winget"
        ForceToInstallDir = $true
        VerifySuffix      = ""
        MenuName          = "Edit with Notepad++"
        DesktopShortcuts  = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
        EnvVars           = @(
            @{
                Type = @("AddExec")
            }
        )
        PostInstallCallbacks = @(
            @{
                Type = "context_menu"
                Operation = "add_all_files_context"
                MenuText = "Edit with Notepad++"
                Description = "Add Notepad++ to context menu for ALL file types"
            }
        )
    }
    Cursor          = @{
        PackageId            = "Anysphere.Cursor"
        Exec                = "Cursor.exe"
        Name                = "Cursor"
        DesktopCategory     = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS
        Description         = "Cursor - AI-powered code editor"
        InstallType         = "winget"
        ForceToInstallDir   = $true
        VerifySuffix        = ""
        MenuName            = "Open with Cursor"
        AppCustomInstallDir = "C:\Users\$env:USERNAME\AppData\Local\Programs\cursor"
        DesktopShortcuts    = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
        EnvVars             = @(
            @{
                Type = @("AddExec")
            }
        )
    }
    Bandizip        = @{
        PackageId            = "Bandisoft.Bandizip"
        Exec                = "Bandizip.exe"
        Name                = "Bandizip"
        DesktopCategory     = $Global:DESKTOP_CATEGORY_COMPRESSION_TOOLS
        Description         = "Bandizip - Archive manager"
        InstallType         = "winget"
        ForceToInstallDir   = $true
        VerifySuffix        = ""
        MenuName            = "Extract with Bandizip"
        AppCustomInstallDir = ""
        DesktopShortcuts    = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    PowerToys       = @{
        PackageId            = "Microsoft.PowerToys"
        Exec                = "PowerToys.exe"
        Name                = "PowerToys"
        DesktopCategory     = $Global:DESKTOP_CATEGORY_SYSTEM_TOOLS
        Description         = "Microsoft PowerToys - Windows system utilities"
        InstallType         = "winget"
        ForceToInstallDir   = $false
        VerifySuffix        = ""
        AdditionalKeywords  = @("PowerToys", "microsoft-powertoys")
        DesktopShortcuts    = @(
            @{
                Name = "PowerToys"
                CreateDesktopShortcut = $true
            }
        )
        EnvVars             = @(
        )
    }
    Kiro            = @{
        PackageId            = "Amazon.Kiro"
        Exec                = "Kiro.exe"
        Name                = "Kiro"
        DesktopCategory     = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS
        Description         = "Kiro - AI-powered development environment"
        InstallType         = "winget"
        ForceToInstallDir   = $true
        VerifySuffix        = ""
        MenuName            = "Open with Kiro"
        AppCustomInstallDir = ""
        DesktopShortcuts    = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
        EnvVars             = @(
            @{
                Type = @("AddExec")
            }
        )
    }
}


# Global Development Software Variables
# For PostInstallCallbacks usage, see: <#POSTINSTALL_CALLBACKS_ANCHOR#>
$Global:DEV_SOFTWARE_PACKAGES = @{
    Termius        = @{
        PackageId           = "Termius.Termius"
        Exec               = "Termius.exe"
        Name               = "Termius"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_NETWORK_TOOLS
        Description        = "Cross-platform SSH client with modern interface"
        InstallType        = "winget"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("Termius", "ssh-client")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    Captura = @{
        PackageId           = "Captura.Captura"
        Exec               = "Captura.exe"
        Name               = "Captura"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_MEDIA_TOOLS
        Description        = "Captura - Screen recorder"
        InstallType        = "winget"
        ForceToInstallDir  = $true
        VerifySuffix       = ""
        AdditionalKeywords = @("Captura", "screen-recorder")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    Postman        = @{
        PackageId           = "Postman.Postman"
        Exec               = "Postman.exe"
        Name               = "Postman"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_API_TOOLS
        Description        = "API development and testing platform"
        InstallType        = "winget"
        ForceToInstallDir  = $true
        VerifySuffix       = ""
        AdditionalKeywords = @("Postman", "api-testing")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
        EnvVars            = @(
            @{
                Type = @("AddExec")
            }
        )
    }
    HeidiSQL       = @{
        PackageId           = "HeidiSQL.HeidiSQL"
        Exec               = "heidisql.exe"
        Name               = "HeidiSQL"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_DATABASE_TOOLS
        Description        = "Lightweight MySQL/MariaDB database client"
        InstallType        = "winget"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("HeidiSQL", "mysql-client")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    DBeaver        = @{
        PackageId           = "DBeaver.DBeaver.Community"
        Exec               = "dbeaver.exe"
        Name               = "DBeaver"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_DATABASE_TOOLS
        Description        = "Universal database tool for developers"
        InstallType        = "winget"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("TablePlus", "database-gui")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    WinSCP         = @{
        PackageId           = "WinSCP.WinSCP.RC"
        Exec               = "WinSCP.exe"
        Name               = "WinSCP"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_NETWORK_TOOLS
        Description        = "SFTP/FTP client with dual-pane interface"
        InstallType        = "winget"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("WinSCP", "sftp-client")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    Rclone         = @{
        PackageId           = "Rclone.Rclone"
        Exec               = "rclone.exe"
        Name               = "Rclone"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_NETWORK_TOOLS
        Description        = "Command-line cloud storage synchronization tool"
        InstallType        = "winget"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("CloudMounter", "cloud-storage")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    Insomnia       = @{
        PackageId           = "Insomnia.Insomnia"
        Exec               = "Insomnia.exe"
        Name               = "Insomnia"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_API_TOOLS
        Description        = "REST API client with GraphQL support"
        InstallType        = "winget"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("Insomnia", "rest-client")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    DrawIO         = @{
        PackageId           = "JGraph.Draw"
        Exec               = "draw.io.exe"
        Name               = "DrawIO"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_DESIGN_TOOLS
        Description        = "Free online diagram software for flowcharts"
        InstallType        = "winget"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("draw.io", "diagram-editor")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    WinSocat       = @{
        PackageId           = "Firejox.WinSocat"
        Exec               = "socat.exe"
        Name               = "WinSocat"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_NETWORK_TOOLS
        Description        = "Windows port of socat network utility"
        InstallType        = "winget"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("Nmap", "network-scanner")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    Nmap           = @{
        PackageId           = "Insecure.Nmap"
        Exec               = "nmap.exe"
        Name               = "Nmap"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_NETWORK_TOOLS
        Description        = "Network discovery and security auditing tool"
        InstallType        = "winget"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("Nessus", "vulnerability-scanner")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    FiddlerClassic = @{
        PackageId           = "Telerik.Fiddler.Classic"
        Exec               = "Fiddler.exe"
        Name               = "FiddlerClassic"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_NETWORK_TOOLS
        Description        = "Web debugging proxy for HTTP/HTTPS traffic"
        InstallType        = "winget"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("Fiddler", "http-proxy")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    iPerf3         = @{
        PackageId           = "ar51an.iPerf3"
        Exec               = "iperf3.exe"
        Name               = "iPerf3"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_NETWORK_TOOLS
        Description        = "Network bandwidth measurement tool"
        InstallType        = "winget"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("NetLimiter", "bandwidth-monitor")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    Wireshark      = @{
        PackageId           = "WiresharkFoundation.Wireshark"
        Exec               = "Wireshark.exe"
        Name               = "Wireshark"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_NETWORK_TOOLS
        Description        = "Network protocol analyzer and packet capture tool"
        InstallType        = "winget"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("Wireshark", "packet-analyzer")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    HTTPie         = @{
        PackageId           = "HTTPie.HTTPie"
        Exec               = "http.exe"
        Name               = "HTTPie"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_API_TOOLS
        Description        = "Command-line HTTP client with JSON support"
        InstallType        = "winget"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("HTTPie", "http-client")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    Droid          = @{
        PackageId           = ""
        Exec               = "droid.exe"
        Name               = "Droid"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_AI_CLI_TOOLS
        Description        = "AI-powered development assistant from Factory.ai"
        InstallType        = "powershell"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("Droid", "factory-ai", "ai-assistant")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
        EnvVars            = @(
            @{
                Type = @("AddExec")
            }
        )
        PowerShellCommand  = "irm https://app.factory.ai/cli/windows | iex"
    }
    ClaudeCodeRouter = @{
        PackageId           = ""
        Exec               = "claude-code-router.exe"
        Name               = "ClaudeCodeRouter"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_AI_CLI_TOOLS
        Description        = "Claude Code Router for AI-powered code analysis and routing"
        InstallType        = "powershell"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("ClaudeCodeRouter", "claude-router", "code-analysis")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
        EnvVars            = @(
            @{
                Type = @("AddExec")
            }
        )
        PowerShellCommand  = "irm https://app.factory.ai/cli/windows | iex"
    }
    AlibabaQoder   = @{
        PackageId           = "Alibaba.Qoder"
        Exec               = "Qoder.exe"
        Name               = "AlibabaQoder"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS
        Description        = "Alibaba Qoder - AI-powered code editor and development tool"
        InstallType        = "winget"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("Qoder", "$($Global:CHINESE_ALIBABA)Qoder")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    ChromeRemoteDesktopHost = @{
        PackageId          = "Google.ChromeRemoteDesktopHost"
        Exec              = "remoting_host.exe"
        Name              = "ChromeRemoteDesktopHost"
        DesktopCategory   = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS
        Description       = "Chrome Remote Desktop Host - Remote access solution"
        InstallType       = "winget"
        ForceToInstallDir = $false
        VerifySuffix      = ""
        AdditionalKeywords = @("remoting_host", "chrome-remote")
        EnvVars           = @()
        DesktopShortcuts  = $null
    }
    GeminiCli = @{
        PackageId         = "@google/gemini-cli"
        Exec              = "gemini"
        Name              = "GeminiCli"
        DesktopCategory   = $Global:DESKTOP_CATEGORY_AI_CLI_TOOLS
        Description       = "Google Gemini CLI - AI assistant with MCP server integration support"
        InstallType       = "npm"
        ForceToInstallDir = $false
        VerifySuffix      = "--version"
        AdditionalKeywords = @("gemini-cli", "gemini.cmd", "gemini.bat")
        EnvVars           = @(
            @{
                Type = @("Path")
                Keyword = @("gemini")
            }
        )
        PostInstallCallbacks = @(
            @{
                Type = "mcp"
                Operation = "copy_config"
                TargetDirectory = "$env:USERPROFILE\.gemini"
            }
        )
    }
    ClaudeCode = @{
        PackageId         = "@anthropic-ai/claude-code"
        Exec              = "claude.exe"
        Name              = "ClaudeCode"
        DesktopCategory   = $Global:DESKTOP_CATEGORY_AI_CLI_TOOLS
        Description       = "Anthropic Claude Code - AI-powered development assistant"
        InstallType       = "npm"
        ForceToInstallDir = $false
        VerifySuffix      = "--version"
        AdditionalKeywords = @("claude", "claude-code")
        EnvVars           = @(
            @{
                Type = @("Path")
            }
        )
        PostInstallCallbacks = @(
            @{
                Type = "mcp"
                Operation = "copy_config"
                TargetDirectory = "$env:USERPROFILE\.claude"
            }
            @{
                Type = "mcp"
                Operation = "exec_command"
                Command = 'npx claude mcp add context7 -- cmd /c "npx -y @upstash/context7-mcp"'
                Description = "Add context7 MCP service to Claude"
            }
        )
    }
    Tabby = @{
        PackageId           = "Eugeny.Tabby"
        Exec               = "Tabby.exe"
        Name               = "Tabby"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS
        Description        = "Modern terminal with tabs, SSH and telnet support"
        InstallType        = "winget"
        ForceToInstallDir  = $false
        VerifySuffix       = "--version"
        AdditionalKeywords = @("Tabby", "terminal", "ssh-client")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
        EnvVars            = @(
            @{
                Type = @("AddExec")
            }
        )
    }
    MobaXterm = @{
        PackageId           = "Mobatek.MobaXterm"
        Exec               = "MobaXterm.exe"
        Name               = "MobaXterm"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS
        Description        = "Enhanced terminal with SSH, X11, RDP and network tools"
        InstallType        = "winget"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("MobaXterm", "terminal", "ssh-client", "rdp")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
        EnvVars            = @(
            @{
                Type = @("AddExec")
            }
        )
    }
    mRemoteNG = @{
        PackageId           = "mRemoteNG.mRemoteNG"
        Exec               = "mRemoteNG.exe"
        Name               = "mRemoteNG"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_NETWORK_TOOLS
        Description        = "Multi-protocol remote connections manager (RDP, VNC, SSH, Telnet, HTTP/S)"
        InstallType        = "winget"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("mRemoteNG", "rdp-manager", "remote-desktop-manager")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
        EnvVars            = @(
            @{
                Type = @("AddExec")
            }
        )
    }
    OpenAICodex = @{
        PackageId         = "@openai/codex"
        Exec              = "codex.exe"
        Name              = "OpenAICodex"
        DesktopCategory   = $Global:DESKTOP_CATEGORY_AI_CLI_TOOLS
        Description       = "OpenAI Codex - AI code generation and completion tool"
        InstallType       = "npm"
        ForceToInstallDir = $false
        VerifySuffix      = "--version"
        AdditionalKeywords = @("codex", "openai-codex")
        EnvVars           = @(
            @{
                Type = @("Path")
            }
        )
        # TODO: Unknown callback requirements for OpenAI Codex
    }
    CursorAgent = @{
        Exec              = "cursor-agent.exe"
        Name              = "CursorAgent"
        DesktopCategory   = $Global:DESKTOP_CATEGORY_AI_CLI_TOOLS
        Description       = "Cursor Agent - AI-powered coding assistant"
        InstallType       = "web"
        ForceToInstallDir = $false
        VerifySuffix      = "--version"
        PackageId         = "https://cursor.com/install"
        AdditionalKeywords = @("cursor", "cursor-agent")
        EnvVars           = @(
            @{
                Type = @("Path")
            }
        )
        # TODO: Unknown callback requirements and exact download mechanism for Cursor Agent
    }
    Antigravity = @{
        PackageId         = "https://edgedl.me.gvt1.com/edgedl/release2/j0qc3/antigravity/stable/1.11.2-6251250307170304/windows-x64/Antigravity.exe"
        Exec              = "Antigravity.exe"
        Name              = "Antigravity"
        DesktopCategory   = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS
        Description       = "Antigravity desktop client"
        InstallType       = "web"
        ForceToInstallDir = $true
        VerifySuffix      = ""
        AdditionalKeywords = @("antigravity", "antigravity.exe")
        DesktopShortcuts  = @(
            @{
                CreateDesktopShortcut = $true
                ShortcutName = "Antigravity"
            }
        )
        EnvVars           = @()
    }
    LangChainCli = @{
        PackageId         = "langchain-cli"
        Exec              = "langchain"
        Name              = "LangChainCli"
        DesktopCategory   = $Global:DESKTOP_CATEGORY_AI_CLI_TOOLS
        Description       = "LangChain CLI - Framework for building AI applications"
        InstallType       = "pipx"
        ForceToInstallDir = $false
        VerifySuffix      = "--version"
        AdditionalKeywords = @("langchain-cli", "langchain.exe", "langchain.bat")
        EnvVars           = @(
            @{
                Type = @("Path")
                Keyword = @("langchain")
            }
        )
        # TODO: Unknown callback requirements for LangChain CLI
    }
    FFmpeg = @{
        PackageId         = "Gyan.FFmpeg"
        Exec              = "ffmpeg.exe"
        Name              = "FFmpeg"
        DesktopCategory   = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS
        Description       = "FFmpeg - Complete, cross-platform solution for recording, converting and streaming audio and video"
        InstallType       = "winget"
        ForceToInstallDir = $true
        VerifySuffix      = "-version"
        AdditionalKeywords = @("ffmpeg", "ffprobe", "ffplay")
        EnvVars           = @(
            @{
                Type = @("Path")
                Keyword = @("ffmpeg.exe")
                SubPath = ""
            }
        )
        # Note: FFmpeg installs to a randomly named subdirectory (e.g., ffmpeg-8.0-full_build)
        # The system will recursively search for ffmpeg.exe in the installation directory
    }
    SuperClaude = @{
        UvId              = "SuperClaude"
        Exec              = "superclaude.exe"
        Name              = "SuperClaude"
        DesktopCategory   = $Global:DESKTOP_CATEGORY_AI_CLI_TOOLS
        Description       = "SuperClaude - Enhanced Claude AI interface and tools"
        InstallType       = "uv"
        ForceToInstallDir = $false
        VerifySuffix      = "--version"
        AdditionalKeywords = @("superclaude", "super-claude")
        EnvVars           = @(
            @{
                Type = @("Path")
            }
        )
        # TODO: Unknown callback requirements for SuperClaude
    }
    OpenCode = @{
        Exec              = "opencode.exe"
        Name              = "OpenCode"
        DesktopCategory   = $Global:DESKTOP_CATEGORY_AI_CLI_TOOLS
        Description       = "OpenCode - AI-powered development platform"
        InstallType       = "web"
        ForceToInstallDir = $false
        VerifySuffix      = "--version"
        PackageId         = "https://opencode.ai/install"
        AdditionalKeywords = @("opencode", "open-code")
        EnvVars           = @(
            @{
                Type = @("Path")
            }
        )
        # TODO: Unknown callback requirements and exact download mechanism for OpenCode
    }
}
# MCP Services Packages - Tools providing MCP services for IDEs
# For PostInstallCallbacks usage, see: <#POSTINSTALL_CALLBACKS_ANCHOR#>
$Global:MCP_SERVICES_PACKAGES = @{
    AlibabaDataworksMCP = @{
        Name              = "AlibabaDataworksMCP"
        DesktopCategory   = $Global:DESKTOP_CATEGORY_AI_CLI_TOOLS
        Description       = "Alibaba Cloud DataWorks MCP Server - Cloud data processing and management (npm global install)"
        InstallType       = "npm"
        PackageId         = "alibabacloud-dataworks-mcp-server"
        ForceToInstallDir = $false
        VerifySuffix      = ""
        PostInstallCallbacks = @(
            @{
                Type = "mcp"
                Operation = "npm_global_install"
                PackageName = "alibabacloud-dataworks-mcp-server"
                ServiceName = "alibaba_dataworks_mcp"
            }
        )
    }
    FeedbackEnhancedMCP = @{
        Name              = "FeedbackEnhancedMCP"
        DesktopCategory   = $Global:DESKTOP_CATEGORY_AI_CLI_TOOLS
        Description       = "MCP Feedback Enhanced Server - Interactive feedback collection with web interface (uvx install)"
        InstallType       = "uvx"
        PackageId         = "mcp-feedback-enhanced@latest"
        UvxId             = "mcp-feedback-enhanced@latest"
        ForceToInstallDir = $false
        VerifySuffix      = ""
        PostInstallCallbacks = @(
            @{
                Type = "mcp"
                Operation = "uvx_install"
                PackageName = "mcp-feedback-enhanced@latest"
                ServiceName = "feedback_enhanced_mcp"
            }
        )
    }
}


# Global Common Software Variables
# For PostInstallCallbacks usage, see: <#POSTINSTALL_CALLBACKS_ANCHOR#>
$Global:COMMON_SOFTWARE_PACKAGES = @{
    IntelliJIDEA    = @{
        PackageId              = "JetBrains.IntelliJIDEA.Community"
        Exec                  = "idea64.exe"
        Name                  = "IntelliJIDEA"
        DesktopCategory       = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS
        Description           = "IntelliJ IDEA Community Edition - Java IDE"
        InstallType           = "winget"
        ForceToInstallDir     = $true
        VerifySuffix          = ""
        MenuName              = "Open with IntelliJ IDEA"
        RegistrySearchKeyword = "IntelliJ IDEA Community"
        EnvVars               = @(
            @{
                Type = @("AddExec")
            }
        )
        DesktopShortcuts      = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    CodeBuddy        = @{
        PackageId            = "Tencent.CodeBuddy"
        Exec                = "CodeBuddy.exe"
        Name                = "CodeBuddy"
        DesktopCategory     = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS
        Description         = "Tencent CodeBuddy - AI-powered code editor"
        InstallType         = "winget"
        ForceToInstallDir   = $true
        VerifySuffix        = ""
        DesktopShortcuts    = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    VSCodiumInsiders        = @{
        PackageId            = "VSCodium.VSCodium.Insiders"
        Exec                = "VSCodium - Insiders"
        Name                = "VSCodiumInsiders"
        DesktopCategory     = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS
        Description         = "VSCodium Insiders - Open source binary distribution of VS Code"
        InstallType         = "winget"
        ForceToInstallDir   = $true
        VerifySuffix        = ""
        DesktopShortcuts    = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    Trae           = @{
        PackageId           = "ByteDance.Trae"
        Exec               = "Trae.exe"
        Name               = "Trae"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS
        Description        = "AI-powered code editor by ByteDance"
        InstallType        = "winget"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("Trae", "$($Global:CHINESE_BYTEDANCE)Trae")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    AdsPowerGlobal = @{
        PackageId           = "AdsPower.AdsPower"
        Exec               = "AdsPower Global.exe"
        Name               = "AdsPowerGlobal"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS
        Description        = "AdsPower Global - Browser automation and management tool"
        InstallType        = "winget"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("AdsPower", "AdsPower Global")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    WeChat         = @{
        PackageId           = "Tencent.WeChat"
        Exec               = "WeChat.exe"
        Name               = "WeChat"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_SOCIAL_MEDIA
        Description        = "Popular instant messaging and social media app"
        InstallType        = "winget"
        ForceToInstallDir  = $true
        VerifySuffix       = ""
        AdditionalKeywords = @($Global:CHINESE_WEIXIN, "WeChat", "Weixin")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    OneTwoThreePan = @{
        PackageId           = "123.123pan"
        Exec               = "123pan.exe"
        Name               = "123pan"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_NETWORK_TOOLS
        Description        = "123pan is a cloud storage and file sharing service"
        InstallType        = "winget"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("123pan", "123??????")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    QQNT           = @{
        PackageId           = "Tencent.QQ.NT"
        Exec               = "QQ.exe"
        Name               = "QQ"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_SOCIAL_MEDIA
        Description        = "Next-generation QQ instant messaging client"
        InstallType        = "winget"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("QQ", "QQNT")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    WPSOffice      = @{
        PackageId           = "Kingsoft.WPSOffice"
        Exec               = "WPS.exe"
        Name               = "WPSOffice"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_OFFICE_TOOLS
        Description        = "Free office suite with word processor, spreadsheet and presentation"
        InstallType        = "winget"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("WPS", "Kingsoft", $Global:CHINESE_JINSHAN)
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    LibreOffice    = @{
        PackageId           = "TheDocumentFoundation.LibreOffice"
        Exec               = "soffice.exe"
        Name               = "LibreOffice"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_OFFICE_TOOLS
        Description        = "Free and open-source office suite"
        InstallType        = "winget"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("LibreOffice", "Office", "Libre")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    CapCut         = @{
        PackageId           = "ByteDance.CapCut"
        Exec               = "CapCut.exe"
        Name               = "CapCut"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_MEDIA_TOOLS
        Description        = "Free video editing software"
        InstallType        = "winget"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("CapCut", $Global:CHINESE_JIANYING)
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    ThunderSpeed   = @{
        PackageId           = "Thunder.Thunder"
        Exec               = "Thunder.exe"
        Name               = "Xunlei"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_NETWORK_TOOLS
        Description        = "High-speed download manager"
        InstallType        = "winget"
        ForceToInstallDir  = $true
        VerifySuffix       = ""
        AdditionalKeywords = @($Global:CHINESE_XUNLEI, "Thunder")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    BaiduNetDisk   = @{
        PackageId           = "Baidu.BaiduNetdisk"
        Exec               = "BaiduNetdisk.exe"
        Name               = "BaiduNetDisk"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_NETWORK_TOOLS
        Description        = "Cloud storage and file sharing service"
        InstallType        = "winget"
        ForceToInstallDir  = $true
        VerifySuffix       = ""
        AdditionalKeywords = @($Global:CHINESE_BAIDUWANGPAN, "BaiduNetDisk")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    WeChatInput    = @{
        PackageId            = "Tencent.WeType"
        Exec                = "wetype_service.exe"
        Name                = "WeChatInput"
        Description         = "Intelligent input method by WeChat"
        InstallType         = "winget"
        ForceToInstallDir   = $false
        VerifySuffix        = ""
        AppCustomInstallDir = "C:\Program Files\Tencent\WeType\"
        AdditionalKeywords  = @("wetype")
        DesktopShortcuts    = @()
    }
    Chrome         = @{
        PackageId           = "Google.Chrome"
        Exec               = "chrome.exe"
        Name               = "Chrome"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_BROWSERS
        Description        = "Google Chrome web browser"
        InstallType        = "winget"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("Chrome", "Google Chrome")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    Edge           = @{
        PackageId            = "Microsoft.Edge"
        Exec                = "msedge.exe"
        Name                = "Edge"
        DesktopCategory     = $Global:DESKTOP_CATEGORY_BROWSERS
        Description         = "Microsoft Edge web browser"
        InstallType         = "winget"
        ForceToInstallDir   = $false
        VerifySuffix        = ""
        AppCustomInstallDir = "C:\Program Files (x86)\Microsoft\Edge\Application"
        AdditionalKeywords  = @("Edge", "Microsoft Edge")
        DesktopShortcuts    = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
    Firefox        = @{
        PackageId           = "Mozilla.Firefox"
        Exec               = "firefox.exe"
        Name               = "Firefox"
        DesktopCategory    = $Global:DESKTOP_CATEGORY_BROWSERS
        Description        = "Mozilla Firefox web browser"
        InstallType        = "winget"
        ForceToInstallDir  = $false
        VerifySuffix       = ""
        AdditionalKeywords = @("Firefox", "Mozilla Firefox")
        DesktopShortcuts   = @(
            @{
                CreateDesktopShortcut = $true
            }
        )
    }
}



# Custom Scripts and Commands Group
# ItemType can be: 'powershell', 'batcommander', 'script-file'
# powershell: PowerShell commands/scripts
# batcommander: Batch commands (will be converted to PowerShell)
# script-file: Existing script files (.ps1, .bat, .exe, etc.)
# WorkDir: Optional working directory to change to before executing the script/command
#          If specified, the script will change to this directory before execution
#          and restore the original directory after completion
$Global:CUSTOM_SCRIPTS_AND_COMMANDS = @{
    "Gemini"     = @{
        ItemType              = "powershell"
        ItemName              = "Gemini"
        ItemCommand           = "gemini"
        WorkDir               = $Global:CORE_NODE_DIR
        DesktopCategory       = $Global:DESKTOP_CATEGORY_DEV_SCRIPTS
        Description           = "Start Gemini"
        CreateDesktopShortcut = $true
    }
    "Claude"     = @{
        ItemType              = "powershell"
        ItemName              = "Claude"
        ItemCommand           = "claude"
        WorkDir               = $Global:CORE_NODE_DIR
        DesktopCategory       = $Global:DESKTOP_CATEGORY_DEV_SCRIPTS
        Description           = "Start Claude"
        CreateDesktopShortcut = $true
    }
    "dd.cmd"     = @{
        ItemType              = "script-file"
        ItemName              = "dd.cmd RunAsAdmin"
        ItemCommand           = $Global:CORE_NODE_DIR + "\dd.cmd"
        DesktopCategory       = $Global:DESKTOP_CATEGORY_DEV_SCRIPTS
        Description           = "Start dd.cmd"
        CreateDesktopShortcut = $true
    }

    "FlutterDev" = @{
        ItemType              = "script-file"
        ItemName              = "Flutter Development"
        ItemCommand           = "$Global:CORE_NODE_SCRIPTS_DIR\flutterbloomDev.ps1"
        DesktopCategory       = $Global:DESKTOP_CATEGORY_DEV_SCRIPTS
        Description           = "Start Flutter development server"
        CreateDesktopShortcut = $true
    }
    "LaravelDev" = @{
        ItemType              = "script-file"
        ItemName              = "Laravel Development"
        ItemCommand           = "$Global:CORE_NODE_SCRIPTS_DIR\laravelDev.ps1"
        DesktopCategory       = $Global:DESKTOP_CATEGORY_DEV_SCRIPTS
        Description           = "Start Laravel development server"
        CreateDesktopShortcut = $true
    }
    "NodeDev"    = @{
        ItemType              = "script-file"
        ItemName              = "Node.js Development"
        ItemCommand           = "$Global:CORE_NODE_SCRIPTS_DIR\nodeDev.ps1"
        DesktopCategory       = $Global:DESKTOP_CATEGORY_DEV_SCRIPTS
        Description           = "Start Node.js development server"
        CreateDesktopShortcut = $true
    }
    "NuxtDev"    = @{
        ItemType              = "script-file"
        ItemName              = "Nuxt Development"
        ItemCommand           = "$Global:CORE_NODE_SCRIPTS_DIR\nuxtDev.ps1"
        DesktopCategory       = $Global:DESKTOP_CATEGORY_DEV_SCRIPTS
        Description           = "Start Nuxt development server"
        CreateDesktopShortcut = $true
    }
    "QuickGit"   = @{
        ItemType              = "script-file"
        ItemName              = "Quick Git Status"
        WorkDir               = $Global:CORE_NODE_DIR
        ItemCommand           = "$Global:CORE_NODE_SCRIPTS_DIR\gitput.bat"
        DesktopCategory       = $Global:DESKTOP_CATEGORY_DEV_SCRIPTS
        Description           = "Quick Git status and recent commits"
        CreateDesktopShortcut = $true
    }
}

# Output applications list in JSON format if requested
# This is used by backup systems to get the list of installed applications
if ($OutputApplicationsList) {
    $applicationsOutput = @()

    # Combine all package collections with source tracking
    $allPackages = @{}

    # Add APPLICATIONS_PACKAGES
    if ($Global:APPLICATIONS_PACKAGES) {
        foreach ($key in $Global:APPLICATIONS_PACKAGES.Keys) {
            $packageCopy = $Global:APPLICATIONS_PACKAGES[$key].Clone()
            $packageCopy['_PackageSource'] = 'APPLICATIONS_PACKAGES'
            $allPackages[$key] = $packageCopy
        }
    }

    # Add DEV_SOFTWARE_PACKAGES
    if ($Global:DEV_SOFTWARE_PACKAGES) {
        foreach ($key in $Global:DEV_SOFTWARE_PACKAGES.Keys) {
            $packageCopy = $Global:DEV_SOFTWARE_PACKAGES[$key].Clone()
            $packageCopy['_PackageSource'] = 'DEV_SOFTWARE_PACKAGES'
            $allPackages[$key] = $packageCopy
        }
    }

    # Add COMMON_SOFTWARE_PACKAGES
    if ($Global:COMMON_SOFTWARE_PACKAGES) {
        foreach ($key in $Global:COMMON_SOFTWARE_PACKAGES.Keys) {
            $packageCopy = $Global:COMMON_SOFTWARE_PACKAGES[$key].Clone()
            $packageCopy['_PackageSource'] = 'COMMON_SOFTWARE_PACKAGES'
            $allPackages[$key] = $packageCopy
        }
    }

    # Process each package
    foreach ($packageKey in $allPackages.Keys) {
        $package = $allPackages[$packageKey]

        $appInfo = @{
            Name = if ($package.ContainsKey('Name')) { $package.Name } else { $packageKey }
            Exec = if ($package.ContainsKey('Exec')) { $package.Exec } else { $null }
            PackageId = if ($package.ContainsKey('PackageId')) { $package.PackageId } else { $null }
            Description = if ($package.ContainsKey('Description')) { $package.Description } else { $null }
            InstallType = if ($package.ContainsKey('InstallType')) { $package.InstallType } else { $null }
            ForceToInstallDir = if ($package.ContainsKey('ForceToInstallDir')) { $package.ForceToInstallDir } else { $false }
            AppCustomInstallDir = if ($package.ContainsKey('AppCustomInstallDir')) { $package.AppCustomInstallDir } else { $null }
            Category = if ($package.ContainsKey('DesktopCategory')) { $package.DesktopCategory } else { $null }
            PackageSource = if ($package.ContainsKey('_PackageSource')) { $package._PackageSource } else { 'UNKNOWN' }
        }

        $applicationsOutput += $appInfo
    }

    # Define output directory and file path
    $userProfile = $env:USERPROFILE
    $pybackupDir = Join-Path $userProfile ".core_node\pybackup"
    $jsonOutputFile = Join-Path $pybackupDir "applications_list.json"

    # Ensure directory exists
    if (-not (Test-Path $pybackupDir)) {
        New-Item -ItemType Directory -Path $pybackupDir -Force | Out-Null
    }

    # Convert to JSON and save to file
    $jsonOutput = $applicationsOutput | ConvertTo-Json -Depth 10

    # Write to file
    $jsonOutput | Out-File -FilePath $jsonOutputFile -Encoding UTF8 -Force

    # Also output to stdout for compatibility
    Write-Output $jsonOutput

    # Exit immediately to prevent loading rest of the script
    exit 0
}
