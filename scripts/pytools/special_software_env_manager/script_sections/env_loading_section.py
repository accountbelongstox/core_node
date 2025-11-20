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
#region Load Environment Variables via PyCore caller
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
$secretManagerScript = Join-Path $projectRootPath "pycore\pyfoundations\secret_manager.py"
Write-Host "[DEBUG] Python executable: $pythonExecutable" -ForegroundColor DarkGray
Write-Host "[DEBUG] Secret manager script: $secretManagerScript" -ForegroundColor DarkGray
Write-Host "[DEBUG] Project root: $projectRootPath" -ForegroundColor DarkGray

function Get-SecretValue {{
    param([string]$KeyName)
    Write-Host "[DEBUG] Loading secret key: $KeyName" -ForegroundColor DarkGray

    # Save current directory and switch to project root
    $originalLocation = Get-Location
    Set-Location $projectRootPath

    # Use -ArgumentList for proper parameter passing
    $argumentList = @(
        $secretManagerScript,
        'get_secret_key',
        $KeyName
    )

    Write-Host "[DEBUG] Working directory: $projectRootPath" -ForegroundColor DarkGray
    Write-Host "[DEBUG] Command: $pythonExecutable -ArgumentList $($argumentList -join ', ')" -ForegroundColor DarkGray

    # Use ProcessStartInfo for reliable output capture with proper argument handling
    $value = $null
    $errorOutput = $null
    $exitCode = 0
    
    try {{
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $pythonExecutable
        $psi.Arguments = ($argumentList | ForEach-Object {{ 
            if ($_ -match ' ') {{ "`"$_`"" }} 
            else {{ $_ }} 
        }}) -join ' '
        $psi.WorkingDirectory = $projectRootPath
        $psi.UseShellExecute = $false
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.CreateNoWindow = $true
        $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
        $psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8
        
        # Set environment variables to force Python to use UTF-8 encoding
        $psi.Environment["PYTHONIOENCODING"] = "utf-8"
        $psi.Environment["PYTHONUTF8"] = "1"
        
        $process = New-Object System.Diagnostics.Process
        $process.StartInfo = $psi
        
        [void]$process.Start()
        $value = $process.StandardOutput.ReadToEnd().Trim()
        $errorOutput = $process.StandardError.ReadToEnd().Trim()
        $process.WaitForExit()
        $exitCode = $process.ExitCode
        $process.Dispose()
        
        # Remove BOM character if present
        if ($value -and $value.Length -gt 0 -and [int][char]$value[0] -eq 0xFEFF) {{
            $value = $value.Substring(1)
        }}
        
    }} catch {{
        # Fallback: use direct call with proper argument escaping
        try {{
            # Set environment variables for UTF-8 encoding
            $env:PYTHONIOENCODING = "utf-8"
            $env:PYTHONUTF8 = "1"
            
            # Build command with proper quoting
            $cmdParts = @($pythonExecutable)
            foreach ($arg in $argumentList) {{
                if ($arg -match ' ') {{
                    $cmdParts += "`"$arg`""
                }} else {{
                    $cmdParts += $arg
                }}
            }}
            $cmd = $cmdParts -join ' '
            
            # Execute and capture output
            $allOutput = Invoke-Expression $cmd 2>&1
            $exitCode = $LASTEXITCODE
            
            # Separate stdout and stderr
            $stdoutLines = @()
            $stderrLines = @()
            
            foreach ($item in $allOutput) {{
                if ($item -is [System.Management.Automation.ErrorRecord]) {{
                    $stderrLines += $item.ToString()
                }} else {{
                    $line = $item.ToString().Trim()
                    # Filter out traceback lines
                    if ($line -and -not ($line -match '^Traceback|^File "|^    |^Error:|^Warning:')) {{
                        $stdoutLines += $line
                    }}
                }}
            }}
            
            $value = $stdoutLines -join "`n"
            $errorOutput = $stderrLines -join "`n"
            
            # Remove BOM character if present
            if ($value -and $value.Length -gt 0 -and [int][char]$value[0] -eq 0xFEFF) {{
                $value = $value.Substring(1)
            }}
            
        }} catch {{
            Write-Host "[ERROR] Failed to execute Python: $($_.Exception.Message)" -ForegroundColor Red
            $exitCode = 1
        }}
    }}

    # Restore original directory
    Set-Location $originalLocation

    Write-Host "[DEBUG] Exit code: $exitCode" -ForegroundColor DarkGray

    # Show error output if any (only for real errors)
    if ($errorOutput -and $exitCode -ne 0) {{
        Write-Host "[DEBUG] Python stderr:" -ForegroundColor Yellow
        Write-Host $errorOutput -ForegroundColor Yellow
    }}

    if ($value) {{
        Write-Host "[DEBUG] Returned value length: $($value.Length)" -ForegroundColor DarkGray
        # Show masked preview (first 4 chars + *** + last 4 chars)
        if ($value.Length -gt 8) {{
            $masked = $value.Substring(0, 4) + "***" + $value.Substring($value.Length - 4)
            Write-Host "[DEBUG] Value preview (masked): $masked" -ForegroundColor DarkGray
        }}
    }} else {{
        Write-Host "[DEBUG] Returned empty value" -ForegroundColor Yellow
    }}

    return $value
}}

"""

        var_loading_code = ""
        for var in variables:
            secret_key_name = f"{var['Name']}_{file_number}"
            display_name = var.get('DisplayName', var['Name'])
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
            load_calls.append(
                f"load_secret_value \"{secret_key_name}\" \"{var['Name']}\" \"{display_name}\""
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

    if [ -n "$value" ]; then
        export "$env_name"=\"$value\"
        echo "[SUCCESS] Loaded $display_name = $value"
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

