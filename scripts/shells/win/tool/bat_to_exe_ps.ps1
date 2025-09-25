# ???????????????????????? .ps1 ???????????????$batContent = Get-Content -Path "yourscript.bat" -Raw
$exePath = "output.exe"

$source = @"
using System;
using System.Diagnostics;
using System.IO;

class BatToExe {
    static void Main() {
        string tempBat = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString() + ".bat");
        File.WriteAllText(tempBat, @"$batContent");
        
        ProcessStartInfo psi = new ProcessStartInfo {
            FileName = "cmd.exe",
            Arguments = $"/C \"{tempBat}\"",
            UseShellExecute = false,
            CreateNoWindow = false
        };
        
        Process.Start(psi).WaitForExit();
        File.Delete(tempBat);
    }
}
"@

Add-Type -TypeDefinition $source -OutputAssembly $exePath -OutputType ConsoleApplication