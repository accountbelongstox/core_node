# App Manager - Application scanner (Windows PS1)
# Scans apps/, pyapps/, poly_apps/ under root; detects framework; assigns port.

param()
$ErrorActionPreference = 'Stop'

function Test-HasEntryPoint {
    param([string]$AppPath)
    foreach ($entry in $Script:EntryPoints) {
        if (Test-Path -LiteralPath (Join-Path $AppPath $entry)) { return $true }
    }
    return $false
}

function Get-DetectedFramework {
    param([string]$AppPath, [string]$AppType)
    $p = $AppPath
    # reactNative: package.json + (android or ios) + "react-native" in package
    if ((Test-Path (Join-Path $p "package.json")) -and
        ((Test-Path (Join-Path $p "android")) -or (Test-Path (Join-Path $p "ios")))) {
        try {
            $c = Get-Content (Join-Path $p "package.json") -Raw -ErrorAction Stop
            if ($c -match 'react-native') { return 'reactNativeStart' }
        } catch {}
    }
    if (Test-Path (Join-Path $p "nuxt.config.ts")) { return 'nuxtStart' }
    if (Test-Path (Join-Path $p "nuxt.config.js")) { return 'nuxtStart' }
    if (Test-Path (Join-Path $p "package.json")) {
        try {
            $c = Get-Content (Join-Path $p "package.json") -Raw -ErrorAction Stop
            if ($c -match 'react' -and $c -notmatch 'react-native' -and $c -notmatch 'nuxt') { return 'reactStart' }
            if ($c -match 'vue' -and $c -notmatch 'nuxt') { return 'vueStart' }
        } catch {}
    }
    if (Test-Path (Join-Path $p "composer.json")) { return 'laravelStart' }
    if (Test-Path (Join-Path $p "pubspec.yaml")) { return 'flutterStart' }
    if ((Test-Path (Join-Path $p "build.gradle.kts")) -or (Test-Path (Join-Path $p "build.gradle"))) { return 'kotlinMultiPlatformStart' }
    if (Test-Path (Join-Path $p "index.php")) { return 'phpStart' }
    if (Test-Path (Join-Path $p "main.py")) { return 'pyStart' }
    return 'polyLauncher'
}

function Test-DebugMode {
    param([string]$AppPath, [string]$Framework)
    $envFiles = @('.env', '.env.local', '.env.development')
    foreach ($f in $envFiles) {
        $fp = Join-Path $AppPath $f
        if (Test-Path $fp) {
            try {
                $c = Get-Content $fp -Raw -ErrorAction Stop
                if ($c -match 'APP_ENV=local|NODE_ENV=development|APP_DEBUG=true') { return $true }
            } catch {}
        }
    }
    if ($Framework -match 'reactStart|vueStart|nuxtStart') {
        if ((Test-Path (Join-Path $AppPath "vite.config.js")) -or (Test-Path (Join-Path $AppPath "vite.config.ts"))) { return $true }
    }
    $devDirs = @('node_modules', 'src', 'lib')
    $count = 0
    foreach ($d in $devDirs) {
        if (Test-Path (Join-Path $AppPath $d)) { $count++ }
    }
    if ($count -ge 2) { return $true }
    if ($AppPath -match 'poly_apps|dev|development') { return $true }
    return $false
}

function Get-ScannedApplications {
    param([string]$RootDir)
    if (-not $RootDir -or -not (Test-Path $RootDir)) { return @() }
    $allApps = [System.Collections.ArrayList]@()
    $dirs = @(
        @{ Dir = Join-Path $RootDir "apps";     Type = "ncoreApp" }
        @{ Dir = Join-Path $RootDir "pyapps";   Type = "pycoreApp" }
        @{ Dir = Join-Path $RootDir "poly_apps"; Type = "polyApp" }
    )
    foreach ($d in $dirs) {
        $dirPath = $d.Dir
        $appType = $d.Type
        if (-not (Test-Path $dirPath)) { continue }
        foreach ($item in Get-ChildItem -Path $dirPath -Directory -ErrorAction SilentlyContinue) {
            if ($item.Name.StartsWith('.')) { continue }
            $appPath = $item.FullName
            if (-not (Test-HasEntryPoint -AppPath $appPath)) { continue }
            $framework = Get-DetectedFramework -AppPath $appPath -AppType $appType
            $debug = Test-DebugMode -AppPath $appPath -Framework $framework
            [void]$allApps.Add([PSCustomObject]@{
                Name      = $item.Name
                Path      = $appPath
                Type      = $appType
                Framework = $framework
                Port      = 0
                Debug     = $debug
                Command   = ""
            })
        }
    }
    $sorted = $allApps | Sort-Object -Property Name
    $basePort = $Script:AppManagerConfig.BasePort
    $i = 0
    foreach ($a in $sorted) {
        $a.Port = $basePort + $i
        $i++
    }
    return [array]$sorted
}
