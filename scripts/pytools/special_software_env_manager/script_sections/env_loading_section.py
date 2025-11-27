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
#region Load Environment Variables from Secret Files
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Loading Environment Variables" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Secret files directory
$secretDir = Join-Path $projectRootPath ".secret_keys\.secret_ignore"
Write-Host "[DEBUG] Secret directory: $secretDir" -ForegroundColor DarkGray
Write-Host "[DEBUG] Project root: $projectRootPath" -ForegroundColor DarkGray

function Read-SecretFile {{
    <#
    .SYNOPSIS
        Reads secret value from file with UTF-8 BOM handling.
    
    .DESCRIPTION
        Enhanced function to read secret files from .secret_keys\.secret_ignore directory.
        Handles UTF-8 BOM, empty lines, and provides detailed error messages.
    
    .PARAMETER FilePath
        Full path to the secret file to read.
    
    .OUTPUTS
        String. The secret value (first non-empty line) or empty string if failed.
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$FilePath
    )
    
    $value = ""
    $fixInstruction = "Run dd.cmd (Secret Decryption Fix) to decrypt secret files"
    
    if (-not (Test-Path $FilePath)) {{
        Write-Host "[WARNING] Secret file not found: $FilePath" -ForegroundColor Yellow
        Write-Host "[ACTION] $fixInstruction" -ForegroundColor Yellow
        return ""
    }}
    
    try {{
        # Read file content using System.IO.File for reliable UTF-8 handling
        $bytes = [System.IO.File]::ReadAllBytes($FilePath)
        
        # Check for UTF-8 BOM (EF BB BF) and remove it if present
        if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {{
            $bytes = $bytes[3..($bytes.Length - 1)]
        }}
        
        # Convert bytes to string using UTF-8 encoding
        $content = [System.Text.Encoding]::UTF8.GetString($bytes)
        
        # Get first non-empty line
        $lines = $content -split "`r?`n"
        foreach ($line in $lines) {{
            $trimmedLine = $line.Trim()
            if ($trimmedLine) {{
                $value = $trimmedLine
                break
            }}
        }}
    }} catch {{
        Write-Host "[ERROR] Failed to read secret file: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "[ACTION] $fixInstruction" -ForegroundColor Yellow
        $value = ""
    }}
    
    if (-not $value) {{
        Write-Host "[WARNING] Secret value is empty or file is empty: $FilePath" -ForegroundColor Yellow
        Write-Host "[ACTION] $fixInstruction" -ForegroundColor Yellow
    }}
    
    return $value
}}

function Get-SecretValue {{
    <#
    .SYNOPSIS
        Gets secret value by key name and sets environment variable.
    
    .DESCRIPTION
        Enhanced function that reads secret from file and provides detailed logging.
        Calls Read-SecretFile for actual file reading.
    
    .PARAMETER KeyName
        Secret key name (filename in .secret_ignore directory).
    
    .OUTPUTS
        String. The secret value or empty string if failed.
    #>
    param([string]$KeyName)
    Write-Host "[DEBUG] Loading secret key: $KeyName" -ForegroundColor DarkGray

    $secretFile = Join-Path $secretDir $KeyName
    Write-Host "[DEBUG] Secret file path: $secretFile" -ForegroundColor DarkGray
    
    # Call enhanced read function
    $value = Read-SecretFile -FilePath $secretFile

    if ($value) {{
        Write-Host "[DEBUG] Returned value length: $($value.Length)" -ForegroundColor DarkGray
        if ($value.Length -gt 8) {{
            $masked = $value.Substring(0, 4) + "***" + $value.Substring($value.Length - 4)
            Write-Host "[DEBUG] Value preview (masked): $masked" -ForegroundColor DarkGray
        }}
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
# Load Environment Variables from Secret Files
# =============================================================================
echo ""
echo "============================================================"
echo "Loading Environment Variables"
echo "============================================================"
echo ""

# Secret files directory
secret_dir="$projectRootPath/.secret_keys/.secret_ignore"
echo "[DEBUG] Secret directory: $secret_dir"
echo "[DEBUG] Project root: $projectRootPath"

read_secret_file() {{
    # =============================================================================
    # Enhanced function to read secret files with UTF-8 BOM handling
    # =============================================================================
    # Usage: read_secret_file <file_path>
    # Output: Secret value (first non-empty line) or empty string
    # =============================================================================
    local file_path="$1"
    local value=""
    local fix_instruction="Run dd.sh (Secret Decryption Fix) to decrypt secret files"
    
    if [ ! -f "$file_path" ]; then
        echo "[WARNING] Secret file not found: $file_path" >&2
        echo "[ACTION] $fix_instruction" >&2
        echo ""
        return 1
    fi
    
    # Check if file starts with UTF-8 BOM (EF BB BF) by reading first 3 bytes
    local first_bytes=$(head -c 3 "$file_path" 2>/dev/null | od -An -tx1 2>/dev/null | tr -d ' \\n' 2>/dev/null || echo "")
    local has_bom=0
    if [ "$first_bytes" = "efbbbf" ]; then
        has_bom=1
    fi
    
    # Read file content, handling BOM correctly
    if [ "$has_bom" -eq 1 ]; then
        # File has UTF-8 BOM, skip first 3 bytes using dd
        while IFS= read -r line || [ -n "$line" ]; do
            # Trim whitespace
            trimmed_line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
            if [ -n "$trimmed_line" ]; then
                value="$trimmed_line"
                break
            fi
        done < <(dd if="$file_path" bs=1 skip=3 2>/dev/null)
    else
        # No BOM, read file normally
        while IFS= read -r line || [ -n "$line" ]; do
            # Trim whitespace
            trimmed_line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
            if [ -n "$trimmed_line" ]; then
                value="$trimmed_line"
                break
            fi
        done < "$file_path"
    fi
    
    if [ -z "$value" ]; then
        echo "[WARNING] Secret file is empty or contains no valid content: $file_path" >&2
        echo "[ACTION] $fix_instruction" >&2
        echo ""
        return 1
    fi
    
    echo "$value"
    return 0
}}

load_secret_value() {{
    # =============================================================================
    # Enhanced function to load secret value and set environment variable
    # =============================================================================
    # Usage: load_secret_value <key_name> <env_name> <display_name> <default_value>
    # Calls read_secret_file for actual file reading
    # =============================================================================
    local key_name="$1"
    local env_name="$2"
    local display_name="$3"
    local default_value="$4"
    local value=""
    local secret_file="$secret_dir/$key_name"
    local fix_instruction="Run dd.sh (Secret Decryption Fix) to decrypt secret files"

    echo "[DEBUG] Loading secret key: $key_name -> $env_name"
    echo "[DEBUG] Secret file: $secret_file"

    # Call enhanced read function
    value=$(read_secret_file "$secret_file")
    local read_exit_code=$?

    echo "[DEBUG] Returned value length: ${{#value}}"

    # Use default value if secret loading failed and default is provided
    if [ -z "$value" ] && [ -n "$default_value" ]; then
        value="$default_value"
        echo "[INFO] Using default value for $display_name"
    fi

    if [ -n "$value" ]; then
        export "$env_name"="$value"
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
    echo "[ACTION] $fix_instruction"
    return 1
}}

{load_commands}

echo ""
"""


__all__ = ['EnvLoadingSectionGenerator']

