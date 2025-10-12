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

# Centralized installer scripts list
# IMPORTANT: When adding new scripts to this list, maintain the index order sequence
# Scripts are executed in the order they appear in this array
# Always follow the existing numbering pattern (Step1_, Step2_, etc.)
#
# COMPATIBILITY NOTES:
# - Step80_InstallWSL.ps1: Enhanced with Windows 10/WSL1 compatibility support
#   - Automatically detects Windows version and WSL capabilities
#   - Enables required Windows features based on system version
#   - Upgrades WSL1 to WSL2 when supported
#   - Provides fallback installation methods for older systems

$InstallerScripts = @(
    'Step1_InitializeBaseDirectories.ps1',
    'Step2_SetBaseSettings.ps1',
    'Step3_InitWinget.ps1',
    'Step4_InstallGitSSH.ps1',
    'Step5_InstallGit.ps1',
    'Step6_InstallScoopWithChinaMirror.ps1',
    'Step8_DV.ps1',
    'Step9_SetFileAssociations.ps1',
    'Step11_Install7ipBase.ps1',
    'Step12_InstallApplications.ps1',
    'Step13_CheckCoreNodeProject.ps1',
    'Step26_InstallChrome.ps1',
    'Step47_InstallApkTool.ps1',
    'Step56_InstallAndroidStudio.ps1',
    'Step57_InstallAndroidPlatformTools.ps1',
    'Step66_InstallFlutter.ps1',
    'Step80_InstallWSL.ps1',
    'Step81_InstallWSLUbuntu24.ps1',
    'Step82_SetRootLoginWSLUbuntuDebian.ps1',
    'Step83_InstallVisualStudio.ps1',
    'Step84_InstallQtBuildTools.ps1',
    'Step85_InstallQt.ps1'
)