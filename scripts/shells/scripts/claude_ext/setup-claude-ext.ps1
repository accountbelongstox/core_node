# Claude Code Extension - Auto Setup Script (ES6 Compatible)
# Automatically finds Claude installation, beautifies CLI, and injects monitoring

param(
    [switch]$Force,
    [switch]$Help
)

if ($Help) {
    Write-Host "Claude Code Extension - Auto Setup Script"
    Write-Host ""
    Write-Host "Usage:"
    Write-Host "  .\setup-claude-ext.ps1        # Auto setup"
    Write-Host "  .\setup-claude-ext.ps1 -Force # Force re-setup"
    Write-Host ""
    Write-Host "This script will:"
    Write-Host "  1. Find claude.ps1 globally"
    Write-Host "  2. Extract cli.js path"
    Write-Host "  3. Beautify cli.js if needed"
    Write-Host "  4. Inject monitoring code (ES6 compatible)"
    Write-Host "  5. Create claudeMore.ps1 launcher"
    Write-Host ""
    exit 0
}

# Color functions
function Write-Success { param([string]$Message); Write-Host $Message -ForegroundColor Green }
function Write-Error-Custom { param([string]$Message); Write-Host $Message -ForegroundColor Red }
function Write-Info { param([string]$Message); Write-Host $Message -ForegroundColor Cyan }
function Write-Warning-Custom { param([string]$Message); Write-Host $Message -ForegroundColor Yellow }

Write-Info "========================================"
Write-Info "  Claude Extension - Auto Setup"
Write-Info "========================================"
Write-Host ""

# Step 1: Find claude.ps1
Write-Info "Step 1: Searching for claude.ps1..."

# Try known location first
$claudePath = $null
$knownPath = "D:\.dev_win11\node\claude.ps1"

if (Test-Path $knownPath) {
    $claudePath = $knownPath
    Write-Success "Found: $claudePath"
} else {
    # Search in PATH
    Write-Info "Searching in PATH directories..."
    $pathDirs = $env:PATH -split ";"
    foreach ($dir in $pathDirs) {
        if ($dir -and (Test-Path $dir)) {
            $found = Get-ChildItem -Path $dir -Filter "claude.ps1" -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($found) {
                $claudePath = $found.FullName
                Write-Success "Found: $claudePath"
                break
            }
        }
    }
}

if (-not $claudePath) {
    Write-Error-Custom "ERROR: claude.ps1 not found!"
    Write-Info "Please ensure Claude Code is installed globally"
    exit 1
}

# Step 2: Extract cli.js path
Write-Host ""
Write-Info "Step 2: Analyzing claude.ps1..."

$claudeContent = Get-Content $claudePath -Raw

if ($claudeContent -match 'node_modules/[@\w\-./]+/cli\.js') {
    $cliRelativePath = $matches[0]
    Write-Success "CLI path found: $cliRelativePath"
} else {
    Write-Error-Custom "ERROR: Could not find cli.js path in claude.ps1"
    exit 1
}

# Step 3: Get full paths
$nodeDir = Split-Path $claudePath -Parent
$cliPath = Join-Path $nodeDir $cliRelativePath
$cliDir = Split-Path $cliPath -Parent
$extDir = Join-Path $cliDir "claude-ext"

Write-Info "Node directory: $nodeDir"
Write-Info "CLI directory: $cliDir"
Write-Info "Extension directory: $extDir"

if (-not (Test-Path $cliPath)) {
    Write-Error-Custom "ERROR: cli.js not found at $cliPath"
    exit 1
}

# Step 4: Create extension directory
Write-Host ""
Write-Info "Step 4: Creating extension directory..."

if (-not (Test-Path $extDir)) {
    New-Item -ItemType Directory -Path $extDir -Force | Out-Null
    Write-Success "Created: $extDir"
} else {
    Write-Success "Directory exists: $extDir"
}

# Step 5: Create input capture library (ES6 module)
Write-Host ""
Write-Info "Step 5: Creating input-capture.mjs library..."

$captureLibPath = Join-Path $extDir "input-capture.mjs"

