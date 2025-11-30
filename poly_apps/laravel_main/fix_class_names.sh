#!/bin/bash

# Fix class names to match file names for PSR-4 compliance

echo "Fixing class names to match file names..."

# Fix AwyV0 Auth controllers
declare -A class_mappings=(
    ["AwyV0EmailVerificationNotificationCtl.php"]="EmailVerificationNotificationController"
    ["AwyV0PasswordResetLinkCtl.php"]="PasswordResetLinkController"
    ["AwyV0AuthenticatedSessionCtl.php"]="AuthenticatedSessionController"
    ["AwyV0EmailVerificationPromptCtl.php"]="EmailVerificationPromptController"
    ["AwyV0AwyregisteredUserCtl.php"]="AwyregisteredUserController"
    ["AwyV0NewPasswordCtl.php"]="NewPasswordController"
    ["AwyV0AwyloginCtl.php"]="AwyloginController"
    ["AwyV0ConfirmablePasswordCtl.php"]="ConfirmablePasswordController"
)

# Fix Auth controllers
for file in "${!class_mappings[@]}"; do
    filepath="/www/wwwroot/core_node/poly_apps/laravel_main/app/Apps/AwyV0/AwyV0Auth/$file"
    if [ -f "$filepath" ]; then
        old_class="${class_mappings[$file]}"
        new_class="${file%.php}"
        sed -i "s/class $old_class/class $new_class/" "$filepath"
        echo "Fixed: $file - $old_class -> $new_class"
    fi
done

# Fix AuthPublic classes
declare -A authpublic_mappings=(
    ["AwyV0UserInitEnsure.php"]="UserInitEnsure"
    ["AwyV0AwyUserGen.php"]="AwyUserGen"
    ["AwyV0UserLogin.php"]="UserLogin"
)

for file in "${!authpublic_mappings[@]}"; do
    filepath="/www/wwwroot/core_node/poly_apps/laravel_main/app/Apps/AwyV0/AwyV0Auth/AwyV0AuthPublic/$file"
    if [ -f "$filepath" ]; then
        old_class="${authpublic_mappings[$file]}"
        new_class="${file%.php}"
        sed -i "s/class $old_class/class $new_class/" "$filepath"
        echo "Fixed: $file - $old_class -> $new_class"
    fi
done

# Fix Welcome class
if [ -f "/www/wwwroot/core_node/poly_apps/laravel_main/app/Apps/AwyV0/AwyV0Welcome/AwyV0Awywelcome.php" ]; then
    sed -i "s/class Awywelcome/class AwyV0Awywelcome/" "/www/wwwroot/core_node/poly_apps/laravel_main/app/Apps/AwyV0/AwyV0Welcome/AwyV0Awywelcome.php"
    echo "Fixed: AwyV0Awywelcome.php - Awywelcome -> AwyV0Awywelcome"
fi

# Fix Gvar class
if [ -f "/www/wwwroot/core_node/poly_apps/laravel_main/app/Apps/AwyV0/AwyV0Gvar/AwyV0Gvar.php" ]; then
    sed -i "s/class Gvar/class AwyV0Gvar/" "/www/wwwroot/core_node/poly_apps/laravel_main/app/Apps/AwyV0/AwyV0Gvar/AwyV0Gvar.php"
    echo "Fixed: AwyV0Gvar.php - Gvar -> AwyV0Gvar"
fi

# Fix AvatarPublic class
if [ -f "/www/wwwroot/core_node/poly_apps/laravel_main/app/Apps/AwyV0/AwyV0Auth/AwyV0AvatarPublic.php" ]; then
    sed -i "s/class AvatarPublic/class AwyV0AvatarPublic/" "/www/wwwroot/core_node/poly_apps/laravel_main/app/Apps/AwyV0/AwyV0Auth/AwyV0AvatarPublic.php"
    echo "Fixed: AwyV0AvatarPublic.php - AvatarPublic -> AwyV0AvatarPublic"
fi

echo "Class name fixes completed!"
