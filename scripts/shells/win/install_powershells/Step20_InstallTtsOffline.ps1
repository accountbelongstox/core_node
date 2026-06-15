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

# Single source of truth for the OFFLINE TTS fallback engines used by the pycore
# voice-subtitle pipeline (fallbacks for when Edge TTS is 403'd / region-blocked).
# Runs AFTER Step9_InstallPython. Also invoked by
# pycore\scripts\iniscripts\install_tts_offline.ps1 (the pyservice prerequisite).
#
# Engines:
#   - Sherpa-ONNX (DEFAULT): pure-pip `sherpa-onnx`, no system deps, plus a
#     Kokoro multi-lang (zh/en) model downloaded into <USERPROFILE>\.core_node\
#     cache\tts\sherpa. This is the reliable "never fails" offline engine.
#   - MeloTTS (OPT-IN via -Melotts): pinned transformers==4.27.4 can clash with
#     the shared env (google-genai etc.), so it is NOT installed by default.
#   - GPT-SoVITS: NOT installed here (multi-GB repo + conda + GPU); the pycore
#     client talks to its api server on 127.0.0.1:9880 if the user runs it.
#
# Invocation contracts:
#   - DevInstaller flow:  & Step20_InstallTtsOffline.ps1 <Region>
#   - pyservice flow:     & Step20_InstallTtsOffline.ps1 -Python <py> [-Melotts] [-Force]
[CmdletBinding()]
param(
    [string]$Region = 'Global',
    [string]$Python = '',
    [switch]$Melotts,
    [switch]$Force
)

# Variable Declarations (all globals at top, per rule 5)
$ErrorActionPreference = 'Stop'
$SCRIPT_INDEX     = '[Step20-TtsOffline]'
$resolvedPython   = $null
$modelDir         = Join-Path $env:USERPROFILE '.core_node\cache\tts\sherpa'
# int8-quantized Kokoro (zh/en) — smaller/faster download than the full model, so
# the one-time fetch is more likely to complete in a single startup.
$modelUrl         = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-int8-multi-lang-v1_1.tar.bz2'
$modelArchive     = $null
$tmpExtract       = $null

function Resolve-PythonInterpreter {
    param([string]$Preferred = '')
    if ($Preferred -and (Test-Path $Preferred)) {
        try { $v = & $Preferred --version 2>&1; if ($LASTEXITCODE -eq 0 -and "$v" -match 'Python\s+3') { return $Preferred } } catch { }
    }
    $candidates = New-Object System.Collections.Generic.List[string]
    foreach ($name in 'python', 'python3', 'py') {
        Get-Command $name -All -ErrorAction SilentlyContinue | ForEach-Object {
            if ($_.Source -and $_.Source -notmatch 'WindowsApps') { $candidates.Add($_.Source) }
        }
    }
    foreach ($p in @(
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313\python.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python311\python.exe'),
        'C:\Python313\python.exe', 'C:\Python312\python.exe', 'C:\Python311\python.exe'
    )) { $candidates.Add($p) }
    foreach ($c in $candidates) {
        if ($c -and (Test-Path $c)) {
            try { $v = & $c --version 2>&1; if ($LASTEXITCODE -eq 0 -and "$v" -match 'Python\s+3') { return $c } } catch { }
        }
    }
    return $null
}

function Test-PyModule {
    param([string]$Py, [string]$Module)
    $code = "import importlib.util, sys`ntry:`n    ok = importlib.util.find_spec('$Module') is not None`nexcept Exception:`n    ok = False`nsys.exit(0 if ok else 1)"
    & $Py -c $code 2>$null
    return ($LASTEXITCODE -eq 0)
}

# Extract $Archive (.tar.bz2) into $ModelDir and write $Sentinel on success.
# Uses PYTHON's tarfile (Windows tar.exe cannot decompress .bz2 — it shells out
# to a missing `bzip2 -d`). Returns $true only when a model .onnx landed. This is
# the idempotent EXTRACT step: callable on a cached archive WITHOUT downloading.
function Install-SherpaModel {
    param([string]$Py, [string]$Archive, [string]$Tmp, [string]$ModelDir, [string]$Sentinel, [string]$Url, [string]$Idx)
    if (-not (Test-Path $Archive)) { return $false }
    if (Test-Path $Tmp) { Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue }
    New-Item -ItemType Directory -Force -Path $Tmp | Out-Null
    Write-Host ("$Idx [..] Extracting {0} -> {1} (python tarfile)" -f $Archive, $Tmp) -ForegroundColor Yellow
    $pyExtract = "import tarfile,sys`nt=tarfile.open(sys.argv[1],'r:bz2')`nt.extractall(sys.argv[2])`nt.close()"
    & $Py -c $pyExtract $Archive $Tmp
    $extractOk = ($LASTEXITCODE -eq 0)
    $installed = $false
    if ($extractOk) {
        $inner = Get-ChildItem -Path $Tmp -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
        $src = if ($inner) { $inner.FullName } else { $Tmp }
        Write-Host ("$Idx [..] Installing {0}\* -> {1}" -f $src, $ModelDir) -ForegroundColor Yellow
        Copy-Item -Path (Join-Path $src '*') -Destination $ModelDir -Recurse -Force
        $verify = Get-ChildItem -Path $ModelDir -Recurse -Filter '*.onnx' -File -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($verify) {
            Set-Content -Path $Sentinel -Value $Url -Encoding utf8
            Write-Host ("$Idx [OK] Model installed: {0}" -f $verify.FullName) -ForegroundColor Green
            Write-Host ("$Idx      sentinel written: {0}; cached archive KEPT at {1} for reuse." -f $Sentinel, $Archive) -ForegroundColor DarkGray
            $installed = $true
        } else {
            Write-Host "$Idx [!] Extract produced no .onnx (archive may be partial)." -ForegroundColor DarkYellow
        }
    } else {
        Write-Host "$Idx [!] Extract failed (archive incomplete/invalid)." -ForegroundColor DarkYellow
    }
    Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
    return $installed
}

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX Installing offline TTS engines (sherpa-onnx + model)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

