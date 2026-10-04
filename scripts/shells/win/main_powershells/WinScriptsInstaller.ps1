# Declare all variables at the beginning of the file
$FILES = @(
    'config/service_contract.json',
    'scripts/shells/win/dd.ps1',
    'scripts/shells/win/main_powershells/EnvironmentDetection.ps1',
    'scripts/shells/win/win_common/CommonFunc.ps1',
    'scripts/shells/win/win_common/DiskReadinessCommon.ps1',
    'scripts/shells/win/win_common/NssmServiceManager.ps1',
    'scripts/shells/win/win_common/StringEscapeUtils.ps1',
    'scripts/shells/win/win_common/registry_templates/all_files_context.reg',
    'scripts/shells/win/win_common/registry_templates/file_context.reg',
    'scripts/shells/win/win_common/registry_templates/folder_context.reg',
    'scripts/shells/win/win_common/registry_templates/new_document.reg',
    'scripts/shells/win/win_common/ApplicationsList.ps1',
    'scripts/shells/win/win_common/AiRuntimePolicy.ps1',
    'scripts/shells/win/win_common/GlobalVars.ps1',
    'scripts/shells/win/win_common/SharedCacheEnv.ps1',
    'scripts/shells/win/win_common/IconExtractor.ps1',
    'scripts/shells/win/win_common/SimpleIconExtractor.ps1',
    'scripts/shells/win/win_common/WindowsPathFunction.ps1',
    'scripts/shells/win/win_common/WindowsServiceManager.ps1',
    'scripts/shells/win/win_common/FrankenPhpManager.ps1',
    'scripts/shells/win/win_common/FrankenPhpCertificateManager.ps1',
    'scripts/shells/win/win_common/ServiceContract.ps1',
    'scripts/shells/win/win_common/WinswServiceManager.ps1',
    'scripts/shells/win/win_common/PackageManagerInvokes.ps1',
    'scripts/shells/win/win_common/PostInstallCallbackProcessor.ps1',
    'scripts/shells/win/win_common/CudaIndex.ps1',
    'scripts/shells/win/win_common/TorchCpuGuard.ps1',
    'scripts/shells/win/win_common/PaddleCpuGuard.ps1',
    'scripts/shells/win/win_common/PythonPrereqInstallCommon.ps1',
    'scripts/shells/win/win_common/DesktopIconManager.ps1',
    'scripts/shells/win/win_common/StartupManager.ps1',
    'scripts/shells/win/win_common/SecretDecryptionCheck.ps1',
    'scripts/shells/win/win_common/SecretEncryptionCheck.ps1',
    'scripts/shells/win/win_common/InstallerScriptsList.ps1',
    'scripts/shells/win/win_common/InstallItemRunner.ps1',
    'scripts/shells/ai_runtime_policy.env',
    'scripts/shells/win/win_common/PathMappingLib.ps1',
    'scripts/shells/win/win_common/GitSyncCommon.ps1',
    'scripts/shells/win/win_common/SecretManager.ps1',
    'scripts/shells/win/win_common/SecretCache.ps1',
    'scripts/shells/win/win_common/NvidiaCuStackAlign.ps1',
    'scripts/shells/win/win_common/PythonDependencyMapInstallCommon.ps1',
    'scripts/shells/win/win_common/TorchCudaInstallCommon.ps1',
    'scripts/shells/win/win_common/PrerequisiteStepCommon.ps1',
    'scripts/shells/win/win_common/TtsCompatibilityCommon.ps1',
    'scripts/shells/win/win_common/NvidiaDriverUpgradeNoticeCommon.ps1',
    'scripts/shells/win/win_common/InstallMethodCommon.ps1',
    'scripts/shells/win/win_common/ProjectTreeCommon.ps1',
    'scripts/shells/win/win_common/AndroidBuildEnv.ps1',
    'scripts/shells/win/win_common/ClaudeTeamInstallCommon.ps1',
    'scripts/shells/win/win_common/SystemReferenceRelocation.ps1',
    'scripts/shells/win/ai_scripts/DeepSeekManager.ps1',
    'scripts/shells/win/install_powershells/postinstall/CursorAgentPostInstallProcessor.ps1',
    'scripts/shells/win/win_common/registry_templates/7zip_context.reg',
    'scripts/shells/win/win_common/registry_templates/7zip_folder_context.reg',
    'scripts/registry_templates/WindowsTerminal_ContextMenu.reg',
    'scripts/shells/win/win_common/InstallConfigMenu.ps1',
    'scripts/shells/win/win_common/InstallSeriesCommon.ps1',
    'scripts/shells/win/win_common/McpChromeBuildCommon.ps1',
    'scripts/shells/win/install_powershells/Step4_InstallNode.ps1',
    'scripts/shells/win/install_powershells/Step5_InstallGit.ps1',
    'scripts/shells/win/install_powershells/Step8_InstallPython.ps1',
    'scripts/shells/win/install_powershells/Step16_InstallPhpWeb.ps1',
    'scripts/shells/win/install_powershells/Step17_InstallDatabases.ps1',
    'scripts/shells/win/install_powershells/Step20_InstallBaseTools.ps1',
    'scripts/shells/win/install_powershells/Step26_InstallAndroid.ps1',
    'scripts/shells/win/install_powershells/Step29_InstallWslDocker.ps1',
    'scripts/shells/win/install_powershells/Step33_InstallQt.ps1',
    'scripts/shells/win/install_powershells/Step46_InstallAiModels.ps1',
    'scripts/shells/win/win_common/GlobalVarStoreCommon.ps1',
    'scripts/shells/win/win_common/AiModelLevelCommon.ps1',
    'scripts/shells/win/win_common/OfficialArchiveCommon.ps1',
    'scripts/shells/win/win_common/PostgresqlManager.ps1',
    'scripts/shells/win/win_common/MysqlManager.ps1',
    'scripts/shells/win/win_common/NginxManager.ps1',
    'scripts/shells/win/win_common/TailscaleCommon.ps1',
    'scripts/shells/win/win_common/MeshCommon.ps1',
    'scripts/shells/win/win_common/HeadscaleCommon.ps1',
    'scripts/shells/win/win_common/RemoteControlCommon.ps1',
    'scripts/shells/win/win_common/DockerWslBridge.ps1',
    'scripts/shells/win/win_common/AiToolsCatalog.ps1',
    'scripts/shells/win/win_common/AiCliProvisionCommon.ps1',
    'scripts/shells/win/win_common/NatGatewayCommon.ps1',
    'scripts/shells/win/win_common/NatGatewayMonitor.ps1',
    'scripts/shells/win/win_common/TtsInstallAssetsCommon.ps1',
    'scripts/shells/win/win_common/PythonRuntimeCommon.ps1',
    'scripts/shells/win/menu_items/Item_InstallMode.ps1',
    'scripts/shells/win/menu_items/Item_Region.ps1',
    'scripts/shells/win/menu_items/Item_Database.ps1',
    'scripts/shells/win/menu_items/Item_Redis.ps1',
    'scripts/shells/win/menu_items/Item_WebServer.ps1',
    'scripts/shells/win/menu_items/Item_Docker.ps1',
    'scripts/shells/win/menu_items/Item_Dotnet.ps1',
    'scripts/shells/win/menu_items/Item_NetworkRouter.ps1',
    'scripts/shells/win/menu_items/Item_MeshVpn.ps1',
    'scripts/shells/win/menu_items/Item_CloudProvider.ps1',
    'scripts/shells/win/menu_items/Item_AiModels.ps1',
    'scripts/shells/common/pi_harness_settings.js',
    'scripts/shells/win/install_powershells/Step1_InitializeBaseDirectories.ps1',
    'scripts/shells/win/install_powershells/Step2_SetBaseSettings.ps1',
    'scripts/shells/win/install_powershells/Step3_InitWinget.ps1',
    'scripts/shells/win/install_powershells/Node_Runtime.ps1',
    'scripts/shells/win/install_powershells/Git_SshKeys.ps1',
    'scripts/shells/win/install_powershells/Git_Install.ps1',
    'scripts/shells/win/install_powershells/Step7_FixCoreNodeProjectLocation.ps1',
    'scripts/shells/win/install_powershells/Python_Default.ps1',
    'scripts/shells/win/install_powershells/Python_CudaPrereq.ps1',
    'scripts/shells/win/install_powershells/Python_PrereqPackages.ps1',
    'scripts/shells/win/install_powershells/Model_FasterWhisper.ps1',
    'scripts/shells/win/install_powershells/Model_EdgeTts.ps1',
    'scripts/shells/win/install_powershells/Python_Isolated310.ps1',
    'scripts/shells/win/install_powershells/Python_Isolated312.ps1',
    'scripts/shells/win/win_common/IsolatedPythonInstallCommon.ps1',
    'scripts/shells/win/install_powershells/Step14_InstallScoopWithChinaMirror.ps1',
    'scripts/shells/win/install_powershells/Step15_ExtendWindowsUpdate.ps1',
    'scripts/shells/win/install_powershells/Web_Php.ps1',
    'scripts/shells/win/install_powershells/Database_PostgreSQL.ps1',
    'scripts/shells/win/install_powershells/Step18_SetFileAssociations.ps1',
    'scripts/shells/win/install_powershells/Step19_DV.ps1',
    'scripts/shells/win/install_powershells/BaseTools_7Zip.ps1',
    'scripts/shells/win/install_powershells/Step21_InstallApplications.ps1',
    'scripts/shells/win/install_powershells/Step22_InstallChrome.ps1',
    'scripts/shells/win/install_powershells/Node_PuppeteerPlugins.ps1',
    'scripts/shells/win/install_powershells/BaseTools_SecurityTools.ps1',
    'scripts/shells/win/install_powershells/Android_ApkTool.ps1',
    'scripts/shells/win/install_powershells/Android_Studio.ps1',
    'scripts/shells/win/install_powershells/Android_PlatformTools.ps1',
    'scripts/shells/win/install_powershells/Step28_InstallFlutter.ps1',
    'scripts/shells/win/install_powershells/Wsl_Install.ps1',
    'scripts/shells/win/install_powershells/Wsl_Debian13.ps1',
    'scripts/shells/win/install_powershells/Wsl_RootLogin.ps1',
    'scripts/shells/win/install_powershells/Step32_InstallVisualStudio.ps1',
    'scripts/shells/win/install_powershells/Qt_BuildTools.ps1',
    'scripts/shells/win/install_powershells/Qt_Install.ps1',
    'scripts/shells/win/install_powershells/Qt_Official.ps1',
    'scripts/shells/win/install_powershells/Model_DeepSeek.ps1',
    'scripts/shells/win/install_powershells/Model_DeepSeekOCR.ps1',
    'scripts/shells/win/install_powershells/Model_Qwen25.ps1',
    'scripts/shells/win/install_powershells/Model_NLLB200.ps1',
    'scripts/shells/win/install_powershells/BaseTools_Nssm.ps1',
    'scripts/shells/win/install_powershells/AiTools_PiHarness.ps1',
    'scripts/shells/win/install_powershells/Model_ChatTts.ps1',
    'scripts/shells/win/install_powershells/Model_CosyVoice.ps1',
    'scripts/shells/win/install_powershells/Model_F5Tts.ps1',
    'scripts/shells/win/install_powershells/Model_Gptsovits.ps1',
    'scripts/shells/win/install_powershells/Model_Melotts.ps1',
    'scripts/shells/win/install_powershells/Model_Fishspeech.ps1',
    'scripts/shells/win/install_powershells/Model_Kokoro.ps1',
    'scripts/shells/win/install_powershells/Model_Voxcpm2.ps1',
    'scripts/shells/win/install_powershells/Model_Bark.ps1',
    'scripts/shells/win/install_powershells/Model_Parler.ps1',
    'scripts/shells/win/install_powershells/Model_Qwen3Tts.ps1',
    'scripts/shells/win/install_powershells/BaseTools_Ffmpeg.ps1',
    'scripts/shells/win/install_powershells/Android_Scrcpy.ps1',
    'scripts/shells/win/install_powershells/Node_FrontendPackages.ps1',
    'scripts/shells/win/install_powershells/Model_Sherpa.ps1',
    'scripts/shells/win/install_powershells/Step71_InstallDotnet.ps1',
    'scripts/shells/win/install_powershells/Web_FrankenPhp.ps1',
    'scripts/shells/win/install_powershells/Web_Composer.ps1',
    'scripts/shells/win/install_powershells/Web_ConfigurePhp85.ps1',
    'scripts/shells/win/install_powershells/Step175_LaravelMainStart.ps1',
    'scripts/shells/win/install_powershells/Model_Whisper.ps1',
    'scripts/shells/win/install_powershells/Model_Vosk.ps1',
    'scripts/shells/win/install_powershells/Step44_CheckCoreNodeProject.ps1',
    'scripts/shells/win/install_powershells/Database_Redis.ps1',
    'scripts/shells/win/install_powershells/Model_Ocr.ps1',
    'scripts/shells/win/install_powershells/Step47_InstallDocumentParsing.ps1',
    'scripts/shells/win/install_powershells/Step49_InstallLauncher.ps1',
    'scripts/shells/win/install_powershells/Android_SdkPackages.ps1',
    'scripts/shells/win/install_powershells/AiTools_CodexMultiDevice.ps1',
    'scripts/shells/win/install_powershells/Step65_InstallAiTools.ps1',
    'scripts/shells/win/install_powershells/Model_Ollama.ps1',
    'scripts/shells/win/install_powershells/Step73_InstallNetworkRouter.ps1',
    'scripts/shells/win/install_powershells/Database_MySQL.ps1',
    'scripts/shells/win/install_powershells/Web_Nginx.ps1',
    'scripts/shells/win/install_powershells/Step97_InstallTailscale.ps1',
    'scripts/shells/win/main_powershells/PreparePycorePrerequisites.ps1',
    'scripts/shells/win/main_powershells/PycorePrerequisitesList.ps1',
    'scripts/shells/win/install_powershells/postinstall/WeChatInstallProcessor.ps1',
    'scripts/shells/win/install_powershells/postinstall/GoPostInstallProcessor.ps1',
    'scripts/shells/win/install_powershells/postinstall/JavaPostInstallProcessor.ps1',
    'scripts/shells/win/install_powershells/postinstall/NodePostInstallProcessor.ps1',
    'scripts/shells/win/install_powershells/postinstall/PhpPostInstallProcessor.ps1',
    'scripts/shells/win/install_powershells/postinstall/RubyPostInstallProcessor.ps1',
    'scripts/shells/win/install_powershells/postinstall/RustPostInstallProcessor.ps1',
    'scripts/shells/win/install_powershells/postinstall/WSLUpgradeProcessor.ps1',
    'scripts/shells/win/menu_itemshells/DevInstaller.ps1',
    'scripts/shells/win/menu_itemshells/InitializationManager.ps1',
    'scripts/shells/win/menu_itemshells/ScriptScanner.ps1',
    'scripts/shells/win/menu_itemshells/TestInstaller.ps1',
    'scripts/shells/win/menu_itemshells/WSLDebianManager.ps1',
    'scripts/shells/win/tools/ScriptProcessor.ps1'
)

