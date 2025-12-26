#!/usr/bin/env python3
"""
Build Variable Keys Definition
Unified variable key definitions to avoid scattered strings
"""

class BuildVars:
    """Build variable key center"""

    # Variable prefix (prevent conflicts between projects)
    PREFIX = "mcpchrome_"

    # === Basic environment variables ===
    PROJECT_ROOT = f"{PREFIX}project_root"           # Project root directory
    PLATFORM = f"{PREFIX}platform"                   # Platform: windows/linux/darwin
    VARS_DIR = f"{PREFIX}vars_dir"                   # Variable storage directory

    # === Dependency versions ===
    NODE_VERSION = f"{PREFIX}node_version"           # Node.js version
    PNPM_VERSION = f"{PREFIX}pnpm_version"           # pnpm version
    NODE_INSTALLED = f"{PREFIX}node_installed"       # Whether Node.js is installed
    PNPM_INSTALLED = f"{PREFIX}pnpm_installed"       # Whether pnpm is installed

    # === Path variables ===
    BUILD_OUTPUT_DIR = f"{PREFIX}build_output_dir"   # Build output directory (cross-platform)
    EXTENSION_PATH = f"{PREFIX}extension_path"       # Extension output path
    NATIVE_PATH = f"{PREFIX}native_path"             # Native Server path
    SHARED_PATH = f"{PREFIX}shared_path"             # Shared package path
    MANIFEST_PATH = f"{PREFIX}manifest_path"         # Native Messaging Host manifest path
    NODE_MODULES_EXISTS = f"{PREFIX}node_modules_exists"  # Whether node_modules exists

    # === Build commands ===
    CMD_CHECK_DEPS = f"{PREFIX}cmd_check_deps"       # Check dependencies command
    CMD_INSTALL = f"{PREFIX}cmd_install"             # Install dependencies command
    CMD_BUILD_SHARED = f"{PREFIX}cmd_build_shared"   # Build shared package command
    CMD_BUILD_NATIVE = f"{PREFIX}cmd_build_native"   # Build native server command
    CMD_BUILD_EXTENSION = f"{PREFIX}cmd_build_extension"  # Build extension command
    CMD_REGISTER = f"{PREFIX}cmd_register"           # Register Native Messaging Host command

    # === Status flags ===
    ERROR = f"{PREFIX}error"                         # Error message
    SHOULD_INSTALL = f"{PREFIX}should_install"       # Whether dependencies need to be installed
    BUILD_RETRY_MAX = f"{PREFIX}build_retry_max"     # Maximum build retry attempts

    # === UI display ===
    UI_TITLE = f"{PREFIX}ui_title"                   # UI title
    UI_STEP_1 = f"{PREFIX}ui_step_1"                 # Step 1 description
    UI_STEP_2 = f"{PREFIX}ui_step_2"                 # Step 2 description
    UI_STEP_3 = f"{PREFIX}ui_step_3"                 # Step 3 description
    UI_STEP_4 = f"{PREFIX}ui_step_4"                 # Step 4 description
    UI_STEP_5 = f"{PREFIX}ui_step_5"                 # Step 5 description
    UI_STEP_6 = f"{PREFIX}ui_step_6"                 # Step 6 description

    @classmethod
    def get_all_keys(cls):
        """Get all variable keys"""
        return {k: v for k, v in cls.__dict__.items()
                if not k.startswith('_') and isinstance(v, str) and v.startswith(cls.PREFIX)}