if ((Test-Path $captureLibPath) -and -not $Force) {
    Write-Success "input-capture.mjs already exists"
} else {
    Write-Info "Creating input-capture.mjs..."

    $captureCode = @'
// Claude Input Capture Library (ES6 Module)
// Captures submit and onchange events in real-time

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class InputCapture {
    constructor() {
        // Generate unique session ID
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        this.sessionId = `input-${timestamp}`;

        // Create log directory
        this.logDir = path.join(__dirname, 'input-logs');
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }

        // Create log file
        this.logFile = path.join(this.logDir, `${this.sessionId}.log`);

        // Initialize log file
        this.writeLog('='.repeat(60));
        this.writeLog(`Session started: ${new Date().toISOString()}`);
        this.writeLog('='.repeat(60));

        console.log(`[InputCapture] Logging to: ${this.logFile}`);
    }

    writeLog(message) {
        try {
            fs.appendFileSync(this.logFile, message + '\n', 'utf8');
        } catch (e) {
            console.error('[InputCapture] Write error:', e);
        }
    }

    captureSubmit(input, metadata = {}) {
        const timestamp = new Date().toISOString();

        this.writeLog('');
        this.writeLog(`[${timestamp}] SUBMIT`);
        this.writeLog(`Input: ${input}`);
        this.writeLog(`Length: ${input.length} characters`);

        if (Object.keys(metadata).length > 0) {
            this.writeLog(`Metadata: ${JSON.stringify(metadata)}`);
        }

        this.writeLog('-'.repeat(60));
    }

    captureChange(input, metadata = {}) {
        const timestamp = new Date().toISOString();

        this.writeLog('');
        this.writeLog(`[${timestamp}] CHANGE`);
        this.writeLog(`Input: ${input}`);
        this.writeLog(`Length: ${input.length} characters`);

        if (Object.keys(metadata).length > 0) {
            this.writeLog(`Metadata: ${JSON.stringify(metadata)}`);
        }
    }

    getLogPath() {
        return this.logFile;
    }
}

// Export singleton instance
let captureInstance = null;

function getCapture() {
    if (!captureInstance) {
        captureInstance = new InputCapture();
    }
    return captureInstance;
}

export default {
    captureSubmit: (input, metadata) => getCapture().captureSubmit(input, metadata),
    captureChange: (input, metadata) => getCapture().captureChange(input, metadata),
    getLogPath: () => getCapture().getLogPath()
};
'@

    Set-Content -Path $captureLibPath -Value $captureCode -Encoding UTF8
    Write-Success "Created input-capture.mjs"
}

# Step 6: Beautify CLI if needed
Write-Host ""
Write-Info "Step 6: Checking for beautified CLI..."

$beautifiedPath = Join-Path $cliDir "cli.beautified.js"

if ((Test-Path $beautifiedPath) -and -not $Force) {
    $fileSize = (Get-Item $beautifiedPath).Length / 1MB
    Write-Success "cli.beautified.js already exists ($([math]::Round($fileSize, 1)) MB)"
} else {
    Write-Info "Beautifying cli.js (this may take 1-2 minutes)..."
    Write-Warning-Custom "Note: If beautification fails, you can manually run:"
    Write-Host "  npx js-beautify --indent-size 2 --file `"$cliPath`" --outfile `"$beautifiedPath`""

    try {
        $beautifyArgs = @(
            "js-beautify",
            "--indent-size", "2",
            "--indent-with-tabs", "false",
            "--preserve-newlines", "true",
            "--max-preserve-newlines", "2",
            "--jslint-happy", "false",
            "--space-after-anon-function", "true",
            "--brace-style", "collapse",
            "--keep-array-indentation", "false",
            "--keep-function-indentation", "false",
            "--space-before-conditional", "true",
            "--unescape-strings", "false",
            "--wrap-line-length", "120",
            "--end-with-newline", "true",
            "--file", $cliPath,
            "--outfile", $beautifiedPath
        )

        $process = Start-Process -FilePath "npx" -ArgumentList $beautifyArgs -Wait -NoNewWindow -PassThru -ErrorAction Stop

        if ($process.ExitCode -eq 0 -and (Test-Path $beautifiedPath)) {
            $fileSize = (Get-Item $beautifiedPath).Length / 1MB
            Write-Success "Created cli.beautified.js ($([math]::Round($fileSize, 1)) MB)"
        } else {
            throw "Beautification process failed with exit code $($process.ExitCode)"
        }
    } catch {
        Write-Error-Custom "ERROR: Beautification failed: $($_.Exception.Message)"
        Write-Info ""
        Write-Info "You can try manually beautifying with:"
        Write-Host "  npx js-beautify --indent-size 2 --file `"$cliPath`" --outfile `"$beautifiedPath`"" -ForegroundColor Yellow
        Write-Info ""
        Write-Info "Or if cli.beautified.js already exists elsewhere, copy it to:"
        Write-Host "  $beautifiedPath" -ForegroundColor Yellow
        exit 1
    }
}

# Step 7: Inject monitoring code
Write-Host ""
Write-Info "Step 7: Injecting monitoring code into cli.beautified.js..."

$beautifiedContent = Get-Content $beautifiedPath -Raw

# Check if already injected
if ($beautifiedContent -match '// CLAUDE-EXT: INJECTED') {
    if ($Force) {
        Write-Warning-Custom "Re-injecting (Force mode)..."
        # Remove old injection and backup
        if (Test-Path "$beautifiedPath.backup") {
            Copy-Item "$beautifiedPath.backup" $beautifiedPath -Force
            $beautifiedContent = Get-Content $beautifiedPath -Raw
        }
    } else {
        Write-Success "Already injected"
        Write-Info "Use -Force to re-inject"
        $injectedSubmit = $true
        $injectedChange = $true
    }
}

