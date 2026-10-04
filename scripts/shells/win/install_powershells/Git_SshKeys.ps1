. (Join-Path (Join-Path (Split-Path $PSScriptRoot -Parent) "win_common") "GlobalVars.ps1")
. (Join-Path (Join-Path (Split-Path $PSScriptRoot -Parent) "win_common") "CommonFunc.ps1")

$COMPONENT_ID = 'Git_SshKeys'

function Test-SSHKeyPairExists {
    $sshDir = $Global:SSH_DIR
    if (-not (Test-Path $sshDir)) { return $false }
    $pubKeys = Get-ChildItem -Path $sshDir -Filter "*.pub" -File -ErrorAction SilentlyContinue
    foreach ($pub in $pubKeys) {
        $priv = Join-Path $sshDir ([System.IO.Path]::GetFileNameWithoutExtension($pub.Name))
        if (Test-Path $priv) {
            Write-ColorMessage -Message "[$COMPONENT_ID] Found SSH key pair: $($pub.Name) / $(Split-Path $priv -Leaf)" -Type "Success"
            return $true
        }
    }
    return $false
}

function Download-SSHKeys {
    # Download public key
    Write-ColorMessage -Message "[$COMPONENT_ID] Downloading public key..." -Type "Warning"
    try {
        Invoke-WebRequest -Uri $Global:GIT_SSH_PUB_URL -OutFile $Global:SSH_PUB_PATH
        Write-ColorMessage -Message "[$COMPONENT_ID] Public key downloaded to: $($Global:SSH_PUB_PATH)" -Type "Success"
        Write-ColorMessage -Message "[$COMPONENT_ID] Public key content:" -Type "Info"
        Get-Content $Global:SSH_PUB_PATH | ForEach-Object {
            if (-not [string]::IsNullOrWhiteSpace($_)) {
                Write-ColorMessage -Message $_ -Type "Info"
            }
        }
    }
    catch {
        Write-ColorMessage -Message "[$COMPONENT_ID] Failed to download public key: $_" -Type "Error"
    }
    # Download private key
    Write-ColorMessage -Message "[$COMPONENT_ID] Downloading private key..." -Type "Warning"
    try {
        Invoke-WebRequest -Uri $Global:GIT_SSH_KEY_URL -OutFile $Global:SSH_KEY_PATH
        Write-ColorMessage -Message "[$COMPONENT_ID] Private key downloaded to: $($Global:SSH_KEY_PATH)" -Type "Success"
        Write-ColorMessage -Message "[$COMPONENT_ID] Private key content:" -Type "Info"
        Get-Content $Global:SSH_KEY_PATH | ForEach-Object {
            if (-not [string]::IsNullOrWhiteSpace($_)) {
                Write-ColorMessage -Message $_ -Type "Info"
            }
        }
    }
    catch {
        Write-ColorMessage -Message "[$COMPONENT_ID] Failed to download private key: $_" -Type "Error"
    }
}

function Decrypt-SSHKeys {
    # Prompt for password only if user confirms
    $askMsg = "[$COMPONENT_ID] Do you have a password for the SSH key files? (y/n, default n, 20s timeout): "
    Write-ColorMessage -Message $askMsg -Type "Warning"
    $hasPassword = $false
    $inputTimeout = 20
    $stopWatch = [System.Diagnostics.Stopwatch]::StartNew()
    $userInput = ""
    $plainPassword = ""
    $decryptResult = $null
    $wrongName = ""
    $failedName = ""

    while ($stopWatch.Elapsed.TotalSeconds -lt $inputTimeout -and !$host.UI.RawUI.KeyAvailable) {
        Start-Sleep -Milliseconds 200
    }
    if ($host.UI.RawUI.KeyAvailable) {
        $userInput = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown").Character
        if ($userInput -eq 'y' -or $userInput -eq 'Y') {
            $hasPassword = $true
        }
    }
    $stopWatch.Stop()
    if (-not $hasPassword) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Skipping password input and decryption." -Type "Info"
        return
    }
    Write-ColorMessage -Message "[$COMPONENT_ID] Please enter the password for the SSH key files:" -Type "Warning"
    $plainPassword = Read-SecretPassword -Label "[$COMPONENT_ID] SSH key"
    if ([string]::IsNullOrEmpty($plainPassword)) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Passwords empty or do not match. Please try again." -Type "Error"
        return
    }
    # Both key files decrypt in one process with one password. A wrong password writes
    # nothing (secret_crypto.js), so existing keys are never touched by a bad attempt.
    Write-ColorMessage -Message "[$COMPONENT_ID] Decrypting SSH key files..." -Type "Info"
    $decryptResult = Invoke-SecretCryptoBatch -Password $plainPassword -Command decrypt -ArgumentList @($Global:SSH_DIR, "--force", $Global:SSH_PUB_PATH, $Global:SSH_KEY_PATH)
    $plainPassword = $null
    if ($decryptResult.Done.Count -gt 0) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Decrypted $($decryptResult.Done.Count) SSH key file(s) successfully" -Type "Success"
    }
    foreach ($wrongName in $decryptResult.Wrong) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Wrong password for $wrongName (nothing written)" -Type "Error"
    }
    foreach ($failedName in $decryptResult.Failed) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Failed to decrypt $failedName" -Type "Error"
    }
}

