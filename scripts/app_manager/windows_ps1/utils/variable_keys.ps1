# App Manager - Variable key constants (shared with global vars when needed)
$Script:VariableKeys = @{
    APP_COUNT = "APP_COUNT"
    STATUS    = "STATUS"
}

function Get-AppVariableKey {
    param([int]$Index, [string]$Property)
    return "APP_${Index}_${Property}"
}
