# Auto Fix Context7 MCP Server

param(
    [int]$MaxRetries = 3,
    [int]$RetryDelay = 2,
    [switch]$ForceReinstall = $false
)

$ErrorActionPreference = "Continue"

function Clear-NPX-Cache {
    try {
        $npxCache = "$env:LOCALAPPDATA\npm-cache\_npx"
        if (Test-Path $npxCache) {
            Remove-Item -Path $npxCache -Recurse -Force -ErrorAction SilentlyContinue
        }
        npm cache clean --force 2>$null
    }
    catch {
        # Silent fail
    }
}

function Test-Context7-Installation {
    try {
        $testResult = npx -y @upstash/context7-mcp --version 2>&1
        return $LASTEXITCODE -eq 0
    }
    catch {
        return $false
    }
}

function Install-Context7 {
    try {
        if ($ForceReinstall) {
            Clear-NPX-Cache
        }
        
        $installResult = npx -y @upstash/context7-mcp@latest 2>&1
        return $LASTEXITCODE -eq 0
    }
    catch {
        return $false
    }
}

function Start-Context7-Server {
    npx -y @upstash/context7-mcp
}

function Main {
    for ($attempt = 1; $attempt -le $MaxRetries; $attempt++) {
        if (Test-Context7-Installation) {
            Start-Context7-Server
            return
        }
        
        Clear-NPX-Cache
        
        if (Install-Context7) {
            if (Test-Context7-Installation) {
                Start-Context7-Server
                return
            }
        }
        
        if ($attempt -lt $MaxRetries) {
            Start-Sleep -Seconds $RetryDelay
        }
    }
    
    exit 1
}

Main
