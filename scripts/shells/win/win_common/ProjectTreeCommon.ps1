<#
.SYNOPSIS
    Per-project heavy directory links (node_modules, vendor, .venv) from the repo to the E: program drive tree root.
#>

#region Variable Declarations
$script:PROJECT_TREE_JUNCTION_TAG = [uint32]'0xA0000003'
$script:PROJECT_TREE_MARKER_NAME = '.cn_link'
$script:PROJECT_TREE_INTERIX_HEADER = 'IntxLNK'
$script:PROJECT_TREE_NT_PREFIX = '\??\'
$script:PROJECT_TREE_CMD_EXE = Join-Path (Join-Path $env:SystemRoot 'System32') 'cmd.exe'
$script:PROJECT_TREE_REPARSE_SOURCE = @'
using System;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;

public static class CoreNodeReparsePoint
{
    private const uint FILE_READ_ATTRIBUTES = 0x80;
    private const uint FILE_SHARE_ALL = 0x7;
    private const uint OPEN_EXISTING = 3;
    private const uint FILE_FLAG_BACKUP_SEMANTICS = 0x02000000;
    private const uint FILE_FLAG_OPEN_REPARSE_POINT = 0x00200000;
    private const uint FSCTL_GET_REPARSE_POINT = 0x000900A8;
    private const uint IO_REPARSE_TAG_MOUNT_POINT = 0xA0000003;
    private const uint IO_REPARSE_TAG_SYMLINK = 0xA000000C;

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle CreateFileW(string name, uint access, uint share, IntPtr security, uint disposition, uint flags, IntPtr template);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool DeviceIoControl(SafeFileHandle handle, uint code, IntPtr inBuffer, uint inSize, byte[] outBuffer, uint outSize, out uint returned, IntPtr overlapped);

    public static string[] Read(string path)
    {
        using (SafeFileHandle handle = CreateFileW(path, FILE_READ_ATTRIBUTES, FILE_SHARE_ALL, IntPtr.Zero, OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, IntPtr.Zero))
        {
            if (handle.IsInvalid)
            {
                throw new Win32Exception(Marshal.GetLastWin32Error());
            }
            byte[] buffer = new byte[16384];
            uint returned;
            if (!DeviceIoControl(handle, FSCTL_GET_REPARSE_POINT, IntPtr.Zero, 0, buffer, (uint)buffer.Length, out returned, IntPtr.Zero))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error());
            }
            uint tag = BitConverter.ToUInt32(buffer, 0);
            string substituteName = string.Empty;
            string printName = string.Empty;
            if (tag == IO_REPARSE_TAG_MOUNT_POINT || tag == IO_REPARSE_TAG_SYMLINK)
            {
                int pathBufferOffset = tag == IO_REPARSE_TAG_SYMLINK ? 20 : 16;
                int substituteOffset = BitConverter.ToUInt16(buffer, 8);
                int substituteLength = BitConverter.ToUInt16(buffer, 10);
                int printOffset = BitConverter.ToUInt16(buffer, 12);
                int printLength = BitConverter.ToUInt16(buffer, 14);
                substituteName = Encoding.Unicode.GetString(buffer, pathBufferOffset + substituteOffset, substituteLength);
                printName = Encoding.Unicode.GetString(buffer, pathBufferOffset + printOffset, printLength);
            }
            return new string[] { tag.ToString("X8"), substituteName, printName };
        }
    }
}
'@
#endregion

#region Reparse Points
function Initialize-ProjectTreeReparseReader {
    if (-not ('CoreNodeReparsePoint' -as [type])) {
        Add-Type -TypeDefinition $script:PROJECT_TREE_REPARSE_SOURCE -Language CSharp
    }
}

function Get-ProjectTreeLinkState {
    param(
        [Parameter(Mandatory = $true)] [string]$LinkPath
    )

    $attributes = $null
    try {
        $attributes = [System.IO.File]::GetAttributes($LinkPath)
    } catch [System.IO.FileNotFoundException], [System.IO.DirectoryNotFoundException] {
        return [PSCustomObject]@{ Kind = 'Missing'; Tag = $null; SubstituteName = $null; PrintName = $null }
    }

    $isDirectory = [bool]($attributes -band [System.IO.FileAttributes]::Directory)
    if ($attributes -band [System.IO.FileAttributes]::ReparsePoint) {
        Initialize-ProjectTreeReparseReader
        $reparse = [CoreNodeReparsePoint]::Read($LinkPath)
        return [PSCustomObject]@{
            Kind           = $(if ($isDirectory) { 'LinkDirectory' } else { 'LinkFile' })
            Tag            = [Convert]::ToUInt32($reparse[0], 16)
            SubstituteName = $reparse[1]
            PrintName      = $reparse[2]
        }
    }
    if ($isDirectory) {
        $hasContent = [bool](@([System.IO.Directory]::EnumerateFileSystemEntries($LinkPath) | Select-Object -First 1).Count)
        return [PSCustomObject]@{ Kind = $(if ($hasContent) { 'DirectoryWithContent' } else { 'EmptyDirectory' }); Tag = $null; SubstituteName = $null; PrintName = $null }
    }
    return [PSCustomObject]@{ Kind = 'File'; Tag = $null; SubstituteName = $null; PrintName = $null }
}

