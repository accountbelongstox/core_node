# KeyCenter.ps1
# Global KEY Center for React Native Build System
# All KEY names are defined here as constants

# ============ Factory Build Keys ============
$script:KEY_FACTORY_BUILD_PATH = "FACTORY_BUILD_PATH"
$script:KEY_FACTORY_BUILD_ENABLED = "FACTORY_BUILD_ENABLED"

# ============ Metro Bundler Keys ============
$script:KEY_METRO_PORT = "METRO_PORT"

# ============ App Switch Keys ============
$script:KEY_APP_SWITCH_STATUS = "APP_SWITCH_STATUS"

# ============ Menu Selection Keys ============
$script:KEY_MENU_SELECTION = "MENU_SELECTION"

# ============ Build State Keys ============
$script:KEY_BUILD_STATE = "BUILD_STATE"

# ============ Error Keys ============
$script:KEY_ERROR = "ERROR"

# ============ Emulator Keys ============
$script:KEY_EMULATOR_PATH = "EMULATOR_PATH"
$script:KEY_EMULATOR_AVD = "EMULATOR_AVD"
$script:KEY_EMULATOR_AVAILABLE = "EMULATOR_AVAILABLE"
$script:KEY_EMULATOR_SCAN_REQUIRED = "EMULATOR_SCAN_REQUIRED"

# ============ Junction/Symlink Keys ============
$script:KEY_JUNCTION_SOURCE = "JUNCTION_SOURCE"
$script:KEY_JUNCTION_TARGET = "JUNCTION_TARGET"
$script:KEY_JUNCTION_REQUIRED = "JUNCTION_REQUIRED"

# ============ pnpm Install Keys ============
$script:KEY_PNPM_INSTALL_REQUIRED = "PNPM_INSTALL_REQUIRED"

# ============ Helper Functions for Dynamic Keys ============

function Get-CommandKey {
    param([string]$CommandType)
    return "CMD_$CommandType"
}

function Get-AppConfigKey {
    param([string]$AppName)
    return "APP_CONFIG_$AppName"
}

function Get-ResultKey {
    param([string]$ResultType)
    return "RESULT_$ResultType"
}
