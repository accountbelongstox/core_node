"""
Environment Variable Loading Section Generator

Generates environment variable loading sections for Windows and Linux.
"""

from typing import List, Dict, Any


class EnvLoadingSectionGenerator:
    """Generates environment variable loading sections"""

    @staticmethod
    def generate_windows_env_loading_section(variables: List[Dict[str, Any]], file_number: int) -> str:
        """Generate Windows PowerShell environment variable loading section"""
        if not variables:
            return ""

        load_secret_manager = f"""
#region Load Environment Variables via Secret Reader
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Loading Environment Variables" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Detect Python executable (Windows prioritizes 'python' over 'python3')
$pythonExecutable = $null
if (Get-Command python -ErrorAction SilentlyContinue) {{
    $pythonExecutable = "python"
}} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {{
    $pythonExecutable = "python3"
}} else {{
    Write-Host "[ERROR] Python not found. Cannot load secrets." -ForegroundColor Red
    exit 1
}}

# Use relative path from script location to project root
$secretReaderScript = Join-Path $projectRootPath "scripts\pytools\special_software_env_manager\secret_read.py"
Write-Host "[DEBUG] Python executable: $pythonExecutable" -ForegroundColor DarkGray
Write-Host "[DEBUG] Secret reader script: $secretReaderScript" -ForegroundColor DarkGray
Write-Host "[DEBUG] Project root: $projectRootPath" -ForegroundColor DarkGray

function Get-SecretValue {{
    param([string]$KeyName)
    Write-Host "[DEBUG] Loading secret key: $KeyName" -ForegroundColor DarkGray

    # Save current directory and switch to project root
    $originalLocation = Get-Location
    Set-Location $projectRootPath

    # Build quoted argument string (avoid -ArgumentList)
    $rawArguments = @(
        $secretReaderScript,
        $KeyName
    )
    $quotedArguments = $rawArguments | ForEach-Object {{
        if (-not $_) {{ '' }}
        elseif ($_ -match '\s') {{ "`"$($_)`"" }}
        else {{ $_ }}
    }}
    $argumentString = ($quotedArguments -join ' ').Trim()

    Write-Host "[DEBUG] Working directory: $projectRootPath" -ForegroundColor DarkGray
    Write-Host "[DEBUG] Command: $pythonExecutable $argumentString" -ForegroundColor DarkGray

    $value = ""
    $fixScriptPath = Join-Path $winCommonDirPath "SecretDecryptionCheck.ps1"
    $fixInstruction = "Run dd.cmd (Secret Decryption Fix) or powershell -ExecutionPolicy Bypass -File `"$fixScriptPath`""

    $value = & $pythonExecutable $secretReaderScript $KeyName
    $exitCode = $LASTEXITCODE
    Set-Location $originalLocation

    if ($LASTEXITCODE -eq $null) {{
        Write-Host "[ERROR] Unable to execute Python process." -ForegroundColor Red
        Write-Host "[ACTION] $fixInstruction" -ForegroundColor Yellow
        $value = ""
    }}

    if ($exitCode -ne 0 -or -not $value) {{
        Write-Host "[WARNING] Secret reader failed or returned empty value." -ForegroundColor Yellow
        Write-Host "[ACTION] $fixInstruction" -ForegroundColor Yellow
        $value = ""
    }} elseif ($value.StartsWith([char]0xFEFF)) {{
        $value = $value.Substring(1)
    }}

    if ($value) {{
        Write-Host "[DEBUG] Returned value length: $($value.Length)" -ForegroundColor DarkGray
        if ($value.Length -gt 8) {{
            $masked = $value.Substring(0, 4) + "***" + $value.Substring($value.Length - 4)
            Write-Host "[DEBUG] Value preview (masked): $masked" -ForegroundColor DarkGray
        }}
    }} else {{
        Write-Host "[WARNING] Secret value empty. Run dd.cmd -> Secret Decryption Fix if needed." -ForegroundColor Yellow
    }}

    return $value
}}

"""

        var_loading_code = ""
        for var in variables:
            secret_key_name = f"{var['Name']}_{file_number}"
            display_name = var.get('DisplayName', var['Name'])
            default_value = var.get('DefaultValue', '')
            
            if default_value:
                var_loading_code += f"""$env:{var['Name']} = Get-SecretValue "{secret_key_name}"
if (-not $env:{var['Name']}) {{
    $env:{var['Name']} = "{default_value}"
    Write-Host "[SUCCESS] Loaded {var['Name']} = $($env:{var['Name']}) (default)" -ForegroundColor Green
}} else {{
    Write-Host "[SUCCESS] Loaded {var['Name']} = $($env:{var['Name']})" -ForegroundColor Green
}}

"""
            else:
                var_loading_code += f"""$env:{var['Name']} = Get-SecretValue "{secret_key_name}"
if ($env:{var['Name']}) {{
    Write-Host "[SUCCESS] Loaded {var['Name']} = $($env:{var['Name']})" -ForegroundColor Green
}} else {{
    Write-Host "[WARNING] Failed to load {var['Name']}" -ForegroundColor Yellow
}}

"""

        return load_secret_manager + var_loading_code + "\n"

    @staticmethod
    def generate_linux_env_loading_section(variables: List[Dict[str, Any]], file_number: int) -> str:
        """Generate Linux bash environment variable loading section"""
        if not variables:
            return ""

        load_calls = []
        for var in variables:
            secret_key_name = f"{var['Name']}_{file_number}"
            display_name = var.get('DisplayName', var['Name'])
            default_value = var.get('DefaultValue', '')
            load_calls.append(
                f"load_secret_value \"{secret_key_name}\" \"{var['Name']}\" \"{display_name}\" \"{default_value}\""
            )

        load_commands = "\n".join(load_calls)

        return f"""
# =============================================================================
# Load Environment Variables from Secret Manager
# =============================================================================
echo ""
echo "============================================================"
echo "Loading Environment Variables"
echo "============================================================"
echo ""

python_exec="python3"
if ! command -v "$python_exec" &> /dev/null; then
    if command -v python &> /dev/null; then
        python_exec="python"
    else
        echo "[ERROR] Python is required to load secrets"
        exit 1
    fi
fi

# Use relative path from script location to project root
secret_manager_script="$projectRootPath/pycore/pyfoundations/secret_manager.py"

echo "[DEBUG] Python executable: $python_exec"
echo "[DEBUG] Project root: $projectRootPath"
echo "[DEBUG] Secret manager script: $secret_manager_script"
echo "[DEBUG] Script file exists: $([ -f "$secret_manager_script" ] && echo "YES" || echo "NO")"

load_secret_value() {{
    local key_name="$1"
    local env_name="$2"
    local display_name="$3"
    local default_value="$4"
    local value=""

    echo "[DEBUG] Loading secret key: $key_name -> $env_name"
    echo "[DEBUG] Python command: PYTHONPATH=\"$projectRootPath\" $python_exec \"$secret_manager_script\" get_secret_key \"$key_name\""

    # Capture stderr to temp file for debugging
    local tmp_err=$(mktemp)
    # Use PYTHONPATH instead of cd
    value=$(PYTHONPATH="$projectRootPath" $python_exec "$secret_manager_script" get_secret_key "$key_name" 2>"$tmp_err")
    local exit_code=$?

    # Show stderr if there were errors
    if [ -s "$tmp_err" ]; then
        echo "[DEBUG] Python stderr:"
        cat "$tmp_err"
    fi
    rm -f "$tmp_err"

    echo "[DEBUG] Exit code: $exit_code"
    echo "[DEBUG] Returned value length: ${{#value}}"

    # Use default value if secret loading failed and default is provided
    if [ -z "$value" ] && [ -n "$default_value" ]; then
        value="$default_value"
        echo "[INFO] Using default value for $display_name"
    fi

    if [ -n "$value" ]; then
        export "$env_name"=\"$value\"
        if [ -n "$default_value" ] && [ "$value" = "$default_value" ]; then
            echo "[SUCCESS] Loaded $display_name = $value (default)"
        else
            echo "[SUCCESS] Loaded $display_name = $value"
        fi
        echo "[INFO] Command executed: export $env_name=\"$value\""
        
        # Verify environment variable is correctly set
        current_value="${{!env_name}}"
        if [ "$current_value" = "$value" ]; then
            echo "[VERIFY] Environment variable $env_name is correctly set"
            echo "[VERIFY] Current value: $current_value"
        else
            echo "[WARNING] Environment variable $env_name verification failed"
            echo "[WARNING] Expected: $value"
            echo "[WARNING] Actual: $current_value"
        fi
        return 0
    fi

    echo "[WARNING] Failed to load $display_name (empty value returned)"
    return 1
}}

{load_commands}

echo ""
"""


__all__ = ['EnvLoadingSectionGenerator']

