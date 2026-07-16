# Installs pycore third_party DEPENDENCY_MAP pip packages (Windows Step10 phase 2).
# Mirrors linux/debian/install_shells/13_ensure_python.sh
# check_and_install_python_packages_from_dependency_map().
# torch/ultralytics/paddle OCR bundles are handled by PythonPrereqInstallCommon.ps1.
# TTS/STT heavy stacks (edge-tts, whisper, faster-whisper, MeloTTS) stay in Step11-13.

. (Join-Path $PSScriptRoot 'PythonRuntimeCommon.ps1')

$script:PycoreDepSkipImportNames = @(
    'torch', 'ultralytics', 'edge_tts', 'whisper'
)
$script:PycoreDepAlreadyInBackendBundle = @(
    'PIL', 'cv2', 'pyautogui', 'pydirectinput', 'psutil', 'mss', 'numpy', 'scipy', 'fastapi', 'uvicorn',
    'pyclipper', 'shapely', 'websocket'
)
$script:PycoreDepWinrtOcrPackages = @(
    'winrt-Windows.Foundation',
    'winrt-Windows.Foundation.Collections',
    'winrt-Windows.Media.Ocr',
    'winrt-Windows.Graphics.Imaging',
    'winrt-Windows.Storage.Streams',
    'winrt-Windows.Globalization'
)
$script:PycoreDepPrepareAlignedPackages = @(
    'multipart|python-multipart|'
    'easyocr|easyocr|'
)
$script:PycoreDepRequiredPackages = @(
    'PIL|Pillow|'
    'cv2|opencv-python|'
    'adb_shell|adb-shell|'
    'av|av|'
    'websockets|websockets|'
    'requests|requests|'
    'aiohttp|aiohttp|'
    'tkinterweb|tkinterweb|'
    'tkhtmlview|tkhtmlview|'
    'pystray|pystray|'
    'loguru|loguru|'
    'yaml|pyyaml|'
    'pypdf|pypdf|'
    'pdfplumber|pdfplumber|'
    'docx|python-docx|'
    'openpyxl|openpyxl|'
    'pptx|python-pptx|'
    'bs4|beautifulsoup4|'
    'sklearn|scikit-learn|'
    'selenium|selenium|'
    'webdriver_manager|webdriver-manager|'
    'sqlalchemy|sqlalchemy|'
    'fastmcp|fastmcp|'
    'azure.cognitiveservices.speech|azure-cognitiveservices-speech|'
    'vosk|vosk|'
    'pynput|pynput|'
    'pyperclip|pyperclip|'
    'googletrans|googletrans|'
    'httpx|httpx|'
    'okx|python-okx|'
    'redis|redis|'
    'google.genai|google-genai|'
    'pygame|pygame|'
    'eng_to_ipa|eng-to-ipa|'
    'urllib3|urllib3|'
    'idna|idna|'
    'chardet|chardet|'
    'certifi|certifi|'
    'zmq|pyzmq|'
    'msgpack|msgpack|'
    'werkzeug|Werkzeug|'
    'h5py|h5py|'
    'absl|absl-py|'
    'google.protobuf|protobuf|'
    'grpc|grpcio|'
    'six|six|'
    'typing_extensions|typing_extensions|'
    'matplotlib|matplotlib|'
    'huggingface_hub|huggingface_hub|'
    'pytesseract|pytesseract|'
    'openai|openai|'
    'cryptography|cryptography|'
    'PyQt5|PyQt5|'
    'labelme|labelme|'
    'labelImg|labelImg|'
    'PySide6|PySide6|'
)
$script:PycoreDepOptionalPackages = @(
    'watchdog|watchdog|'
    'ebooklib|ebooklib|'
    'striprtf|striprtf|'
    'lxml|lxml|'
    'nltk|nltk|'
)
$script:PycoreDepWindowsOnlyPackages = @(
    'win32gui|pywin32|'
    'pywinauto|pywinauto|'
    'pygetwindow|pygetwindow|'
    'uiautomation|uiautomation|'
    'pyaudiowpatch|pyaudiowpatch|'
    'pyaudio|pyaudio|'
)

function Get-PipPackageBaseName {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PipSpec
    )

    $name = ($PipSpec -split '\[')[0]
    $name = ($name -split '[<>=!,\s]')[0].Trim()
    return $name
}

