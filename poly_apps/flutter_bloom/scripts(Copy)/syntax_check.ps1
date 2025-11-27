$file = "D:\programing\core_node\poly_apps\flutter_bloom\scripts\win_common\BCommon.ps1"

try {
    $errors = $null
    $null = [System.Management.Automation.PSParser]::Tokenize((Get-Content $file -Raw), [ref]$errors)

    if ($errors) {
        Write-Host "Syntax errors found:" -ForegroundColor Red
        foreach ($error in $errors) {
            Write-Host "Line $($error.Token.StartLine): $($error.Message)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "No syntax errors found!" -ForegroundColor Green
    }
} catch {
    Write-Host "Error checking syntax: $_" -ForegroundColor Red
}
