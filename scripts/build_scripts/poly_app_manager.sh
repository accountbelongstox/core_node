#!/usr/bin/env bash

set -euo pipefail

SHELLS_DIR=""
SHELLS_SCRIPTS_DIR=""
CORE_SCRIPTS_DIR=""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_NODE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
POLY_APPS_DIR="$CORE_NODE_DIR/poly_apps"
PY_TOOLS_DIR="$SCRIPT_DIR/build_py_tools"
GVAR_COMMON_SH="$CORE_NODE_DIR/scripts/shells/linux/common/gvar_common.sh"
DEPLOY_HELPER_SH="$PY_TOOLS_DIR/deploy_helper.sh"
VALIDATION_HELPER_SH="$PY_TOOLS_DIR/validation_helper.sh"

if [ -f "$GVAR_COMMON_SH" ]; then
    source "$GVAR_COMMON_SH"
else
    echo "Error: gvar_common.sh not found"
    exit 1
fi

if [ -f "$DEPLOY_HELPER_SH" ]; then
    source "$DEPLOY_HELPER_SH"
else
    echo "Error: deploy_helper.sh not found"
    exit 1
fi

if [ -f "$VALIDATION_HELPER_SH" ]; then
    source "$VALIDATION_HELPER_SH"
else
    echo "Error: validation_helper.sh not found"
    exit 1
fi

echo ""
echo "==============================================================================="
echo "  POLY APPS MANAGER - Multi-Project Launcher"
echo "==============================================================================="
echo ""
echo "Core Node Dir: $CORE_NODE_DIR"
echo "Poly Apps Dir: $POLY_APPS_DIR"
echo ""

cd "$PY_TOOLS_DIR"

echo "Step 1: Scanning projects in poly_apps..."
echo "-------------------------------------------------------------------------------"
python3 project_detector.py "$POLY_APPS_DIR" 10000
echo ""

echo "Step 2: Displaying interactive menu..."
echo "-------------------------------------------------------------------------------"
python3 menu_system.py
echo ""

SELECTED_PROJECT_NAME=$(get_global_var "POLY_APP_SELECTED_PROJECT_NAME" "")
PROJECT_PATH=$(get_global_var "POLY_APP_PROJECT_PATH" "")
PROJECT_TYPE=$(get_global_var "POLY_APP_PROJECT_TYPE" "")
PROJECT_PORT=$(get_global_var "POLY_APP_PROJECT_PORT" "")
SELECTED_ACTION=$(get_global_var "POLY_APP_SELECTED_ACTION_NAME" "")
SELECTED_PLATFORM=$(get_global_var "POLY_APP_SELECTED_PLATFORM_NAME" "")

if [ -z "$SELECTED_PROJECT_NAME" ]; then
    echo "No project selected. Exiting."
    exit 0
fi

echo "==============================================================================="
echo "  LAUNCHING PROJECT"
echo "==============================================================================="
echo ""
echo "Project      : $SELECTED_PROJECT_NAME"
echo "Type         : $PROJECT_TYPE"
echo "Path         : $PROJECT_PATH"
echo "Port         : $PROJECT_PORT"
echo "Action       : $SELECTED_ACTION"
echo "Platform     : $SELECTED_PLATFORM"
echo ""

# Initialize effective action (may be converted later for static apps)
EFFECTIVE_ACTION="$SELECTED_ACTION"

echo "==============================================================================="
echo ""

cd "$PROJECT_PATH"

PORT=$PROJECT_PORT
NUXT_PORT=$PROJECT_PORT
NUXT_HOST="0.0.0.0"

