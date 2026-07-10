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

. "$PSScriptRoot\..\win_common\GlobalVars.ps1"
. "$PSScriptRoot\..\win_common\CommonFunc.ps1"

$STEP_NUMBER = 5

function Test-SSHKeyPairExists {
    $sshDir = $Global:SSH_DIR
    if (-not (Test-Path $sshDir)) { return $false }
    $pubKeys = Get-ChildItem -Path $sshDir -Filter "*.pub" -File -ErrorAction SilentlyContinue
    foreach ($pub in $pubKeys) {
        $priv = Join-Path $sshDir ([System.IO.Path]::GetFileNameWithoutExtension($pub.Name))
        if (Test-Path $priv) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Found SSH key pair: $($pub.Name) / $(Split-Path $priv -Leaf)" -Type "Success"
            return $true
        }
    }
    return $false
}

function Download-SSHKeys {
    # Download public key
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Downloading public key..." -Type "Warning"
    try {
        Invoke-WebRequest -Uri $Global:GIT_SSH_PUB_URL -OutFile $Global:SSH_PUB_PATH
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Public key downloaded to: $($Global:SSH_PUB_PATH)" -Type "Success"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Public key content:" -Type "Info"
        Get-Content $Global:SSH_PUB_PATH | ForEach-Object {
            if (-not [string]::IsNullOrWhiteSpace($_)) {
                Write-ColorMessage -Message $_ -Type "Info"
            }
        }
    }
    catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to download public key: $_" -Type "Error"
    }
    # Download private key
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Downloading private key..." -Type "Warning"
    try {
        Invoke-WebRequest -Uri $Global:GIT_SSH_KEY_URL -OutFile $Global:SSH_KEY_PATH
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Private key downloaded to: $($Global:SSH_KEY_PATH)" -Type "Success"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Private key content:" -Type "Info"
        Get-Content $Global:SSH_KEY_PATH | ForEach-Object {
            if (-not [string]::IsNullOrWhiteSpace($_)) {
                Write-ColorMessage -Message $_ -Type "Info"
            }
        }
    }
    catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to download private key: $_" -Type "Error"
    }
}

function Decrypt-SSHKeys {
    # Prompt for password only if user confirms
    $askMsg = "[Step $STEP_NUMBER] Do you have a password for the SSH key files? (y/n, default n, 20s timeout): "
    Write-ColorMessage -Message $askMsg -Type "Warning"
    $hasPassword = $false
    $inputTimeout = 20
    $stopWatch = [System.Diagnostics.Stopwatch]::StartNew()
    $userInput = ""
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
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Skipping password input and decryption." -Type "Info"
        return
    }
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Please enter the password for the SSH key files:" -Type "Warning"
    $password = Read-Host -AsSecureString "Password"
    $confirmPassword = Read-Host -AsSecureString "Confirm Password"
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
    $plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($confirmPassword)
    $plainConfirmPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
    if ($plainPassword -ne $plainConfirmPassword) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Passwords do not match. Please try again." -Type "Error"
        return
    }
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Decrypting SSH key files..." -Type "Info"
    try {
        & $Global:NODE_EXE_PATH $Global:SSH_PUB_PATH pwd $plainPassword $Global:SSH_DIR
        if (-not (Test-Path $Global:SSH_PUB_PATH)) { throw "Failed to decrypt public key" }
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Public key decrypted successfully" -Type "Success"
    } catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Error decrypting public key: $_" -Type "Error"
    }
    try {
        & $Global:NODE_EXE_PATH $Global:SSH_KEY_PATH pwd $plainPassword $Global:SSH_DIR
        if (-not (Test-Path $Global:SSH_KEY_PATH)) { throw "Failed to decrypt private key" }
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Private key decrypted successfully" -Type "Success"
    } catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Error decrypting private key: $_" -Type "Error"
    }
}

function Set-SSHKeyPermissions {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Setting file permissions..." -Type "Info"
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
        Write-ColorMessage -Message "[Step $STEP_NUMBER] File permissions set successfully" -Type "Success"
    } catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Error setting file permissions: $_" -Type "Error"
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
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Deleted JS file: $($js.FullName)" -Type "Info"
            } catch {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to delete JS file: $($js.FullName) - $_" -Type "Warning"
            }
        }
    }
}

function Step5_InstallGitSSH {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] === Step 18: Installing Git SSH Keys ===" -Type "Info"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] This step will install SSH keys for Git authentication." -Type "Warning"
    if (Test-SSHKeyPairExists) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] SSH key pair already exists, skipping installation." -Type "Success"
        return
    }
    $sshDirExists = Test-Path $Global:SSH_DIR
    if (-not $sshDirExists) {
        New-Item -ItemType Directory -Path $Global:SSH_DIR -Force | Out-Null
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Created SSH directory: $($Global:SSH_DIR)" -Type "Success"
    }
    Download-SSHKeys
    Decrypt-SSHKeys
    Set-SSHKeyPermissions
    Write-ColorMessage -Message "[Step $STEP_NUMBER] SSH key installation completed successfully!" -Type "Success"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] SSH keys are now available at:" -Type "Info"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Public key: $($Global:SSH_PUB_PATH)" -Type "Info"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Private key: $($Global:SSH_KEY_PATH)" -Type "Info"
}

Step5_InstallGitSSH
Clean-DecryptedFiles
