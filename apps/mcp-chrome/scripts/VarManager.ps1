# VarManager.ps1
# PowerShell 变量管理�?
# 负责读写文件变量

# 获取变量存储目录
function Get-VarsDir {
    $userProfile = [Environment]::GetFolderPath("UserProfile")
    $varsDir = Join-Path $userProfile ".core_node\.build_global_vars"

    # 确保目录存在
    if (-not (Test-Path $varsDir)) {
        try {
            New-Item -ItemType Directory -Path $varsDir -Force | Out-Null
        }
        catch {
            Write-Error "Failed to create vars directory: $varsDir"
            Write-Error $_.Exception.Message
            exit 1
        }
    }

    return $varsDir
}

# 设置变量（写入文件）
function Set-Var {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Key,

        [Parameter(Mandatory=$true)]
        [AllowEmptyString()]
        [string]$Value
    )

    if ([string]::IsNullOrEmpty($Key)) {
        throw "Variable key cannot be empty"
    }

    $varsDir = Get-VarsDir
    $varFile = Join-Path $varsDir $Key

    try {
        [System.IO.File]::WriteAllText($varFile, $Value, [System.Text.Encoding]::UTF8)
    }
    catch {
        Write-Error "Failed to write variable '$Key': $_"
        throw
    }
}

# 获取变量（读取文件）
function Get-Var {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Key,

        [Parameter(Mandatory=$false)]
        [string]$Default = $null
    )

    if ([string]::IsNullOrEmpty($Key)) {
        throw "Variable key cannot be empty"
    }

    $varsDir = Get-VarsDir
    $varFile = Join-Path $varsDir $Key

    if (-not (Test-Path $varFile)) {
        return $Default
    }

    try {
        return [System.IO.File]::ReadAllText($varFile, [System.Text.Encoding]::UTF8)
    }
    catch {
        Write-Warning "Failed to read variable '$Key': $_"
        return $Default
    }
}

# 删除变量（删除文件）
function Remove-Var {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Key
    )

    if ([string]::IsNullOrEmpty($Key)) {
        throw "Variable key cannot be empty"
    }

    $varsDir = Get-VarsDir
    $varFile = Join-Path $varsDir $Key

    if (Test-Path $varFile) {
        try {
            Remove-Item -Path $varFile -Force
        }
        catch {
            Write-Warning "Failed to delete variable '$Key': $_"
        }
    }
}

# 清除所有变�?
function Clear-AllVars {
    $varsDir = Get-VarsDir

    if (Test-Path $varsDir) {
        Get-ChildItem -Path $varsDir -File | ForEach-Object {
            try {
                Remove-Item -Path $_.FullName -Force
            }
            catch {
                Write-Warning "Failed to delete $($_.Name): $_"
            }
        }
    }
}

# 列出所有变�?
function Get-AllVars {
    $varsDir = Get-VarsDir
    $result = @{}

    if (Test-Path $varsDir) {
        Get-ChildItem -Path $varsDir -File | ForEach-Object {
            try {
                $content = [System.IO.File]::ReadAllText($_.FullName, [System.Text.Encoding]::UTF8)
                $result[$_.Name] = $content
            }
            catch {
                Write-Warning "Failed to read $($_.Name): $_"
            }
        }
    }

    return $result
}

# 检查变量是否存�?
function Test-Var {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Key
    )

    if ([string]::IsNullOrEmpty($Key)) {
        return $false
    }

    $varsDir = Get-VarsDir
    $varFile = Join-Path $varsDir $Key

    return Test-Path $varFile
}