## Dynamic configuration based on region to reduce complexity
# Function to determine base URL based on region preference
function Get-RepoBaseUrl {
    $username = $env:USERNAME
    $globalVarDir = Join-Path (Join-Path "D:\www" "core_node") "global_var"
    $regionFile = Join-Path $globalVarDir "SELECTED_REGION"
    
    $selectedRegion = "Global"  # Default to Global if no preference set
    if (Test-Path $regionFile) {
        $selectedRegion = Get-Content $regionFile -Raw -ErrorAction SilentlyContinue
        $selectedRegion = $selectedRegion.Trim()
    }
    
    if ($selectedRegion -eq "Global") {
        return 'https://raw.githubusercontent.com/accountbelongstox/core_node/main'
    } else {
        return 'https://gitee.com/accountbelongstox/core_node/raw/main'
    }
}

$RepoBaseUrl = Get-RepoBaseUrl
$LocalDataDir = Join-Path "D:\www" "core_node"

# Common function for safe file downloads with atomic overwrite
function Invoke-SafeDownload {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url,
        [Parameter(Mandatory = $true)]
        [string]$DestinationPath,
        [string]$Description = "file"
    )
    
    $tmpPath = "$DestinationPath.tmp"
    
    # Ensure destination directory exists
    $destDir = Split-Path $DestinationPath -Parent
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    
    # Clean up any existing temp file
    if (Test-Path $tmpPath) {
        Remove-Item -Force $tmpPath -ErrorAction SilentlyContinue
    }
    
    Write-Host ("Downloading {0} from: {1}" -f $Description, $Url) -ForegroundColor White
    try {
        Invoke-WebRequest -Uri $Url -OutFile $tmpPath -UseBasicParsing -ErrorAction Stop
        
        # Verify download was successful
        if (-not (Test-Path $tmpPath) -or ((Get-Item $tmpPath).Length -le 0)) {
            throw "Empty or failed download"
        }
        
        # Atomic move to overwrite existing file
        Move-Item -Force -Path $tmpPath -Destination $DestinationPath
        Write-Host ("Saved: {0}" -f $DestinationPath) -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host ("Failed: {0} -> {1} ({2})" -f $Url, $DestinationPath, $_) -ForegroundColor Red
        # Clean up temp file on failure
        if (Test-Path $tmpPath) {
            Remove-Item -Force $tmpPath -ErrorAction SilentlyContinue
        }
        return $false
    }
}

# Ensure local data root exists
if (-not (Test-Path $LocalDataDir -PathType Container)) {
    New-Item -ItemType Directory -Path $LocalDataDir -Force | Out-Null
}


Write-Host ("Local data root: {0}" -f $LocalDataDir) -ForegroundColor White
Write-Host ("Repository base: {0}" -f $RepoBaseUrl) -ForegroundColor White

$failed = @()
foreach ($rel in $FILES) {
    $url = ("{0}/{1}" -f $RepoBaseUrl.TrimEnd('/'), $rel)
    $dest = Join-Path $LocalDataDir $rel
    
    $success = Invoke-SafeDownload -Url $url -DestinationPath $dest -Description $rel
    if (-not $success) {
        $failed += $rel
    }
}

if ($failed.Count -gt 0) {
    Write-Host ("Completed with failures: {0}" -f ($failed -join ', ')) -ForegroundColor Yellow
} else {
    Write-Host 'All files downloaded successfully.' -ForegroundColor Green
}