function Ensure-OnnxRuntimeCpuBuild {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PipExe,
        [string]$LogPrefix = '[python-deps]'
    )

    if (Test-NvidiaGpuPresent) {
        Write-Host "$LogPrefix [i] GPU present; ONNX runtime left to the in-process OCR initializer." -ForegroundColor DarkGray
        return
    }

    $gpuPkg = 'onnxruntime-gpu'
    $cpuPkg = 'onnxruntime'
    if (Test-PipPackageInstalled -PipExe $PipExe -PackageName $gpuPkg) {
        Write-Host "$LogPrefix [..] No GPU but $gpuPkg present -> switching to CPU $cpuPkg ..." -ForegroundColor Yellow
        & $PipExe uninstall -y $gpuPkg
    }
    if (-not (Test-PipPackageInstalled -PipExe $PipExe -PackageName $cpuPkg)) {
        Write-Host "$LogPrefix [..] Installing CPU $cpuPkg ..." -ForegroundColor Yellow
        & $PipExe install $cpuPkg
    }
}

function Install-PycoreDependencyMapPackage {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ImportName,
        [Parameter(Mandatory = $true)]
        [string]$PipSpec,
        [Parameter(Mandatory = $true)]
        [string]$PipExe,
        [string]$LogPrefix = '[python-deps]'
    )

    $pipBase = Get-PipPackageBaseName -PipSpec $PipSpec
    if (Test-PipPackageInstalled -PipExe $PipExe -PackageName $pipBase) {
        Write-Host "$LogPrefix [SKIP] $pipBase already installed" -ForegroundColor DarkGray
        return $true
    }

    Write-Host "$LogPrefix [..] pip install $PipSpec ..." -ForegroundColor Yellow
    & $PipExe install $PipSpec
    if (Test-PipPackageInstalled -PipExe $PipExe -PackageName $pipBase) {
        Write-Host "$LogPrefix [OK] $pipBase installed" -ForegroundColor Green
        return $true
    }

    Write-Host "$LogPrefix [!] $pipBase still missing after install" -ForegroundColor DarkYellow
    return $false
}

function Test-PycorePythonModulePresent {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExe,
        [Parameter(Mandatory = $true)]
        [string]$ModuleName
    )

    $modLiteral = ($ModuleName -replace "'", "''")
    $code = @"
import importlib.util
try:
    ok = importlib.util.find_spec('$modLiteral') is not None
except Exception:
    ok = False
print('__FOUND__' if ok else '__MISSING__')
"@
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $out = (& $PythonExe -c $code 2>$null) -join ''
    $ErrorActionPreference = $prevEap
    return ($out -match '__FOUND__')
}

function Install-PycoreWinrtOcrPackages {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExe,
        [Parameter(Mandatory = $true)]
        [string]$PipExe,
        [string]$LogPrefix = '[python-deps]'
    )

    if (Test-PycorePythonModulePresent -PythonExe $PythonExe -ModuleName 'winrt.windows.media.ocr') {
        Write-Host "$LogPrefix [SKIP] Windows OCR (WinRT) already importable" -ForegroundColor DarkGray
        return
    }

    $missing = New-Object System.Collections.Generic.List[string]
    foreach ($pkg in $script:PycoreDepWinrtOcrPackages) {
        if (-not (Test-PipPackageInstalled -PipExe $PipExe -PackageName $pkg)) {
            $missing.Add($pkg)
        }
    }
    if ($missing.Count -eq 0) {
        Write-Host "$LogPrefix [SKIP] WinRT OCR projection packages already installed" -ForegroundColor DarkGray
        return
    }

    Write-Host ("$LogPrefix [..] pip install {0} ..." -f ($missing -join ' ')) -ForegroundColor Yellow
    & $PipExe install @missing
    if (Test-PycorePythonModulePresent -PythonExe $PythonExe -ModuleName 'winrt.windows.media.ocr') {
        Write-Host "$LogPrefix [OK] Windows OCR (WinRT) installed" -ForegroundColor Green
    } else {
        Write-Host "$LogPrefix [!] WinRT OCR still not importable; easyocr/cnocr remain available" -ForegroundColor DarkYellow
    }
}

