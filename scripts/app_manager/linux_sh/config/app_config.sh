#!/bin/bash
# App Manager - Linux SH Configuration
# Central config for scan paths, ports, and command templates (Linux)

BASE_PORT=10000
PORT_RANGE=5000
AUTO_INCREMENT=true

ENTRY_POINTS="main.py main.js package.json composer.json pubspec.yaml index.php build.gradle build.gradle.kts nuxt.config.js nuxt.config.ts"

# Command template for a key; placeholders: app_path, app_name, port, root_dir
get_command_tpl() {
    local key="$1"
    case "$key" in
        react_dev)          echo 'cd "${app_path}" && pnpm run dev' ;;
        react_build)        echo 'cd "${app_path}" && pnpm run build && pnpm start' ;;
        reactnative_dev)    echo 'cd "${app_path}" && pnpm run dev' ;;
        reactnative_build)  echo 'cd "${app_path}" && pnpm run build && pnpm start' ;;
        vue_dev)            echo 'cd "${app_path}" && pnpm run dev' ;;
        vue_build)          echo 'cd "${app_path}" && pnpm run build && pnpm start' ;;
        nuxt_dev)           echo 'cd "${app_path}" && pnpm run dev' ;;
        nuxt_build)         echo 'cd "${app_path}" && pnpm run build && pnpm start' ;;
        laravel_dev)        echo 'cd "${app_path}" && php artisan serve --host=0.0.0.0 --port=${port}' ;;
        laravel_prod)       echo 'cd "${app_path}" && php artisan serve --host=0.0.0.0 --port=${port} --env=production' ;;
        flutter_dev)        echo 'cd "${app_path}" && flutter run -d web-server --web-hostname=0.0.0.0 --web-port=${port}' ;;
        flutter_build)      echo 'cd "${app_path}" && flutter build web' ;;
        kotlin_dev)         echo 'cd "${app_path}" && ./gradlew run' ;;
        php_dev)            echo 'php -S 0.0.0.0:${port} -t "${app_path}"' ;;
        python_dev)         echo 'python3 "${app_path}/main.py"' ;;
        ncore_dev)          echo 'node "${root_dir}/main.js" app=${app_name}' ;;
        pycore_dev)         echo 'python3 "${root_dir}/pymain.py" app=${app_name}' ;;
        polyLauncher)       echo 'cd "${app_path}" && pnpm run dev' ;;
        *)                  echo 'cd "${app_path}" && pnpm run dev' ;;
    esac
}
