# SystemReferenceRelocation.ps1 - re-root absolute program paths that Windows
# keeps outside the environment (shortcuts, scheduled tasks, registry) after a
# program dir moved, e.g. D:\applications -> E:\applications. Loaded only by the
# program-drive migration (SharedCacheEnv.ps1 Invoke-CnPostSwitchRepairs); never
# part of a fresh install. Every function is idempotent and writes only values
# that change.

$script:SrrShortcutDirs = @(
    [Environment]::GetFolderPath('Desktop'),
    [Environment]::GetFolderPath('CommonDesktopDirectory'),
    [Environment]::GetFolderPath('StartMenu'),
    [Environment]::GetFolderPath('CommonStartMenu'),
    (Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch')
)
# References left on the old root by the current Move-SystemReferenceRoot call.
$script:SrrFailedCount = 0
$script:SrrRegistryRoots = @(
    @{ Hive = [Microsoft.Win32.Registry]::LocalMachine; Path = 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall' },
    @{ Hive = [Microsoft.Win32.Registry]::LocalMachine; Path = 'SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall' },
    @{ Hive = [Microsoft.Win32.Registry]::CurrentUser; Path = 'Software\Microsoft\Windows\CurrentVersion\Uninstall' },
    @{ Hive = [Microsoft.Win32.Registry]::LocalMachine; Path = 'SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths' },
    @{ Hive = [Microsoft.Win32.Registry]::CurrentUser; Path = 'Software\Microsoft\Windows\CurrentVersion\App Paths' },
    @{ Hive = [Microsoft.Win32.Registry]::LocalMachine; Path = 'SOFTWARE\Microsoft\Windows\CurrentVersion\Run' },
    @{ Hive = [Microsoft.Win32.Registry]::CurrentUser; Path = 'Software\Microsoft\Windows\CurrentVersion\Run' },
    @{ Hive = [Microsoft.Win32.Registry]::CurrentUser; Path = 'Software\Classes' },
    @{ Hive = [Microsoft.Win32.Registry]::LocalMachine; Path = 'SOFTWARE\Classes' }
)

# <Text> with every whole-path occurrence of <OldRoot> (followed by a path
# separator, quote, separator or end) replaced by <NewRoot>; case-insensitive.
function Convert-SrrRootedText {
    param(
        [string]$Text,
        [string]$OldRoot,
        [string]$NewRoot
    )
    if ([string]::IsNullOrEmpty($Text)) {
        return $Text
    }
    $pattern = [regex]::Escape($OldRoot.TrimEnd('\')) + '(?=[\\/"'';,\s]|$)'
    return [regex]::Replace($Text, $pattern, $NewRoot.TrimEnd('\').Replace('$', '$$'), [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
}

function Move-ShortcutRoot {
    param(
        [string]$OldRoot,
        [string]$NewRoot
    )
    $shell = New-Object -ComObject WScript.Shell
    $dir = ''
    $file = $null
    $link = $null
    $changed = $false
    $count = 0

    foreach ($dir in $script:SrrShortcutDirs) {
        if (-not $dir -or -not (Test-Path -LiteralPath $dir)) {
            continue
        }
        foreach ($file in @(Get-ChildItem -LiteralPath $dir -Recurse -Filter '*.lnk' -Force -ErrorAction SilentlyContinue)) {
            try {
                $link = $shell.CreateShortcut($file.FullName)
                $changed = $false
                foreach ($property in 'TargetPath', 'Arguments', 'WorkingDirectory', 'IconLocation') {
                    $updated = Convert-SrrRootedText -Text ([string]$link.$property) -OldRoot $OldRoot -NewRoot $NewRoot
                    if ($updated -cne [string]$link.$property) {
                        $link.$property = $updated
                        $changed = $true
                    }
                }
                if ($changed) {
                    $link.Save()
                    $count++
                }
            }
            catch {
                Write-Warning ('[RELOCATE] Shortcut {0} not updated: {1}' -f $file.FullName, $_.Exception.Message)
                $script:SrrFailedCount++
            }
        }
    }
    Write-Host ('[RELOCATE] {0} shortcut(s) re-rooted {1} -> {2}' -f $count, $OldRoot, $NewRoot) -ForegroundColor Green
}

function Move-ScheduledTaskRoot {
    param(
        [string]$OldRoot,
        [string]$NewRoot
    )
    $task = $null
    $action = $null
    $actions = @()
    $changed = $false
    $count = 0

    foreach ($task in @(Get-ScheduledTask -ErrorAction SilentlyContinue)) {
        $actions = @()
        $changed = $false
        foreach ($action in @($task.Actions)) {
            if (-not $action.PSObject.Properties['Execute'] -or -not $action.Execute) {
                $actions += $action
                continue
            }
            # [string] on both sides: an unset Arguments / WorkingDirectory is $null
            # on the action but '' after conversion, which is not a change.
            $originalExecute = [string]$action.Execute
            $originalArguments = [string]$action.Arguments
            $originalWorkingDirectory = [string]$action.WorkingDirectory
            $execute = Convert-SrrRootedText -Text $originalExecute -OldRoot $OldRoot -NewRoot $NewRoot
            $arguments = Convert-SrrRootedText -Text $originalArguments -OldRoot $OldRoot -NewRoot $NewRoot
            $workingDirectory = Convert-SrrRootedText -Text $originalWorkingDirectory -OldRoot $OldRoot -NewRoot $NewRoot
            if ($execute -cne $originalExecute -or $arguments -cne $originalArguments -or $workingDirectory -cne $originalWorkingDirectory) {
                $changed = $true
                $parameters = @{ Execute = $execute }
                if ($arguments) { $parameters.Argument = $arguments }
                if ($workingDirectory) { $parameters.WorkingDirectory = $workingDirectory }
                $actions += New-ScheduledTaskAction @parameters
            }
            else {
                $actions += $action
            }
        }
        if (-not $changed) {
            continue
        }
        try {
            Set-ScheduledTask -TaskName $task.TaskName -TaskPath $task.TaskPath -Action $actions -ErrorAction Stop | Out-Null
            $count++
        }
        catch {
            Write-Warning ('[RELOCATE] Task {0}{1} not updated: {2}' -f $task.TaskPath, $task.TaskName, $_.Exception.Message)
            $script:SrrFailedCount++
        }
    }
    Write-Host ('[RELOCATE] {0} scheduled task(s) re-rooted {1} -> {2}' -f $count, $OldRoot, $NewRoot) -ForegroundColor Green
}

# Updated value for one registry value, or $null when it does not hold the old
# root. String / ExpandString / MultiString only; other kinds are never touched.
function Get-SrrUpdatedRegistryValue {
    param(
        [Microsoft.Win32.RegistryValueKind]$Kind,
        $Value,
        [string]$OldRoot,
        [string]$NewRoot
    )
    $text = ''
    $updated = $null

    if ($Kind -eq [Microsoft.Win32.RegistryValueKind]::MultiString) {
        $text = @($Value) -join "`n"
        if ($text.IndexOf($OldRoot, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) { return $null }
        $updated = [string[]]@($Value | ForEach-Object { Convert-SrrRootedText -Text $_ -OldRoot $OldRoot -NewRoot $NewRoot })
        if (($updated -join "`n") -ceq $text) { return $null }
        return , $updated
    }
    if ($Kind -eq [Microsoft.Win32.RegistryValueKind]::String -or $Kind -eq [Microsoft.Win32.RegistryValueKind]::ExpandString) {
        $text = [string]$Value
        if ($text.IndexOf($OldRoot, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) { return $null }
        $updated = Convert-SrrRootedText -Text $text -OldRoot $OldRoot -NewRoot $NewRoot
        if ($updated -ceq $text) { return $null }
        return $updated
    }
    return $null
}

# Walks one registry tree read-only (no recursion limit) and opens a key for
# writing only when one of its values holds the old root. Returns the number
# of values rewritten.
function Move-SrrRegistryTreeRoot {
    param(
        [Microsoft.Win32.RegistryKey]$Hive,
        [string]$Path,
        [string]$OldRoot,
        [string]$NewRoot
    )
    $pending = New-Object System.Collections.Generic.Stack[string]
    $count = 0
    $keyPath = ''
    $key = $null
    $writable = $null
    $changes = $null
    $name = ''
    $kind = $null
    $updated = $null

    $pending.Push($Path)
    while ($pending.Count -gt 0) {
        $keyPath = $pending.Pop()
        try {
            $key = $Hive.OpenSubKey($keyPath, $false)
        }
        catch {
            $key = $null
        }
        if ($null -eq $key) {
            continue
        }
        $changes = @{}
        try {
            foreach ($name in $key.GetValueNames()) {
                try {
                    $kind = $key.GetValueKind($name)
                    $updated = Get-SrrUpdatedRegistryValue -Kind $kind -Value $key.GetValue($name, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) -OldRoot $OldRoot -NewRoot $NewRoot
                    if ($null -ne $updated) {
                        $changes[$name] = @($kind, $updated)
                    }
                }
                catch {
                    continue
                }
            }
            foreach ($name in $key.GetSubKeyNames()) {
                $pending.Push($keyPath + '\' + $name)
            }
        }
        catch {
            # Protected or vanished key: skipped, the walk goes on.
            Write-Verbose ('[RELOCATE] Registry {0}\{1} skipped: {2}' -f $Hive.Name, $keyPath, $_.Exception.Message)
        }
        finally {
            $key.Close()
        }
        if ($changes.Count -eq 0) {
            continue
        }
        try {
            $writable = $Hive.OpenSubKey($keyPath, $true)
            foreach ($name in $changes.Keys) {
                $writable.SetValue($name, $changes[$name][1], $changes[$name][0])
                $count++
            }
            $writable.Close()
        }
        catch {
            Write-Warning ('[RELOCATE] Registry {0}\{1} not updated: {2}' -f $Hive.Name, $keyPath, $_.Exception.Message)
            $script:SrrFailedCount++
        }
    }
    return $count
}

function Move-RegistryRoot {
    param(
        [string]$OldRoot,
        [string]$NewRoot
    )
    $root = $null
    $count = 0
    $treeCount = 0

    foreach ($root in $script:SrrRegistryRoots) {
        Write-Host ('[RELOCATE] Scanning registry {0}\{1} ...' -f $root.Hive.Name, $root.Path) -ForegroundColor DarkGray
        $treeCount = Move-SrrRegistryTreeRoot -Hive $root.Hive -Path $root.Path -OldRoot $OldRoot -NewRoot $NewRoot
        $count += $treeCount
    }
    Write-Host ('[RELOCATE] {0} registry value(s) re-rooted {1} -> {2}' -f $count, $OldRoot, $NewRoot) -ForegroundColor Green
}

# Shortcuts, scheduled tasks and registry in one call; a failure in one part is
# reported and never stops the others. Returns the number of references that
# could not be re-rooted.
function Move-SystemReferenceRoot {
    param(
        [string]$OldRoot,
        [string]$NewRoot
    )
    $step = ''

    $script:SrrFailedCount = 0
    foreach ($step in @('Move-ShortcutRoot', 'Move-ScheduledTaskRoot', 'Move-RegistryRoot')) {
        try {
            & $step -OldRoot $OldRoot -NewRoot $NewRoot
        }
        catch {
            Write-Warning ('[RELOCATE] {0} failed for {1}: {2}' -f $step, $OldRoot, $_.Exception.Message)
            $script:SrrFailedCount++
        }
    }
    return $script:SrrFailedCount
}
