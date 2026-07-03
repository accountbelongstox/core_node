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

$WinCommonDir = Join-Path (Split-Path -Parent $PSScriptRoot) "win_common"
. (Join-Path $WinCommonDir "GlobalVars.ps1")
. (Join-Path $WinCommonDir "CommonFunc.ps1")

# Resolve helper paths (no relative paths; everything via Split-Path / Join-Path)
$windowsPathFunctionPath = Join-Path $WinCommonDir "WindowsPathFunction.ps1"

$STEP_NUMBER = 32

# Key Sysinternals executables linked into .winenvs (globally callable by name).
# The full install directory is also placed on PATH, so the remaining 60+ tools
# stay available; these are the ones used for process/behavior attribution.
$SECURITY_TOOLS_KEY_EXES = @(
    "Procmon.exe",
    "Autoruns.exe",
    "autorunsc.exe",
    "procexp.exe",
    "sigcheck.exe",
    "Tcpview.exe",
    "handle.exe",
    "Listdlls.exe",
    "PsExec.exe",
    "Sysmon.exe",
    "strings.exe",
    "accesschk.exe"
)

# Helper "shortcut" scripts shipped in the inline winenvs directory; linked into
# .winenvs at install time so process-behavior analysis is one command away.
$SECURITY_TOOLS_HELPER_SCRIPTS = @(
    "procwatch.ps1",
    "seccap.ps1",
    "autoruns-scan.ps1"
)

# Sysinternals tool subkeys whose EULA is pre-accepted for unattended/headless use
# (otherwise the first launch of each tool blocks on a GUI EULA dialog).
$SECURITY_TOOLS_EULA_KEYS = @(
    "Process Monitor",
    "Autoruns",
    "Process Explorer",
    "Handle",
    "Sigcheck",
    "TCPView",
    "PsExec",
    "ListDLLs",
    "Strings",
    "System Monitor",
    "AccessChk"
)

$securityToolsEulaRoot = "HKCU:\Software\Sysinternals"

function Step32_AcceptSecurityToolsEula {
    # Idempotent: set EulaAccepted=1 for each tool only when missing/!=1.
    if (-not (Test-Path $securityToolsEulaRoot)) {
        New-Item -Path $securityToolsEulaRoot -Force | Out-Null
    }
    foreach ($tool in $SECURITY_TOOLS_EULA_KEYS) {
        $toolKey = Join-Path $securityToolsEulaRoot $tool
        if (-not (Test-Path $toolKey)) {
            New-Item -Path $toolKey -Force | Out-Null
        }
        $current = (Get-ItemProperty -Path $toolKey -Name "EulaAccepted" -ErrorAction SilentlyContinue).EulaAccepted
        if ($current -ne 1) {
            Set-ItemProperty -Path $toolKey -Name "EulaAccepted" -Value 1 -Type DWord
        }
    }
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Sysinternals EULA pre-accepted for unattended use" -Type "Info"
}

function Step32_ExtractSecurityTools {
    # Extract the suite into the install dir. Prefer the already-installed 7-Zip
    # (Step15) for speed; fall back to PowerShell's built-in Expand-Archive.
    if (-not (Test-Path $Global:SECURITY_TOOLS_INSTALL_DIR)) {
        New-Item -ItemType Directory -Path $Global:SECURITY_TOOLS_INSTALL_DIR -Force | Out-Null
    }
    if ((Test-Path $Global:SEVENZIP_EXE_PATH)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Extracting suite with 7-Zip..." -Type "Info"
        $extractTarget = "-o" + $Global:SECURITY_TOOLS_INSTALL_DIR
        & $Global:SEVENZIP_EXE_PATH x $Global:SECURITY_TOOLS_ZIP_PATH $extractTarget "-y" | Out-Null
    } else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Extracting suite with Expand-Archive..." -Type "Info"
        Expand-Archive -Path $Global:SECURITY_TOOLS_ZIP_PATH -DestinationPath $Global:SECURITY_TOOLS_INSTALL_DIR -Force
    }
}

function Step32_LinkSecurityToolsToWinEnvs {
    # Link the key executables into .winenvs (symbolic links), so each is callable
    # by name even outside the install dir. Idempotent: addexec replaces stale links.
    foreach ($exeName in $SECURITY_TOOLS_KEY_EXES) {
        $exePath = Join-Path $Global:SECURITY_TOOLS_INSTALL_DIR $exeName
        if (Test-Path $exePath) {
            & $windowsPathFunctionPath "addexec" $exePath
        } else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Skipped missing tool: $exeName" -Type "Warning"
        }
    }
}

function Step32_LinkSecurityHelperScripts {
    # Link the inline helper scripts (process-behavior extraction/print, capture,
    # autostart scan) into .winenvs so they travel with the toolkit.
    foreach ($scriptName in $SECURITY_TOOLS_HELPER_SCRIPTS) {
        $scriptPath = Join-Path $Global:INLINE_WINENVS_DIR $scriptName
        if (Test-Path $scriptPath) {
            & $windowsPathFunctionPath "addexec" $scriptPath
        } else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Helper script not found: $scriptName" -Type "Warning"
        }
    }
}

function Step32_InstallSecurityTools {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing security tools (Sysinternals Suite)..." -Type "Info"

    # 1) Download + extract only when the sentinel tool is missing (idempotent).
    if (Test-Path $Global:SECURITY_TOOLS_SENTINEL_EXE) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Sysinternals Suite already installed at $Global:SECURITY_TOOLS_INSTALL_DIR" -Type "Success"
    } else {
        if (-not (Test-Path $Global:DOWNLOADS_DIR)) {
            New-Item -ItemType Directory -Path $Global:DOWNLOADS_DIR -Force | Out-Null
        }
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Downloading Sysinternals Suite..." -Type "Warning"
        Get-FileWithSizeCheck -localPath $Global:SECURITY_TOOLS_ZIP_PATH -remoteUrl $Global:SECURITY_TOOLS_DOWNLOAD_URL -description "Sysinternals Suite"

        if (-not (Test-Path $Global:SECURITY_TOOLS_ZIP_PATH)) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to download Sysinternals Suite" -Type "Error"
            throw "Sysinternals Suite download failed"
        }

        Step32_ExtractSecurityTools

        if (Test-Path $Global:SECURITY_TOOLS_SENTINEL_EXE) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Sysinternals Suite installed successfully" -Type "Success"
        } else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Extraction did not produce expected tools" -Type "Error"
            throw "Sysinternals Suite extraction failed"
        }
    }

    # 2) Pre-accept EULA so the tools never block on a GUI dialog.
    Step32_AcceptSecurityToolsEula

    # 3) Ensure the install directory is on the system PATH.
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Ensuring Sysinternals is in system PATH..." -Type "Info"
    & $windowsPathFunctionPath "add" $Global:SECURITY_TOOLS_INSTALL_DIR

    # 4) Link key tools and helper scripts into .winenvs.
    Step32_LinkSecurityToolsToWinEnvs
    Step32_LinkSecurityHelperScripts

    # 5) Refresh environment variables in the current session.
    & $windowsPathFunctionPath "refresh-bat"
    $refreshBatchPath = Join-Path $env:TEMP "refresh_env.cmd"
    if (Test-Path $refreshBatchPath) {
        & $refreshBatchPath
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Security tools installation completed" -Type "Success"
    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
}

Step32_InstallSecurityTools
