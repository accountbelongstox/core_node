# PHP Installation Script

## Overview

In `scripts/shells/win/install_powershells/Step12_InstallApplications.ps1`, add PHP package. First use `winget PHP.PHP.8.4` (sometimes installation fails, this is official issue). Then use `choco install php --version=8.4 -y`. After that use `scoop install php84`. Then use `@https://downloads.php.net/~windows/releases/php-8.4.12-Win32-vs17-x64.zip`. Principle is: if previous installation succeeds, later detection of exe will automatically skip.

## Combined Installation Type

Please create a new installation type which is combined installation. Others like `AdditionalInstallationPackages`, `PostInstallCallbacks`, `EnvVars` are all the same. Actually, in `scripts/shells/win/install_powershells/Step12_InstallApplications.ps1`, add combined call functionality. When one installation succeeds, skip later ones, then continue setting environment variables and other steps.

