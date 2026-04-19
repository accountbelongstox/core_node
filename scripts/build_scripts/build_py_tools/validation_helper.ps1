# Validation Helper Functions - Windows PowerShell Version
# Integrates Python validation modules with PowerShell script execution
# Follows architecture: Python validates, Shell executes

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

# Colors for output
function Write-ColorText {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Text,
        [Parameter(Mandatory=$false)]
        [string]$Color = "White"
    )

    Write-Host $Text -ForegroundColor $Color
}

function Write-Success {
    param([string]$Text)
    Write-ColorText $Text -Color Green
}

function Write-Error {
    param([string]$Text)
    Write-ColorText $Text -Color Red
}

function Write-Warning {
    param([string]$Text)
    Write-ColorText $Text -Color Yellow
}

function Write-Info {
    param([string]$Text)
    Write-ColorText $Text -Color Cyan
}

function Validate-Project {
    param(
        [Parameter(Mandatory=$true)]
        [string]$ProjectPath,
        [Parameter(Mandatory=$true)]
        [string]$ProjectType,
        [Parameter(Mandatory=$true)]
        [string]$ProjectName
    )

    Write-Host ""
    Write-Info "==============================================================================="
    Write-Info "  PROJECT VALIDATION"
    Write-Info "==============================================================================="
    Write-Host ""

    $result = & python "$SCRIPT_DIR/project_validator.py" "$ProjectPath" "$ProjectType" "$ProjectName"

    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Error "�?Project validation failed"
        Write-Warning "Please fix the issues above before proceeding"
        return $false
    }

    Write-Host ""
    Write-Success "�?Project validation passed"
    return $true
}

