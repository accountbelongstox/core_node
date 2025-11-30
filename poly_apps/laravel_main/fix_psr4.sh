#!/bin/bash

# Fix PSR-4 autoloading compliance issues in Laravel application
# This script updates namespace declarations to match file paths

echo "Starting PSR-4 compliance fixes..."

# Fix AwyV0 Auth controllers - using different patterns
echo "Fixing AwyV0 Auth controllers..."
find /www/wwwroot/core_node/poly_apps/laravel_main/app/Apps/AwyV0/AwyV0Auth -name "*.php" -type f | while read file; do
    if grep -q "namespace App\\\\AwyV0\\\\Auth;" "$file"; then
        sed -i 's/namespace App\\AwyV0\\Auth;/namespace App\\Apps\\AwyV0\\AwyV0Auth;/' "$file"
        echo "Fixed: $file"
    fi
done

# Fix AwyV0 AuthPublic classes
echo "Fixing AwyV0 AuthPublic classes..."
find /www/wwwroot/core_node/poly_apps/laravel_main/app/Apps/AwyV0/AwyV0Auth/AwyV0AuthPublic -name "*.php" -type f | while read file; do
    if grep -q "namespace App\\\\AwyV0\\\\Auth\\\\AuthPublic;" "$file"; then
        sed -i 's/namespace App\\AwyV0\\Auth\\AuthPublic;/namespace App\\Apps\\AwyV0\\AwyV0Auth\\AwyV0AuthPublic;/' "$file"
        echo "Fixed: $file"
    fi
done

# Fix Utils classes that are in wrong locations
echo "Fixing Utils classes..."

# Fix GenVoiceName in AwyV0/Utils
if [ -f "/www/wwwroot/core_node/poly_apps/laravel_main/app/Apps/AwyV0/Utils/GenVoiceName.php" ]; then
    if grep -q "namespace App\\\\Utils\\\\Voice;" "/www/wwwroot/core_node/poly_apps/laravel_main/app/Apps/AwyV0/Utils/GenVoiceName.php"; then
        sed -i 's/namespace App\\Utils\\Voice;/namespace App\\Apps\\AwyV0\\Utils;/' "/www/wwwroot/core_node/poly_apps/laravel_main/app/Apps/AwyV0/Utils/GenVoiceName.php"
        echo "Fixed: GenVoiceName.php"
    fi
fi

# Fix DictV1 Utils classes
echo "Fixing DictV1 Utils classes..."
find /www/wwwroot/core_node/poly_apps/laravel_main/app/Apps/DictV1/Utils -name "*.php" -type f | while read file; do
    if grep -q "namespace App\\\\Utils\\\\Dict;" "$file"; then
        sed -i 's/namespace App\\Utils\\Dict;/namespace App\\Apps\\DictV1\\Utils\\Dict;/' "$file"
        echo "Fixed: $file"
    fi
    if grep -q "namespace App\\\\Utils;" "$file"; then
        sed -i 's/namespace App\\Utils;/namespace App\\Apps\\DictV1\\Utils;/' "$file"
        echo "Fixed: $file"
    fi
done

echo "PSR-4 compliance fixes completed!"
