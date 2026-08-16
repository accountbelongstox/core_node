$Laravel13TargetMajor = 13

function Get-LaravelFrameworkMajor {
    param(
        [Parameter(Mandatory = $true)][string]$LaravelRoot,
        [Parameter(Mandatory = $true)][string]$PhpExecutable
    )

    $autoloadPath = Join-Path $LaravelRoot "vendor\autoload.php"
    $lockPath = Join-Path $LaravelRoot "composer.lock"
    $version = $null
    $majorText = $null
    $major = 0
    $lock = $null
    $frameworkPackage = $null

    if (Test-Path -LiteralPath $autoloadPath) {
        $version = & $PhpExecutable -r 'require $argv[1]; echo \Composer\InstalledVersions::getPrettyVersion("laravel/framework") ?? "";' $autoloadPath 2>$null
    } elseif (Test-Path -LiteralPath $lockPath) {
        $lock = Get-Content -Raw -LiteralPath $lockPath | ConvertFrom-Json
        $frameworkPackage = @($lock.packages) | Where-Object { $_.name -eq "laravel/framework" } | Select-Object -First 1
        if ($frameworkPackage) {
            $version = $frameworkPackage.version
        }
    }

    if ([string]::IsNullOrWhiteSpace([string]$version)) {
        return $null
    }

    $majorText = ([string]$version).Trim().TrimStart("v").Split(".")[0]
    if (-not [int]::TryParse($majorText, [ref]$major)) {
        return $null
    }

    return $major
}

function Invoke-Laravel13Upgrade {
    param(
        [Parameter(Mandatory = $true)][string]$LaravelRoot,
        [Parameter(Mandatory = $true)][string]$PhpExecutable,
        [Parameter(Mandatory = $true)][string]$ComposerExecutable
    )

    $resolvedLaravelRoot = (Resolve-Path -LiteralPath $LaravelRoot).Path
    $currentMajor = Get-LaravelFrameworkMajor -LaravelRoot $resolvedLaravelRoot -PhpExecutable $PhpExecutable
    $answer = $null
    $vendorPath = Join-Path $resolvedLaravelRoot "vendor"
    $resolvedVendorPath = $null
    $expectedVendorPath = [System.IO.Path]::GetFullPath($vendorPath)
    $composerExitCode = 0
    $upgradedMajor = $null
    $isInteractive = [Environment]::UserInteractive -and -not [Console]::IsInputRedirected
    $vendorItem = $null

    if (($null -eq $currentMajor) -or ($currentMajor -eq $Laravel13TargetMajor)) {
        return $true
    }

    if ($currentMajor -ne 12) {
        Write-Host "ERROR: Unsupported Laravel framework major detected: $currentMajor. Laravel 13 is required." -ForegroundColor Red
        return $false
    }

    if ($isInteractive) {
        $answer = Read-Host "Laravel 12 detected. Upgrade to Laravel 13? [y/N]"
    }
    if ($answer -notin @("y", "Y")) {
        Write-Host "Laravel 13 upgrade declined. Startup stopped because Laravel 12 is unsupported." -ForegroundColor Yellow
        return $false
    }

    if (Test-Path -LiteralPath $vendorPath) {
        $vendorItem = Get-Item -LiteralPath $vendorPath
        if (($vendorItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            Write-Host "ERROR: Refusing to remove a vendor reparse point: $vendorPath" -ForegroundColor Red
            return $false
        }

        $resolvedVendorPath = (Resolve-Path -LiteralPath $vendorPath).Path
        if (-not [System.StringComparer]::OrdinalIgnoreCase.Equals(
            [System.IO.Path]::GetFullPath($resolvedVendorPath),
            $expectedVendorPath
        )) {
            Write-Host "ERROR: Refusing to remove an unexpected vendor path: $resolvedVendorPath" -ForegroundColor Red
            return $false
        }

        Write-Host "Removing Laravel 12 dependencies: $resolvedVendorPath" -ForegroundColor Yellow
        try {
            Remove-Item -LiteralPath $resolvedVendorPath -Recurse -Force -ErrorAction Stop
        } catch {
            Write-Host "ERROR: Laravel 12 vendor removal failed: $($_.Exception.Message)" -ForegroundColor Red
            return $false
        }
    }

    Write-Host "Resolving the Laravel 13 dependency graph..." -ForegroundColor Yellow
    & $ComposerExecutable "--working-dir=$resolvedLaravelRoot" update --with-all-dependencies --no-interaction
    $composerExitCode = $LASTEXITCODE
    if ($composerExitCode -ne 0) {
        Write-Host "ERROR: Composer could not install Laravel 13 dependencies." -ForegroundColor Red
        return $false
    }

    $upgradedMajor = Get-LaravelFrameworkMajor -LaravelRoot $resolvedLaravelRoot -PhpExecutable $PhpExecutable
    if ($upgradedMajor -ne $Laravel13TargetMajor) {
        Write-Host "ERROR: Composer completed without installing Laravel 13." -ForegroundColor Red
        return $false
    }

    Write-Host "Laravel 13 dependencies installed successfully." -ForegroundColor Green
    return $true
}