function Check-AndInstallDependencies {
    param(
        [Parameter(Mandatory=$true)]
        [string]$ProjectPath,
        [Parameter(Mandatory=$true)]
        [string]$ProjectType,
        [Parameter(Mandatory=$true)]
        [string]$ProjectName,
        [Parameter(Mandatory=$false)]
        [bool]$AutoInstall = $false
    )

    Write-Host ""
    Write-Info "==============================================================================="
    Write-Info "  DEPENDENCY CHECK"
    Write-Info "==============================================================================="
    Write-Host ""

    # First validate the project to get validation info
    & python "$SCRIPT_DIR/project_validator.py" "$ProjectPath" "$ProjectType" "$ProjectName" | Out-Null

    # Run dependency check
    $depOutput = & python "$SCRIPT_DIR/dependency_manager.py" "$ProjectPath" "$ProjectType" "$ProjectName" 2>&1
    $depResult = $LASTEXITCODE

    if ($depResult -ne 0) {
        Write-Host ""
        Write-Warning "�?Dependencies are missing or incomplete"

        # Try to parse install command from output
        $installCmd = $null
        foreach ($line in $depOutput) {
            if ($line -match "(?:npm|pnpm|yarn|composer)\s+install") {
                $installCmd = $matches[0]
                break
            }
        }

        if ($installCmd) {
            if ($AutoInstall) {
                Write-Host ""
                Write-Info "Auto-installing dependencies..."
                Write-Info "Command: $installCmd"
                Write-Host ""

                Push-Location $ProjectPath
                Invoke-Expression $installCmd

                if ($LASTEXITCODE -eq 0) {
                    Write-Host ""
                    Write-Success "�?Dependencies installed successfully"
                    Pop-Location
                    return $true
                } else {
                    Write-Host ""
                    Write-Error "�?Failed to install dependencies"
                    Pop-Location
                    return $false
                }
            } else {
                Write-Host ""
                Write-Warning "To install dependencies, run:"
                Write-Info "  cd `"$ProjectPath`""
                Write-Info "  $installCmd"
                Write-Host ""
                Write-Warning "Or enable AUTO_INSTALL to install automatically"
                return $false
            }
        }

        return $false
    }

    Write-Host ""
    Write-Success "�?Dependencies are installed"
    return $true
}

function Validate-BuildRequirements {
    param(
        [Parameter(Mandatory=$true)]
        [string]$ProjectPath,
        [Parameter(Mandatory=$true)]
        [string]$ProjectType,
        [Parameter(Mandatory=$true)]
        [string]$ProjectName,
        [Parameter(Mandatory=$true)]
        [string]$Action
    )

    Write-Host ""
    Write-Info "==============================================================================="
    Write-Info "  BUILD REQUIREMENTS CHECK"
    Write-Info "==============================================================================="
    Write-Host ""

    # Get validation info
    & python "$SCRIPT_DIR/project_validator.py" "$ProjectPath" "$ProjectType" "$ProjectName" | Out-Null

    # Run build requirements validation
    & python "$SCRIPT_DIR/build_validator.py" "$ProjectPath" "$ProjectType" "$Action" "$ProjectName"
    $buildReqResult = $LASTEXITCODE

    if ($buildReqResult -ne 0) {
        Write-Host ""
        Write-Error "�?Build requirements not met"
        return $false
    }

    Write-Host ""
    Write-Success "�?Build requirements satisfied"
    return $true
}

function Validate-BuildOutput {
    param(
        [Parameter(Mandatory=$true)]
        [string]$ProjectPath,
        [Parameter(Mandatory=$true)]
        [string]$ProjectType,
        [Parameter(Mandatory=$true)]
        [string]$ProjectName
    )

    Write-Host ""
    Write-Info "==============================================================================="
    Write-Info "  BUILD OUTPUT VALIDATION"
    Write-Info "==============================================================================="
    Write-Host ""

    # Basic directory checks based on project type
    $validated = $false

    switch ($ProjectType) {
        "nuxt" {
            $outputPath = Join-Path $ProjectPath ".output"
            $indexPath = Join-Path $ProjectPath ".output/server/index.mjs"

            if (Test-Path $outputPath) {
                if (Test-Path $indexPath) {
                    Write-Success "�?Nuxt build output validated"
                    $validated = $true
                } else {
                    Write-Error "�?Missing critical file: .output/server/index.mjs"
                }
            } else {
                Write-Error "�?Build output directory not found: .output"
            }
        }

        { $_ -in @("react", "vue", "vite") } {
            $distPath = Join-Path $ProjectPath "dist"
            $buildPath = Join-Path $ProjectPath "build"

            if (Test-Path $distPath) {
                $indexPath = Join-Path $distPath "index.html"
                if (Test-Path $indexPath) {
                    Write-Success "�?Build output validated: dist/index.html exists"
                } else {
                    Write-Warning "�?Build output found but missing index.html"
                }
                $validated = $true
            } elseif (Test-Path $buildPath) {
                $indexPath = Join-Path $buildPath "index.html"
                if (Test-Path $indexPath) {
                    Write-Success "�?Build output validated: build/index.html exists"
                } else {
                    Write-Warning "�?Build output found but missing index.html"
                }
                $validated = $true
            } else {
                Write-Error "�?Build output directory not found (checked: dist/, build/)"
            }
        }

        default {
            Write-Warning "�?No validation rules for project type: $ProjectType"
            $validated = $true
        }
    }

    return $validated
}

function Run-FullValidation {
    param(
        [Parameter(Mandatory=$true)]
        [string]$ProjectPath,
        [Parameter(Mandatory=$true)]
        [string]$ProjectType,
        [Parameter(Mandatory=$true)]
        [string]$ProjectName,
        [Parameter(Mandatory=$true)]
        [string]$Action,
        [Parameter(Mandatory=$false)]
        [bool]$AutoInstall = $false
    )

    Write-Host ""
    Write-Info "╔═══════════════════════════════════════════════════════════════════════════�?
    Write-Info "�?                   COMPREHENSIVE VALIDATION SYSTEM                        �?
    Write-Info "╚═══════════════════════════════════════════════════════════════════════════�?
    Write-Host ""
    Write-ColorText "Project: $ProjectName" -Color Blue
    Write-ColorText "Type: $ProjectType" -Color Blue
    Write-ColorText "Path: $ProjectPath" -Color Blue
    Write-ColorText "Action: $Action" -Color Blue
    Write-Host ""

    # Step 1: Validate project structure
    if (!(Validate-Project $ProjectPath $ProjectType $ProjectName)) {
        Write-Host ""
        Write-Error "══════════════════════════════════════════════════════════════════════════�?
        Write-Error "  VALIDATION FAILED: Project structure issues"
        Write-Error "══════════════════════════════════════════════════════════════════════════�?
        return $false
    }

    # Step 2: Check dependencies
    if (!(Check-AndInstallDependencies $ProjectPath $ProjectType $ProjectName $AutoInstall)) {
        Write-Host ""
        Write-Error "══════════════════════════════════════════════════════════════════════════�?
        Write-Error "  VALIDATION FAILED: Dependency issues"
        Write-Error "══════════════════════════════════════════════════════════════════════════�?
        return $false
    }

    # Step 3: Validate build requirements (only for build/generate actions)
    if ($Action -in @("build", "generate")) {
        if (!(Validate-BuildRequirements $ProjectPath $ProjectType $ProjectName $Action)) {
            Write-Host ""
            Write-Error "══════════════════════════════════════════════════════════════════════════�?
            Write-Error "  VALIDATION FAILED: Build requirements not met"
            Write-Error "══════════════════════════════════════════════════════════════════════════�?
            return $false
        }
    }

    Write-Host ""
    Write-Success "╔═══════════════════════════════════════════════════════════════════════════�?
    Write-Success "�?                   �?ALL VALIDATIONS PASSED                               �?
    Write-Success "╚═══════════════════════════════════════════════════════════════════════════�?
    Write-Host ""

    return $true
}

# Export functions (PowerShell equivalent of bash export -f)
Export-ModuleMember -Function Validate-Project
Export-ModuleMember -Function Check-AndInstallDependencies
Export-ModuleMember -Function Validate-BuildRequirements
Export-ModuleMember -Function Validate-BuildOutput
Export-ModuleMember -Function Run-FullValidation