if (-not ($beautifiedContent -match '// CLAUDE-EXT: INJECTED')) {
    Write-Info "Searching for injection points..."

    # Create backup
    $backupPath = "$beautifiedPath.backup"
    if (-not (Test-Path $backupPath)) {
        Copy-Item $beautifiedPath $backupPath -Force
        Write-Success "Backup created"
    }

    # Injection header (ES6 compatible with dynamic import)
    $injectionHeader = @'
// CLAUDE-EXT: INJECTED
let __inputCapture = null;
(async () => {
  try {
    const module = await import('./claude-ext/input-capture.mjs');
    __inputCapture = module.default || module;
  } catch (e) {
    console.error('[CLAUDE-EXT] Failed to load input-capture:', e);
  }
})();

'@

    # Process file line by line
    Write-Info "Processing (this may take 30-60 seconds)..."

    $tempFile = "$beautifiedPath.tmp"
    $reader = [System.IO.StreamReader]::new($beautifiedPath)
    $writer = [System.IO.StreamWriter]::new($tempFile, $false, [System.Text.Encoding]::UTF8)

    $lineNum = 0
    $injectedHeader = $false
    $injectedSubmit = $false
    $injectedChange = $false

    try {
        while ($null -ne ($line = $reader.ReadLine())) {
            $lineNum++

            # Progress indicator
            if ($lineNum % 10000 -eq 0) {
                Write-Progress -Activity "Injecting" -Status "Line $lineNum..." -PercentComplete ([math]::Min(99, ($lineNum / 420000) * 100))
            }

            # Inject header at line 10
            if (-not $injectedHeader -and $lineNum -eq 10) {
                $writer.WriteLine($injectionHeader)
                $injectedHeader = $true
            }

            # Write current line
            $writer.WriteLine($line)

            # Check for submit injection point
            if (-not $injectedSubmit -and $line -match 'if \(uA\.suggestions\.length > 0') {
                $nextLine = $reader.ReadLine()
                $lineNum++

                if ($nextLine -notmatch '__inputCapture\.captureSubmit') {
                    $writer.WriteLine('    try { if (__inputCapture?.captureSubmit) __inputCapture.captureSubmit(x2, { source: "submit" }); } catch(e) {}')
                    $injectedSubmit = $true
                }

                $writer.WriteLine($nextLine)
            }

            # Check for change injection point
            if (-not $injectedChange -and $line -match 'if \(K !== F0\)') {
                $nextLine = $reader.ReadLine()
                $lineNum++

                if ($nextLine -notmatch '__inputCapture\.captureChange') {
                    $writer.WriteLine('    try { if (__inputCapture?.captureChange) __inputCapture.captureChange(F0, { source: "onchange" }); } catch(e) {}')
                    $injectedChange = $true
                }

                $writer.WriteLine($nextLine)
            }
        }

        Write-Progress -Activity "Injecting" -Completed

    } finally {
        $reader.Close()
        $writer.Close()
    }

    # Replace original with modified
    Move-Item $tempFile $beautifiedPath -Force

    if ($injectedSubmit -and $injectedChange) {
        Write-Success "Injection successful!"
        Write-Success "  - Header injected at line 10"
        Write-Success "  - Submit capture injected"
        Write-Success "  - Change capture injected"
    } else {
        Write-Warning-Custom "Partial injection:"
        Write-Warning-Custom "  - Submit: $injectedSubmit"
        Write-Warning-Custom "  - Change: $injectedChange"
    }
}

# Step 8: Create claudeMore.ps1 launcher
Write-Host ""
Write-Info "Step 8: Creating claudeMore.ps1 launcher..."

$claudeMorePath = Join-Path $nodeDir "claudeMore.ps1"

if ((Test-Path $claudeMorePath) -and -not $Force) {
    Write-Success "claudeMore.ps1 already exists"
} else {
    # Read original claude.ps1
    $claudeOriginal = Get-Content $claudePath -Raw

    # Replace cli.js with cli.beautified.js
    $claudeMore = $claudeOriginal -replace '/cli\.js"', '/cli.beautified.js"'

    # Write claudeMore.ps1
    Set-Content -Path $claudeMorePath -Value $claudeMore -Encoding UTF8
    Write-Success "Created: $claudeMorePath"
}

# Final summary
Write-Host ""
Write-Info "========================================"
Write-Success "Setup Complete!"
Write-Info "========================================"
Write-Host ""
Write-Info "Next steps:"
Write-Host "  1. Use 'claudeMore' instead of 'claude' command"
Write-Host "  2. Input logs will be saved in:"
Write-Host "     $extDir\input-logs\"
Write-Host ""
Write-Info "To verify:"
Write-Host "  .\verify-installation.ps1"
Write-Host ""
