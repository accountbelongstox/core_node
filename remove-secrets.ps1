# Script to remove OAuth secrets from git history
$file = "poly_apps/top-router/src/services/geminiAccountService.js"

# Secrets to remove (replace with empty string or env var reference)
$secrets = @(
    "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com",
    "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",
    "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com",
    "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"
)

# Use git filter-branch to rewrite history
$env:FILTER_BRANCH_SQUELCH_WARNING = "1"

git filter-branch --force --tree-filter @"
if [ -f `"$file`" ]; then
    sed -i '' 's/681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j\.apps\.googleusercontent\.com//g' `"$file`"
    sed -i '' 's/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//g' `"$file`"
    sed -i '' 's/1071006060591-tmhssin2h21lcre235vtolojh4g403ep\.apps\.googleusercontent\.com//g' `"$file`"
    sed -i '' 's/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//g' `"$file`"
    # Fix the || operator - if we removed the fallback value, keep just the env var
    sed -i '' 's/||\s*'\'''\''/|| '\'''\''/g' `"$file`"
fi
"@ --prune-empty --tag-name-filter cat -- --all

