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

# Menu Configuration for Nuxt Main Apps

$script:AppConfigs = @{
    "example" = @{
        Name = "example"
        DisplayName = "Example App"
        Port = 3000
        DevCommand = "dev:example"
        BuildCommand = "build:example"
    }
    "codemart" = @{
        Name = "codemart"
        DisplayName = "CodeMart"
        Port = 3001
        DevCommand = "dev:codemart"
        BuildCommand = "build:codemart"
    }
    "dev" = @{
        Name = "dev"
        DisplayName = "Dev App"
        Port = 3002
        DevCommand = "dev:dev"
        BuildCommand = "build:dev"
    }
    "admin" = @{
        Name = "admin"
        DisplayName = "Admin Panel"
        Port = 3003
        DevCommand = "dev:admin"
        BuildCommand = "build:admin"
    }
    "dashboard" = @{
        Name = "dashboard"
        DisplayName = "Dashboard"
        Port = 3004
        DevCommand = "dev:dashboard"
        BuildCommand = "build:dashboard"
    }
}

function Get-AppConfigs {
    return $script:AppConfigs
}

function Get-AppConfig {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppName
    )
    return $script:AppConfigs[$AppName]
}