function Set-SSHKeyPermissions {
    Write-ColorMessage -Message "[$COMPONENT_ID] Setting file permissions..." -Type "Info"
    try {
        $acl = Get-Acl $Global:SSH_KEY_PATH
        $acl.SetAccessRuleProtection($true, $false)
        $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($env:USERNAME, "FullControl", "Allow")
        $acl.AddAccessRule($rule)
        Set-Acl $Global:SSH_KEY_PATH $acl
        $acl = Get-Acl $Global:SSH_PUB_PATH
        $acl.SetAccessRuleProtection($true, $false)
        $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($env:USERNAME, "FullControl", "Allow")
        $acl.AddAccessRule($rule)
        Set-Acl $Global:SSH_PUB_PATH $acl
        Write-ColorMessage -Message "[$COMPONENT_ID] File permissions set successfully" -Type "Success"
    } catch {
        Write-ColorMessage -Message "[$COMPONENT_ID] Error setting file permissions: $_" -Type "Error"
    }
}

function Clean-DecryptedFiles {
    $sshDir = $Global:SSH_DIR
    $pubFiles = Get-ChildItem -Path $sshDir -Filter "*.pub" -File -ErrorAction SilentlyContinue
    $foundPair = $false
    foreach ($pub in $pubFiles) {
        $priv = Join-Path $sshDir ([System.IO.Path]::GetFileNameWithoutExtension($pub.Name))
        if (Test-Path $priv) {
            $foundPair = $true
            break
        }
    }
    if ($foundPair) {
        $jsFiles = Get-ChildItem -Path $sshDir -Filter "*.js" -File -ErrorAction SilentlyContinue
        foreach ($js in $jsFiles) {
            try {
                Remove-Item $js.FullName -Force
                Write-ColorMessage -Message "[$COMPONENT_ID] Deleted JS file: $($js.FullName)" -Type "Info"
            } catch {
                Write-ColorMessage -Message "[$COMPONENT_ID] Failed to delete JS file: $($js.FullName) - $_" -Type "Warning"
            }
        }
    }
}

function Git_SshKeys {
    Write-ColorMessage -Message "[$COMPONENT_ID] === Step 18: Installing Git SSH Keys ===" -Type "Info"
    Write-ColorMessage -Message "[$COMPONENT_ID] This step will install SSH keys for Git authentication." -Type "Warning"
    if (Test-SSHKeyPairExists) {
        Write-ColorMessage -Message "[$COMPONENT_ID] SSH key pair already exists, skipping installation." -Type "Success"
        return
    }
    $sshDirExists = Test-Path $Global:SSH_DIR
    if (-not $sshDirExists) {
        New-Item -ItemType Directory -Path $Global:SSH_DIR -Force | Out-Null
        Write-ColorMessage -Message "[$COMPONENT_ID] Created SSH directory: $($Global:SSH_DIR)" -Type "Success"
    }
    Download-SSHKeys
    Decrypt-SSHKeys
    Set-SSHKeyPermissions
    Write-ColorMessage -Message "[$COMPONENT_ID] SSH key installation completed successfully!" -Type "Success"
    Write-ColorMessage -Message "[$COMPONENT_ID] SSH keys are now available at:" -Type "Info"
    Write-ColorMessage -Message "[$COMPONENT_ID] Public key: $($Global:SSH_PUB_PATH)" -Type "Info"
    Write-ColorMessage -Message "[$COMPONENT_ID] Private key: $($Global:SSH_KEY_PATH)" -Type "Info"
}

Git_SshKeys
Clean-DecryptedFiles