function Ensure-Pywin32Importable {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExe,
        [Parameter(Mandatory = $true)]
        [string]$PipExe,
        [string]$LogPrefix = '[python-deps]'
    )

    if (Test-PycorePythonModulePresent -PythonExe $PythonExe -ModuleName 'win32gui') {
        Write-Host "$LogPrefix [SKIP] win32gui already importable (pywin32)" -ForegroundColor DarkGray
        return
    }

    Write-Host "$LogPrefix [..] pip install pywin32 (win32gui required by window_finder) ..." -ForegroundColor Yellow
    & $PipExe install pywin32
    if (Test-PycorePythonModulePresent -PythonExe $PythonExe -ModuleName 'win32gui') {
        Write-Host "$LogPrefix [OK] pywin32 installed; win32gui importable" -ForegroundColor Green
        return
    }

    Write-Host "$LogPrefix [ERROR] win32gui still not importable after pywin32 install." -ForegroundColor Red
}

function Install-PycorePrepareAlignedPackages {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExe,
        [Parameter(Mandatory = $true)]
        [string]$PipExe,
        [string]$LogPrefix = '[python-deps]'
    )

    Write-Host "$LogPrefix Installing prepare.ps1-aligned pip packages (OCR WinRT, document extras) ..." -ForegroundColor Cyan
    Ensure-Pywin32Importable -PythonExe $PythonExe -PipExe $PipExe -LogPrefix $LogPrefix
    Write-Host ''
    Install-PycoreWinrtOcrPackages -PythonExe $PythonExe -PipExe $PipExe -LogPrefix $LogPrefix
    Write-Host ''

    foreach ($packageSpec in $script:PycoreDepPrepareAlignedPackages) {
        $parts = $packageSpec -split '\|', 3
        $importName = $parts[0]
        $pipSpec = $parts[1]
        if ($importName -eq 'easyocr') {
            if (Test-PycorePythonModulePresent -PythonExe $PythonExe -ModuleName 'easyocr') {
                Write-Host "$LogPrefix [SKIP] easyocr already installed" -ForegroundColor DarkGray
                continue
            }
            Write-Host "$LogPrefix [..] pip install easyocr ..." -ForegroundColor Yellow
            & $PipExe install easyocr
            if (Test-PycorePythonModulePresent -PythonExe $PythonExe -ModuleName 'easyocr') {
                Write-Host "$LogPrefix [OK] easyocr installed" -ForegroundColor Green
            } else {
                Write-Host "$LogPrefix [!] easyocr install failed (often locked cv2.pyd); cnocr/windows OCR still work" -ForegroundColor DarkYellow
            }
            continue
        }
        Install-PycoreDependencyMapPackage -ImportName $importName -PipSpec $pipSpec -PipExe $PipExe -LogPrefix $LogPrefix | Out-Null
    }

    Write-Host ''
}

function Install-PycoreDependencyMapPackages {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PipExe,
        [string]$PythonExe = '',
        [string]$LogPrefix = '[python-deps]'
    )

    if (-not $PythonExe) {
        $PythonExe = Join-Path (Split-Path -Parent (Split-Path -Parent $PipExe)) 'python.exe'
    }

    Write-Host "$LogPrefix Installing pycore DEPENDENCY_MAP pip packages (Step10 phase 2) ..." -ForegroundColor Cyan
    if (Get-Command Ensure-PipCacheDirConfigured -ErrorAction SilentlyContinue) {
        Ensure-PipCacheDirConfigured -PipExe $PipExe
    }
    Ensure-OnnxRuntimeCpuBuild -PipExe $PipExe -LogPrefix $LogPrefix
    Write-Host ''

    $installed = 0
    $failed = 0
    $allSpecs = $script:PycoreDepRequiredPackages + $script:PycoreDepWindowsOnlyPackages + $script:PycoreDepOptionalPackages

    foreach ($packageSpec in $allSpecs) {
        $parts = $packageSpec -split '\|', 3
        $importName = $parts[0]
        $pipSpec = $parts[1]

        if ($script:PycoreDepSkipImportNames -contains $importName) {
            continue
        }
        if ($script:PycoreDepAlreadyInBackendBundle -contains $importName) {
            continue
        }

        if (Install-PycoreDependencyMapPackage -ImportName $importName -PipSpec $pipSpec -PipExe $PipExe -LogPrefix $LogPrefix) {
            $installed++
        } else {
            $failed++
        }
    }

    Write-Host ''
    Write-Host "$LogPrefix DEPENDENCY_MAP install summary: $installed ok, $failed missing/skipped" -ForegroundColor Cyan
    Write-Host ''

    Install-PycorePrepareAlignedPackages -PythonExe $PythonExe -PipExe $PipExe -LogPrefix $LogPrefix
}
