# Enable error handling to continue on errors
$ErrorActionPreference = "SilentlyContinue"

# Define the target backup directory
$TargetDir = "D:\CDriveRedirect"

# Ensure the target directory exists
if (!(Test-Path -Path $TargetDir)) {
    New-Item -Path $TargetDir -ItemType Directory | Out-Null
}

# List of system directories to move
$Dirs = @(
    "C:\ProgramData\Adobe",
    "C:\Program Files (x86)",
    "C:\Program Files",
    "C:\Microsoft"
)

# Function to copy directories while skipping existing files
function Copy-Folder {
    param (
        [string]$Source,
        [string]$Destination
    )

    if (!(Test-Path -Path $Source)) {
        Write-Host "Skipping (not found): $Source" -ForegroundColor Yellow
        return
    }

    if (!(Test-Path -Path $Destination)) {
        New-Item -Path $Destination -ItemType Directory | Out-Null
    }

    Write-Host "Copying $Source to $Destination..."
    robocopy "$Source" "$Destination" /E /XO /XC /XN /NP /NFL /NDL | Out-Null
}

# Function to replace original directory with a symbolic link
function Replace-With-Symlink {
    param (
        [string]$Source,
        [string]$Destination
    )

    if (Test-Path -Path $Source) {
        Write-Host "Removing original: $Source"
        Remove-Item -Path $Source -Recurse -Force -ErrorAction SilentlyContinue
    }

    Write-Host "Creating symbolic link: $Source -> $Destination"
    New-Item -ItemType SymbolicLink -Path $Source -Target $Destination | Out-Null
}

# Loop through each directory
foreach ($Dir in $Dirs) {
    $BackupPath = Join-Path -Path $TargetDir -ChildPath (Split-Path -Leaf $Dir)
    Copy-Folder -Source $Dir -Destination $BackupPath
    Replace-With-Symlink -Source $Dir -Destination $BackupPath
}

Write-Host "All operations completed successfully!" -ForegroundColor Green