case "$PROJECT_TYPE" in
    "nuxt")
        case "$SELECTED_ACTION" in
            "debug")
                if [ "$SELECTED_PLATFORM" = "deploy_laravel" ]; then
                    # Nuxt can deploy source code (SSR has dev server)
                    EFFECTIVE_ACTION="$SELECTED_ACTION"

                    echo "Deploying Nuxt in debug mode (using source)..."

                    # Run validation for debug mode
                    if ! run_full_validation "$PROJECT_PATH" "$PROJECT_TYPE" "$SELECTED_PROJECT_NAME" "$EFFECTIVE_ACTION" "true"; then
                        echo ""
                        echo "Error: Validation failed. Cannot proceed with deployment."
                        exit 1
                    fi

                    LARAVEL_DIR="$CORE_NODE_DIR/poly_apps/laravel_main"
                    if [ -d "$LARAVEL_DIR" ]; then
                        cd "$LARAVEL_DIR"
                        php artisan servermanager:nuxt add "$SELECTED_PROJECT_NAME" \
                            --port="$PROJECT_PORT" \
                            --build-path="$PROJECT_PATH" \
                            --debug
                    else
                        echo "Error: Laravel directory not found: $LARAVEL_DIR"
                        exit 1
                    fi
                else
                    # Normal dev mode
                    EFFECTIVE_ACTION="$SELECTED_ACTION"

                    echo "Starting Nuxt development server..."

                    # Run validation for dev mode
                    if ! run_full_validation "$PROJECT_PATH" "$PROJECT_TYPE" "$SELECTED_PROJECT_NAME" "$EFFECTIVE_ACTION" "true"; then
                        echo ""
                        echo "Error: Validation failed. Cannot start development server."
                        exit 1
                    fi

                    cd "$PROJECT_PATH"
                    pnpm run dev || npm run dev
                fi
                ;;
            "build")
                # Set effective action
                EFFECTIVE_ACTION="$SELECTED_ACTION"

                # Run full validation before build
                if ! run_full_validation "$PROJECT_PATH" "$PROJECT_TYPE" "$SELECTED_PROJECT_NAME" "$EFFECTIVE_ACTION" "true"; then
                    echo ""
                    echo "Error: Validation failed. Cannot proceed with build."
                    exit 1
                fi

                echo "Building Nuxt project..."
                cd "$PROJECT_PATH"
                pnpm run build || npm run build

                # Validate build output
                if ! validate_build_output "$PROJECT_PATH" "$PROJECT_TYPE" "$SELECTED_PROJECT_NAME"; then
                    echo ""
                    echo "Error: Build output validation failed."
                    exit 1
                fi

                if [ "$SELECTED_PLATFORM" = "deploy_laravel" ]; then
                    echo "Preparing deployment files..."
                    prepare_nuxt_deployment "$SELECTED_PROJECT_NAME" "$PROJECT_PATH" "$PROJECT_PORT" "false"

                    if [ $? -eq 0 ]; then
                        BUILD_PATH=$(get_build_path "$SELECTED_PROJECT_NAME" "nuxt" "false")

                        echo "Deploying to Laravel service manager..."
                        LARAVEL_DIR="$CORE_NODE_DIR/poly_apps/laravel_main"
                        if [ -d "$LARAVEL_DIR" ]; then
                            cd "$LARAVEL_DIR"
                            php artisan servermanager:nuxt add "$SELECTED_PROJECT_NAME" \
                                --port="$PROJECT_PORT" \
                                --build-path="$BUILD_PATH"
                        else
                            echo "Error: Laravel directory not found: $LARAVEL_DIR"
                            exit 1
                        fi
                    else
                        echo "Error: Deployment preparation failed"
                        exit 1
                    fi
                fi
                ;;
            "generate")
                # Set effective action
                EFFECTIVE_ACTION="$SELECTED_ACTION"

                # Run full validation before generate
                if ! run_full_validation "$PROJECT_PATH" "$PROJECT_TYPE" "$SELECTED_PROJECT_NAME" "$EFFECTIVE_ACTION" "true"; then
                    echo ""
                    echo "Error: Validation failed. Cannot proceed with static site generation."
                    exit 1
                fi

                echo "Generating static site..."
                cd "$PROJECT_PATH"
                pnpm run generate || npm run generate

                # Validate build output
                if ! validate_build_output "$PROJECT_PATH" "$PROJECT_TYPE" "$SELECTED_PROJECT_NAME"; then
                    echo ""
                    echo "Error: Generate output validation failed."
                    exit 1
                fi

                if [ "$SELECTED_PLATFORM" = "deploy_laravel" ]; then
                    echo "Preparing deployment files..."
                    prepare_nuxt_deployment "$SELECTED_PROJECT_NAME" "$PROJECT_PATH" "$PROJECT_PORT" "false"

                    if [ $? -eq 0 ]; then
                        BUILD_PATH=$(get_build_path "$SELECTED_PROJECT_NAME" "nuxt" "false")

                        echo "Deploying to Laravel service manager..."
                        LARAVEL_DIR="$CORE_NODE_DIR/poly_apps/laravel_main"
                        if [ -d "$LARAVEL_DIR" ]; then
                            cd "$LARAVEL_DIR"
                            php artisan servermanager:nuxt add "$SELECTED_PROJECT_NAME" \
                                --port="$PROJECT_PORT" \
                                --build-path="$BUILD_PATH"
                        else
                            echo "Error: Laravel directory not found: $LARAVEL_DIR"
                            exit 1
                        fi
                    else
                        echo "Error: Deployment preparation failed"
                        exit 1
                    fi
                fi
                ;;
        esac
        ;;

    "react-native")
        case "$SELECTED_ACTION" in
            "debug")
                case "$SELECTED_PLATFORM" in
                    "android")
                        echo "Starting React Native on Android..."
                        pnpm run android || npm run android
                        ;;
                    "ios")
                        echo "Starting React Native on iOS..."
                        pnpm run ios || npm run ios
                        ;;
                    "web")
                        echo "Starting React Native web..."
                        pnpm run web || npm run start
                        ;;
                    "deploy_laravel")
                        echo "Building React Native for web deployment..."
                        pnpm run build:web || npm run build:web || (pnpm run build || npm run build)

                        echo "Deploying to Laravel service manager..."
                        LARAVEL_DIR="$CORE_NODE_DIR/poly_apps/laravel_main"
                        if [ -d "$LARAVEL_DIR" ]; then
                            cd "$LARAVEL_DIR"
                            php artisan servermanager:static add "$SELECTED_PROJECT_NAME" --port="$PROJECT_PORT" --debug
                        else
                            echo "Error: Laravel directory not found: $LARAVEL_DIR"
                            exit 1
                        fi
                        ;;
                esac
                ;;
            "build"|"release")
                case "$SELECTED_PLATFORM" in
                    "android")
                        echo "Building React Native Android release..."
                        if [ -d "android" ]; then
                            cd android && ./gradlew assembleRelease
                        else
                            echo "Error: android directory not found in $PROJECT_PATH"
                            exit 1
                        fi
                        ;;
                    "ios")
                        echo "Building React Native iOS release..."
                        echo "Please use Xcode to build iOS release"
                        ;;
                    "web")
                        echo "Building React Native for web..."
                        pnpm run build:web || npm run build:web || (pnpm run build || npm run build)
                        ;;
                    "deploy_laravel")
                        echo "Building React Native for web deployment..."
                        pnpm run build:web || npm run build:web || (pnpm run build || npm run build)

                        echo "Deploying to Laravel service manager..."
                        LARAVEL_DIR="$CORE_NODE_DIR/poly_apps/laravel_main"
                        if [ -d "$LARAVEL_DIR" ]; then
                            cd "$LARAVEL_DIR"
                            php artisan servermanager:static add "$SELECTED_PROJECT_NAME" --port="$PROJECT_PORT"
                        else
                            echo "Error: Laravel directory not found: $LARAVEL_DIR"
                            exit 1
                        fi
                        ;;
                esac
                ;;
        esac
        ;;

    "flutter")
        case "$SELECTED_ACTION" in
            "debug")
                case "$SELECTED_PLATFORM" in
                    "android")
                        flutter run -d android
                        ;;
                    "ios")
                        flutter run -d ios
                        ;;
                    "web")
                        flutter run -d chrome
                        ;;
                    "linux")
                        flutter run -d linux
                        ;;
                esac
                ;;
            "build"|"release")
                case "$SELECTED_PLATFORM" in
                    "android")
                        flutter build apk --release
                        ;;
                    "ios")
                        flutter build ipa --release
                        ;;
                    "web")
                        flutter build web --release
                        ;;
                    "linux")
                        flutter build linux --release
                        ;;
                esac
                ;;
        esac
        ;;

    "laravel")
        echo "Starting Laravel development server..."
        php artisan serve --host=0.0.0.0 --port="$PROJECT_PORT"
        ;;

    "react"|"vue"|"vite")
        case "$SELECTED_ACTION" in
            "debug")
                if [ "$SELECTED_PLATFORM" = "deploy_laravel" ]; then
                    # Debug mode: Deploy development server as a system service
                    # Similar to Nuxt debug mode - runs dev server persistently
                    EFFECTIVE_ACTION="$SELECTED_ACTION"

                    echo ""
                    echo "Deploying development server as system service..."
                    echo ""

                    # Run validation for debug mode
                    if ! run_full_validation "$PROJECT_PATH" "$PROJECT_TYPE" "$SELECTED_PROJECT_NAME" "$EFFECTIVE_ACTION" "true"; then
                        echo ""
                        echo "Error: Validation failed. Cannot proceed with deployment."
                        exit 1
                    fi

                    echo "Deploying to Laravel service manager (debug mode)..."
                    LARAVEL_DIR="$CORE_NODE_DIR/poly_apps/laravel_main"
                    if [ -d "$LARAVEL_DIR" ]; then
                        cd "$LARAVEL_DIR"
                        # Pass source path, ServerManager will create service running 'npm run dev'
                        php artisan servermanager:static add "$SELECTED_PROJECT_NAME" \
                            --port="$PROJECT_PORT" \
                            --build-path="$PROJECT_PATH" \
                            --debug
                    else
                        echo "Error: Laravel directory not found: $LARAVEL_DIR"
                        exit 1
                    fi
                else
                    # Normal debug mode - use effective action (same as selected)
                    EFFECTIVE_ACTION="$SELECTED_ACTION"

                    # Run validation for dev mode
                    if ! run_full_validation "$PROJECT_PATH" "$PROJECT_TYPE" "$SELECTED_PROJECT_NAME" "$EFFECTIVE_ACTION" "true"; then
                        echo ""
                        echo "Error: Validation failed. Cannot start development server."
                        exit 1
                    fi

                    echo "Starting development server..."
                    cd "$PROJECT_PATH"
                    pnpm run dev || npm run dev
                fi
                ;;
            "build")
                # Set effective action (same as selected for build mode)
                EFFECTIVE_ACTION="$SELECTED_ACTION"

                # Run full validation before build
                if ! run_full_validation "$PROJECT_PATH" "$PROJECT_TYPE" "$SELECTED_PROJECT_NAME" "$EFFECTIVE_ACTION" "true"; then
                    echo ""
                    echo "Error: Validation failed. Cannot proceed with build."
                    exit 1
                fi

                echo "Building project..."
                cd "$PROJECT_PATH"
                pnpm run build || npm run build

                # Validate build output
                if ! validate_build_output "$PROJECT_PATH" "$PROJECT_TYPE" "$SELECTED_PROJECT_NAME"; then
                    echo ""
                    echo "Error: Build output validation failed."
                    exit 1
                fi

                if [ "$SELECTED_PLATFORM" = "deploy_laravel" ]; then
                    echo "Preparing deployment files..."
                    prepare_static_deployment "$SELECTED_PROJECT_NAME" "$PROJECT_PATH" "$PROJECT_PORT" "false"

                    if [ $? -eq 0 ]; then
                        BUILD_PATH=$(get_build_path "$SELECTED_PROJECT_NAME" "static" "false")

                        echo "Deploying to Laravel service manager..."
                        LARAVEL_DIR="$CORE_NODE_DIR/poly_apps/laravel_main"
                        if [ -d "$LARAVEL_DIR" ]; then
                            cd "$LARAVEL_DIR"
                            php artisan servermanager:static add "$SELECTED_PROJECT_NAME" \
                                --port="$PROJECT_PORT" \
                                --build-path="$BUILD_PATH"
                        else
                            echo "Error: Laravel directory not found: $LARAVEL_DIR"
                            exit 1
                        fi
                    else
                        echo "Error: Deployment preparation failed"
                        exit 1
                    fi
                fi
                ;;
            "preview")
                # Set effective action
                EFFECTIVE_ACTION="$SELECTED_ACTION"

                # Run validation for preview mode
                if ! run_full_validation "$PROJECT_PATH" "$PROJECT_TYPE" "$SELECTED_PROJECT_NAME" "$EFFECTIVE_ACTION" "true"; then
                    echo ""
                    echo "Error: Validation failed. Cannot start preview server."
                    exit 1
                fi

                echo "Starting preview server..."
                cd "$PROJECT_PATH"
                pnpm run preview || npm run preview

                if [ "$SELECTED_PLATFORM" = "deploy_laravel" ]; then
                    echo "Note: Preview mode typically uses build output"
                    echo "Preparing deployment files..."
                    prepare_static_deployment "$SELECTED_PROJECT_NAME" "$PROJECT_PATH" "$PROJECT_PORT" "false"

                    if [ $? -eq 0 ]; then
                        BUILD_PATH=$(get_build_path "$SELECTED_PROJECT_NAME" "static" "false")

                        echo "Deploying to Laravel service manager..."
                        LARAVEL_DIR="$CORE_NODE_DIR/poly_apps/laravel_main"
                        if [ -d "$LARAVEL_DIR" ]; then
                            cd "$LARAVEL_DIR"
                            php artisan servermanager:static add "$SELECTED_PROJECT_NAME" \
                                --port="$PROJECT_PORT" \
                                --build-path="$BUILD_PATH"
                        else
                            echo "Error: Laravel directory not found: $LARAVEL_DIR"
                            exit 1
                        fi
                    else
                        echo "Error: Deployment preparation failed"
                        exit 1
                    fi
                fi
                ;;
        esac
        ;;

    *)
        echo "Unknown project type: $PROJECT_TYPE"
        exit 1
        ;;
esac

echo ""
echo "==============================================================================="
echo "  PROJECT EXECUTION COMPLETE"
echo "==============================================================================="
echo ""