function Test-ProjectTreeInterixLink {
    param(
        [Parameter(Mandatory = $true)] [string]$LinkPath
    )

    $attributes = [System.IO.File]::GetAttributes($LinkPath)
    if (-not ($attributes -band [System.IO.FileAttributes]::System)) {
        return $false
    }
    $header = New-Object byte[] ($script:PROJECT_TREE_INTERIX_HEADER.Length)
    $stream = [System.IO.File]::OpenRead($LinkPath)
    try {
        $read = $stream.Read($header, 0, $header.Length)
    } finally {
        $stream.Dispose()
    }
    return ($read -eq $header.Length) -and ([System.Text.Encoding]::ASCII.GetString($header) -eq $script:PROJECT_TREE_INTERIX_HEADER)
}

function Test-ProjectTreeJunctionTarget {
    param(
        [Parameter(Mandatory = $true)] [PSCustomObject]$State,
        [Parameter(Mandatory = $true)] [string]$TargetPath
    )

    if ($State.Kind -ne 'LinkDirectory' -or $State.Tag -ne $script:PROJECT_TREE_JUNCTION_TAG) {
        return $false
    }
    $expected = ('{0}{1}' -f $script:PROJECT_TREE_NT_PREFIX, $TargetPath).TrimEnd('\')
    return ($State.SubstituteName.TrimEnd('\') -ieq $expected) -and (-not [string]::IsNullOrEmpty($State.PrintName))
}

function Remove-ProjectTreeLinkOnly {
    param(
        [Parameter(Mandatory = $true)] [string]$LinkPath,
        [Parameter(Mandatory = $true)] [PSCustomObject]$State
    )

    if ($State.Kind -eq 'LinkDirectory') {
        [System.IO.Directory]::Delete($LinkPath)
    } else {
        [System.IO.File]::Delete($LinkPath)
    }
}
#endregion

#region Namespaces
function Get-ProjectTreeNamespace {
    param(
        [Parameter(Mandatory = $true)] [string]$RepoRoot,
        [Parameter(Mandatory = $true)] [string]$ProjectDir
    )

    $repoFull = [System.IO.Path]::GetFullPath($RepoRoot).TrimEnd('\')
    $projectFull = [System.IO.Path]::GetFullPath($ProjectDir).TrimEnd('\')
    if ($projectFull -ieq $repoFull) {
        return 'root'
    }
    if (-not $projectFull.StartsWith(('{0}\' -f $repoFull), [System.StringComparison]::OrdinalIgnoreCase)) {
        throw ('Project directory is outside the repository: {0}' -f $projectFull)
    }
    return $projectFull.Substring($repoFull.Length + 1).Replace('\', '__').ToLowerInvariant()
}
#endregion

#region Ensure
function Set-ProjectTreeJunction {
    param(
        [Parameter(Mandatory = $true)] [string]$LinkPath,
        [Parameter(Mandatory = $true)] [string]$TargetPath
    )

    $markerPath = Join-Path $TargetPath $script:PROJECT_TREE_MARKER_NAME
    # The namespace root (e.g. E:\_win10_dev) and every directory below
    # it are created through the one shared helper (SharedCacheEnv.ps1
    # New-CnNamespaceDirectory), per DIRECTORY_NAMESPACE_RULES.md #2.
    New-CnNamespaceDirectory -Path $TargetPath
    if (-not [System.IO.File]::Exists($markerPath)) {
        [System.IO.File]::WriteAllText($markerPath, $LinkPath)
    }
    & $script:PROJECT_TREE_CMD_EXE /d /c 'mklink' '/J' $LinkPath $TargetPath | Out-Null
    $state = Get-ProjectTreeLinkState -LinkPath $LinkPath
    if (-not (Test-ProjectTreeJunctionTarget -State $state -TargetPath $TargetPath)) {
        throw ('Junction verification failed: {0} -> {1}' -f $LinkPath, $TargetPath)
    }
    if (-not [System.IO.File]::Exists((Join-Path $LinkPath $script:PROJECT_TREE_MARKER_NAME))) {
        throw ('Junction target is not reachable through the link: {0}' -f $LinkPath)
    }
}

function Invoke-ProjectTreeLink {
    param(
        [Parameter(Mandatory = $true)] [string]$LinkPath,
        [Parameter(Mandatory = $true)] [string]$TargetPath
    )

    $state = Get-ProjectTreeLinkState -LinkPath $LinkPath
    if (Test-ProjectTreeJunctionTarget -State $state -TargetPath $TargetPath) {
        if ([System.IO.Directory]::Exists($TargetPath)) {
            return 'Linked'
        }
        Remove-ProjectTreeLinkOnly -LinkPath $LinkPath -State $state
        $state = Get-ProjectTreeLinkState -LinkPath $LinkPath
    }

    switch ($state.Kind) {
        'LinkDirectory' {
            Remove-ProjectTreeLinkOnly -LinkPath $LinkPath -State $state
        }
        'LinkFile' {
            Remove-ProjectTreeLinkOnly -LinkPath $LinkPath -State $state
        }
        'EmptyDirectory' {
            [System.IO.Directory]::Delete($LinkPath)
        }
        'DirectoryWithContent' {
            # Linked dirs (node_modules, vendor, .venv) are regenerated by their installer:
            # never back them up (a backup copy escapes .gitignore). rmdir /s /q removes
            # inner junctions without following them.
            & $script:PROJECT_TREE_CMD_EXE /d /c 'rmdir' '/s' '/q' $LinkPath | Out-Null
            if ([System.IO.Directory]::Exists($LinkPath)) {
                throw ('Could not remove the regenerable directory before linking (close programs using it): {0}' -f $LinkPath)
            }
            Write-ColorMessage -Message ('Removed the regenerable local {0}; its installer repopulates it on the program drive.' -f $LinkPath) -Type 'Warning'
        }
        'File' {
            if (-not (Test-ProjectTreeInterixLink -LinkPath $LinkPath)) {
                Write-ColorMessage -Message ('Skipped {0}: a regular file has this name.' -f $LinkPath) -Type 'Warning'
                return 'Skipped'
            }
            [System.IO.File]::Delete($LinkPath)
        }
    }

    Set-ProjectTreeJunction -LinkPath $LinkPath -TargetPath $TargetPath
    return 'Created'
}

function Restore-ProjectTreeLocalDirectory {
    param(
        [Parameter(Mandatory = $true)] [string]$LinkPath
    )

    $state = Get-ProjectTreeLinkState -LinkPath $LinkPath
    if ($state.Kind -eq 'LinkDirectory' -or $state.Kind -eq 'LinkFile') {
        Remove-ProjectTreeLinkOnly -LinkPath $LinkPath -State $state
        return 'Unlinked'
    }
    return 'Local'
}

function Invoke-ProjectTreeLinks {
    param(
        [Parameter(Mandatory = $true)] [string]$RepoRoot,
        [Parameter(Mandatory = $true)] [string]$ProjectDir,
        [Parameter(Mandatory = $true)] [string[]]$LinkDirs,
        [Parameter()] [AllowEmptyString()] [string]$TreesRoot
    )

    # Resolved to absolute paths once, here, before anything below reads them:
    # the .NET calls this function's helpers make (GetFullPath, GetAttributes,
    # Directory.Delete/Move) resolve a relative path against
    # [Environment]::CurrentDirectory, while cmd.exe (Set-ProjectTreeJunction's
    # mklink) resolves one against this process's own working directory --
    # two different notions of "current directory" that a relative caller
    # argument would otherwise split between (AGENTS.md: resolved absolute
    # paths in PowerShell). GetUnresolvedProviderPathFromPSPath needs neither
    # path to exist yet and touches no filesystem state.
    $RepoRoot = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($RepoRoot)
    $ProjectDir = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ProjectDir)

    if (-not $PSBoundParameters.ContainsKey('TreesRoot')) {
        $TreesRoot = if (Test-Path Variable:Global:CN_TREES_ROOT) { [string]$Global:CN_TREES_ROOT } else { '' }
    }
    $namespace = Get-ProjectTreeNamespace -RepoRoot $RepoRoot -ProjectDir $ProjectDir
    $useProgramDrive = -not [string]::IsNullOrEmpty($TreesRoot)
    if (-not $useProgramDrive) {
        Write-ProgramDriveFallbackWarning
    }

    foreach ($linkDir in $LinkDirs) {
        $linkPath = Join-Path $ProjectDir $linkDir
        if ($useProgramDrive) {
            $targetPath = Join-Path (Join-Path $TreesRoot $namespace) $linkDir
            $result = Invoke-ProjectTreeLink -LinkPath $linkPath -TargetPath $targetPath
        } else {
            $result = Restore-ProjectTreeLocalDirectory -LinkPath $linkPath
        }
        [PSCustomObject]@{ Path = $linkPath; Result = $result }
    }
}
#endregion