$resolvedPython = Resolve-PythonInterpreter -Preferred $Python
if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [X] Python 3 was NOT found. Run Step9_InstallPython first, or pass -Python <path>." -ForegroundColor Red
    exit 1
}
Write-Host ("$SCRIPT_INDEX python : {0}" -f $resolvedPython) -ForegroundColor DarkGray

# --- 1) sherpa-onnx (pure pip, no system deps) --------------------------- #
if ((Test-PyModule -Py $resolvedPython -Module 'sherpa_onnx') -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [OK] sherpa-onnx already installed; skipping pip." -ForegroundColor Green
} else {
    Write-Host "$SCRIPT_INDEX [..] pip install --upgrade sherpa-onnx ..." -ForegroundColor Yellow
    try { & $resolvedPython -m pip install --upgrade sherpa-onnx; $rc = $LASTEXITCODE } catch { $rc = 1 }
    if ($rc -eq 0 -and (Test-PyModule -Py $resolvedPython -Module 'sherpa_onnx')) {
        Write-Host "$SCRIPT_INDEX [OK] sherpa-onnx installed." -ForegroundColor Green
    } else {
        Write-Host "$SCRIPT_INDEX [!] sherpa-onnx install failed; offline TTS will fall back to edge/ai." -ForegroundColor DarkYellow
    }
}

# --- 2) Kokoro multi-lang (zh/en) model into the model dir --------------- #
# IDEMPOTENT: skip when a model .onnx already exists ANYWHERE under the model
# dir (recursive) AND the completion sentinel is present. A partial/failed
# download leaves no sentinel, so it retries; a completed one is never
# re-downloaded.
$modelSentinel = Join-Path $modelDir '.model_installed'
$modelArchive  = Join-Path $modelDir '.download.tar.bz2'   # stable, resume-able
$tmpExtract    = Join-Path $env:TEMP 'sherpa-tts-extract'
$existingOnnx  = $null
if (Test-Path $modelDir) {
    $existingOnnx = Get-ChildItem -Path $modelDir -Recurse -Filter '*.onnx' -File -ErrorAction SilentlyContinue | Select-Object -First 1
}

# --- Verbose path / state report (so it's clear what goes where) --------- #
Write-Host ("$SCRIPT_INDEX  model dir   : {0}" -f $modelDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  sentinel    : {0} ({1})" -f $modelSentinel, $(if (Test-Path $modelSentinel) { 'present' } else { 'absent' })) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  model .onnx : {0}" -f $(if ($existingOnnx) { $existingOnnx.FullName } else { 'none yet' })) -ForegroundColor DarkGray
if (Test-Path $modelArchive) {
    $partialMB = [math]::Round((Get-Item $modelArchive).Length / 1MB, 1)
    Write-Host ("$SCRIPT_INDEX  prev dload  : {0} ({1} MB partial -> will RESUME)" -f $modelArchive, $partialMB) -ForegroundColor DarkGray
} else {
    Write-Host ("$SCRIPT_INDEX  prev dload  : none (fresh download to {0})" -f $modelArchive) -ForegroundColor DarkGray
}
Write-Host ("$SCRIPT_INDEX  source url  : {0}" -f $modelUrl) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  extract tmp : {0}" -f $tmpExtract) -ForegroundColor DarkGray

