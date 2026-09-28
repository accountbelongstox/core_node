#!/usr/bin/env bash

SHELLS_DIR=""
SHELLS_SCRIPTS_DIR=""
CORE_SCRIPTS_DIR=""

prepare_nuxt_deployment() {
    local PROJECT_NAME="$1"
    local PROJECT_PATH="$2"
    local PROJECT_PORT="$3"
    local IS_DEBUG="${4:-false}"

    echo "Preparing Nuxt deployment..."
    echo "  Project: $PROJECT_NAME"
    echo "  Path: $PROJECT_PATH"
    echo "  Port: $PROJECT_PORT"
    echo "  Mode: $([ "$IS_DEBUG" = "true" ] && echo "Debug" || echo "Production")"

    if [ "$IS_DEBUG" = "true" ]; then
        echo "  Debug mode: Using source directory directly"
        echo "  No build preparation needed"
        return 0
    fi

    local FACTORY_BASE="/www/_build_dir/nuxt_factory/linux"
    local FACTORY_PATH="$FACTORY_BASE/_app_$PROJECT_NAME"

    if [ -d "$FACTORY_PATH" ]; then
        echo "  Removing old factory directory..."
        rm -rf "$FACTORY_PATH"
    fi

    echo "  Creating factory directory structure..."
    mkdir -p "$FACTORY_PATH"

    echo "  Copying build output to factory..."
    if [ -d "$PROJECT_PATH/.output" ]; then
        cp -r "$PROJECT_PATH/.output" "$FACTORY_PATH/"
        echo "  Build output copied"
    else
        echo "  Error: .output directory not found in $PROJECT_PATH"
        return 1
    fi

    if [ -d "$PROJECT_PATH/node_modules" ]; then
        echo "  Copying node_modules..."
        cp -r "$PROJECT_PATH/node_modules" "$FACTORY_PATH/"
        echo "  node_modules copied"
    fi

    echo "  Setting permissions..."
    chmod -R 755 "$FACTORY_PATH"

    echo "  Nuxt deployment prepared at: $FACTORY_PATH"
    return 0
}

prepare_static_deployment() {
    local PROJECT_NAME="$1"
    local PROJECT_PATH="$2"
    local PROJECT_PORT="$3"
    local IS_DEBUG="${4:-false}"

    echo "Preparing static deployment..."
    echo "  Project: $PROJECT_NAME"
    echo "  Path: $PROJECT_PATH"
    echo "  Port: $PROJECT_PORT"
    echo "  Mode: $([ "$IS_DEBUG" = "true" ] && echo "Debug" || echo "Production")"

    local DEPLOY_BASE="/www/_build_dir/static_apps"
    local DEPLOY_PATH="$DEPLOY_BASE/$PROJECT_NAME"

    if [ -d "$DEPLOY_PATH" ]; then
        echo "  Removing old deployment directory..."
        rm -rf "$DEPLOY_PATH"
    fi

    echo "  Creating deployment directory..."
    mkdir -p "$DEPLOY_PATH"

    local BUILD_DIRS=("dist" "build" ".output/public" "out")
    local BUILD_FOUND=false

    for BUILD_DIR in "${BUILD_DIRS[@]}"; do
        if [ -d "$PROJECT_PATH/$BUILD_DIR" ]; then
            echo "  Found build output: $BUILD_DIR"
            cp -r "$PROJECT_PATH/$BUILD_DIR"/* "$DEPLOY_PATH/"
            BUILD_FOUND=true
            break
        fi
    done

    if [ "$BUILD_FOUND" = false ]; then
        echo "  Error: No build output found in $PROJECT_PATH"
        return 1
    fi

    echo "  Setting permissions..."
    chmod -R 755 "$DEPLOY_PATH"

    echo "  Static deployment prepared at: $DEPLOY_PATH"
    return 0
}

cleanup_deployment() {
    local PROJECT_NAME="$1"
    local PROJECT_TYPE="$2"

    echo "Cleaning up old deployment..."

    if [ "$PROJECT_TYPE" = "nuxt" ]; then
        local FACTORY_PATH="/www/_build_dir/nuxt_factory/linux/_app_$PROJECT_NAME"
        if [ -d "$FACTORY_PATH" ]; then
            rm -rf "$FACTORY_PATH"
            echo "  Cleaned factory directory"
        fi
    else
        local DEPLOY_PATH="/www/_build_dir/static_apps/$PROJECT_NAME"
        if [ -d "$DEPLOY_PATH" ]; then
            rm -rf "$DEPLOY_PATH"
            echo "  Cleaned deployment directory"
        fi
    fi
}

get_build_path() {
    local PROJECT_NAME="$1"
    local PROJECT_TYPE="$2"
    local IS_DEBUG="${3:-false}"

    if [ "$IS_DEBUG" = "true" ]; then
        echo "source"
        return 0
    fi

    if [ "$PROJECT_TYPE" = "nuxt" ]; then
        echo "/www/_build_dir/nuxt_factory/linux/_app_$PROJECT_NAME"
    else
        echo "/www/_build_dir/static_apps/$PROJECT_NAME"
    fi
}