# STEP-IDEMPOTENT, in order (each step skips work already done):
#   1. model + sentinel present     -> skip everything.
#   2. cached .bz2 present           -> EXTRACT it (no download). "有了就用bz2".
#   3. archive missing/partial       -> RESUME download, then extract.
# The .bz2 is KEPT after a successful extract so a wiped model dir re-extracts
# without re-downloading.
if ($existingOnnx -and (Test-Path $modelSentinel) -and -not $Force) {
    Write-Host ("$SCRIPT_INDEX [OK] STEP1 model present ({0}) + sentinel -> skipping (no download, no extract)." -f $existingOnnx.Name) -ForegroundColor Green
} else {
    New-Item -ItemType Directory -Force -Path $modelDir | Out-Null
    $installed = $false

    # STEP 2: reuse a cached archive WITHOUT downloading.
    if (Test-Path $modelArchive) {
        Write-Host "$SCRIPT_INDEX [..] STEP2 cached archive found -> extracting it (no download)." -ForegroundColor Yellow
        $installed = Install-SherpaModel -Py $resolvedPython -Archive $modelArchive -Tmp $tmpExtract -ModelDir $modelDir -Sentinel $modelSentinel -Url $modelUrl -Idx $SCRIPT_INDEX
        if (-not $installed) {
            Write-Host "$SCRIPT_INDEX [!] Cached archive is partial/invalid -> will RESUME the download next." -ForegroundColor DarkYellow
        }
    }

    # STEP 3: download (resume the partial) then extract.
    if (-not $installed) {
        $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
        Write-Host ("$SCRIPT_INDEX [..] STEP3 downloading (resumable) {0} -> {1}" -f $modelUrl, $modelArchive) -ForegroundColor Yellow
        try {
            $downloaded = $false
            if ($curl) {
                # -C - resumes the partial; curl's progress goes to STDERR which,
                # under -EA Stop, becomes a terminating error -> silence it and
                # relax EAP around the native call. 0=ok, 33=already complete.
                $prevEAP = $ErrorActionPreference
                $ErrorActionPreference = 'Continue'
                & curl.exe -L -C - --retry 3 --connect-timeout 30 --no-progress-meter -o $modelArchive $modelUrl 2>$null
                $rc = $LASTEXITCODE
                $ErrorActionPreference = $prevEAP
                $downloaded = ($rc -eq 0 -or $rc -eq 33)
            } else {
                $ProgressPreference = 'SilentlyContinue'
                Invoke-WebRequest -Uri $modelUrl -OutFile $modelArchive -UseBasicParsing -ErrorAction Stop
                $downloaded = $true
            }
            $archMB = if (Test-Path $modelArchive) { [math]::Round((Get-Item $modelArchive).Length / 1MB, 1) } else { 0 }
            Write-Host ("$SCRIPT_INDEX  archive now : {0} ({1} MB)" -f $modelArchive, $archMB) -ForegroundColor DarkGray

            if (-not $downloaded) {
                Write-Host "$SCRIPT_INDEX [!] Download incomplete; partial archive KEPT and will RESUME next boot. edge/ai TTS still work." -ForegroundColor DarkYellow
            } else {
                $installed = Install-SherpaModel -Py $resolvedPython -Archive $modelArchive -Tmp $tmpExtract -ModelDir $modelDir -Sentinel $modelSentinel -Url $modelUrl -Idx $SCRIPT_INDEX
                if (-not $installed) {
                    Write-Host "$SCRIPT_INDEX [!] Archive incomplete after download; KEPT to RESUME next boot." -ForegroundColor DarkYellow
                }
            }
        } catch {
            Write-Host ("$SCRIPT_INDEX [!] Model download error: {0}" -f $_.Exception.Message) -ForegroundColor DarkYellow
            Write-Host ("$SCRIPT_INDEX [!] Partial archive KEPT at {0} for resume; edge/ai TTS still work." -f $modelArchive) -ForegroundColor DarkYellow
        }
    }
}

# --- 3) MeloTTS (OPT-IN; transformers==4.27.4 can clash with shared env) -- #
if ($Melotts -and (Test-PyModule -Py $resolvedPython -Module 'melo') -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [OK] MeloTTS already installed; skipping." -ForegroundColor Green
} elseif ($Melotts) {
    Write-Host "$SCRIPT_INDEX [..] (opt-in) pip install MeloTTS + unidic-lite ..." -ForegroundColor Yellow
    Write-Host "$SCRIPT_INDEX [!] MeloTTS pins transformers==4.27.4 which may downgrade the shared env." -ForegroundColor DarkYellow
    try {
        & $resolvedPython -m pip install 'unidic-lite'
        & $resolvedPython -m pip install 'git+https://github.com/myshell-ai/MeloTTS.git'
        if (Test-PyModule -Py $resolvedPython -Module 'melo') {
            Write-Host "$SCRIPT_INDEX [OK] MeloTTS installed." -ForegroundColor Green
        } else {
            Write-Host "$SCRIPT_INDEX [!] MeloTTS not importable after install." -ForegroundColor DarkYellow
        }
    } catch {
        Write-Host ("$SCRIPT_INDEX [!] MeloTTS install failed: {0}" -f $_.Exception.Message) -ForegroundColor DarkYellow
    }
} else {
    Write-Host "$SCRIPT_INDEX [i] MeloTTS skipped (pass -Melotts to install; GPT-SoVITS is manual, see docs)." -ForegroundColor DarkGray
}

exit 0
