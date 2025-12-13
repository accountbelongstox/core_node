#!/usr/bin/env python3
"""
Launcher Script Generator
Generates service launcher scripts with dependency checking
"""

import os
from pathlib import Path
from typing import Optional


class LauncherGenerator:
    """Generates launcher scripts for different framework types"""

    def __init__(self, launcher_dir: str = "/var/_core_node/unified_manager/temp_scripts"):
        self.launcher_dir = Path(launcher_dir)
        self.launcher_dir.mkdir(parents=True, exist_ok=True)
        os.chmod(self.launcher_dir, 0o755)

    def generate_launcher(
        self,
        service_name: str,
        app_path: str,
        framework_type: str,
        port: int,
        debug_mode: bool = True,
        extra_env: dict = None
    ) -> str:
        """
        Generate launcher script for a service

        Args:
            service_name: Name of the service
            app_path: Path to application directory
            framework_type: Framework type (reactStart, vueStart, nuxtStart, etc.)
            port: Port number
            debug_mode: Whether to run in debug/development mode
            extra_env: Additional environment variables

        Returns:
            Path to generated launcher script
        """
        launcher_path = self.launcher_dir / f"{service_name}.sh"

        # Generate script content based on framework type
        if framework_type in ["reactStart", "vueStart"]:
            content = self._generate_react_vue_launcher(
                app_path, port, debug_mode, extra_env
            )
        elif framework_type == "nuxtStart":
            content = self._generate_nuxt_launcher(
                app_path, port, debug_mode, extra_env
            )
        elif framework_type == "laravelStart":
            content = self._generate_laravel_launcher(
                app_path, port, debug_mode, extra_env
            )
        elif framework_type == "flutterStart":
            content = self._generate_flutter_launcher(
                app_path, port, debug_mode, extra_env
            )
        else:
            content = self._generate_generic_nodejs_launcher(
                app_path, port, debug_mode, extra_env
            )

        # Write launcher script
        launcher_path.write_text(content)
        os.chmod(launcher_path, 0o755)

        return str(launcher_path)

    def _generate_react_vue_launcher(
        self,
        app_path: str,
        port: int,
        debug_mode: bool,
        extra_env: Optional[dict]
    ) -> str:
        """Generate launcher for React/Vue projects"""
        env_vars = self._format_env_vars(extra_env)

        if debug_mode:
            return f"""#!/bin/bash
set -e

cd "{app_path}"

# Auto-detect and fix PATH for node tools
echo "Detecting Node.js environment..."
export PATH="/www/_ubuntu_24/node/node-v24.11.1/pnpm-global/bin:/www/_ubuntu_24/node/node-v24.11.1/bin:/www/_ubuntu_24/node/node-v22.21.0/bin:$PATH"

# Detect available package manager
PKG_MANAGER=""
if command -v pnpm >/dev/null 2>&1; then
    PKG_MANAGER="pnpm"
    echo "Using package manager: pnpm"
elif command -v yarn >/dev/null 2>&1; then
    PKG_MANAGER="yarn"
    echo "Using package manager: yarn"
elif command -v npm >/dev/null 2>&1; then
    PKG_MANAGER="npm"
    echo "Using package manager: npm"
else
    echo "ERROR: No package manager found (pnpm, yarn, or npm)"
    exit 1
fi

# Check and install dependencies
if [ ! -d "node_modules" ]; then
    echo "node_modules not found, installing dependencies..."
    $PKG_MANAGER install
fi

# Auto-fix Vite config to use environment PORT
echo "Checking Vite configuration..."
if [ -f "vite.config.ts" ]; then
    # Check if port is NOT reading from environment variable
    if ! grep -q "process\\\\.env\\\\.PORT\\\\|process\\\\.env\\\\.VITE_PORT" vite.config.ts; then
        # Check if port is hardcoded
        if grep -q "port:[[:space:]]*[0-9]" vite.config.ts; then
            echo "Detected hardcoded port in vite.config.ts, applying auto-fix..."
            # Backup original config
            if [ -f "vite.config.ts" ] && [ ! -f "vite.config.ts.backup" ]; then
                cp vite.config.ts vite.config.ts.backup
            fi
            # Fix: Replace hardcoded port with environment variable
            sed -i 's/port:[[:space:]]*[0-9]\\\\+/port: parseInt(process.env.PORT || process.env.VITE_PORT || "3000")/' vite.config.ts
            echo "✓ Vite config auto-fixed to use PORT environment variable"
            # Clean vite cache after config change
            if [ -d "node_modules/.vite-temp" ]; then
                rm -rf node_modules/.vite-temp
            fi
            if [ -d "node_modules/.vite" ]; then
                rm -rf node_modules/.vite
            fi
            echo "✓ Cleared Vite cache"
        fi
    fi
elif [ -f "vite.config.js" ]; then
    # Check if port is NOT reading from environment variable
    if ! grep -q "process\\\\.env\\\\.PORT\\\\|process\\\\.env\\\\.VITE_PORT" vite.config.js; then
        if grep -q "port:[[:space:]]*[0-9]" vite.config.js; then
            echo "Detected hardcoded port in vite.config.js, applying auto-fix..."
            if [ -f "vite.config.js" ] && [ ! -f "vite.config.js.backup" ]; then
                cp vite.config.js vite.config.js.backup
            fi
            sed -i 's/port:[[:space:]]*[0-9]\\\\+/port: parseInt(process.env.PORT || process.env.VITE_PORT || "3000")/' vite.config.js
            echo "✓ Vite config auto-fixed to use PORT environment variable"
            # Clean vite cache after config change
            if [ -d "node_modules/.vite-temp" ]; then
                rm -rf node_modules/.vite-temp
            fi
            if [ -d "node_modules/.vite" ]; then
                rm -rf node_modules/.vite
            fi
            echo "✓ Cleared Vite cache"
        fi
    fi
fi

# Set environment variables for Vite/React/Vue
export HOST=0.0.0.0
export PORT={port}
export VITE_PORT={port}
{env_vars}

# Start development server with port override as fallback
exec $PKG_MANAGER run dev -- --port {port} --host 0.0.0.0
"""
        else:
            return f"""#!/bin/bash
set -e

cd "{app_path}"

# Auto-detect and fix PATH for node tools
echo "Detecting Node.js environment..."
export PATH="/www/_ubuntu_24/node/node-v24.11.1/pnpm-global/bin:/www/_ubuntu_24/node/node-v24.11.1/bin:/www/_ubuntu_24/node/node-v22.21.0/bin:$PATH"

# Detect available package manager
PKG_MANAGER=""
if command -v pnpm >/dev/null 2>&1; then
    PKG_MANAGER="pnpm"
    echo "Using package manager: pnpm"
elif command -v yarn >/dev/null 2>&1; then
    PKG_MANAGER="yarn"
    echo "Using package manager: yarn"
elif command -v npm >/dev/null 2>&1; then
    PKG_MANAGER="npm"
    echo "Using package manager: npm"
else
    echo "ERROR: No package manager found (pnpm, yarn, or npm)"
    exit 1
fi

# Check and install dependencies
if [ ! -d "node_modules" ]; then
    echo "node_modules not found, installing dependencies..."
    $PKG_MANAGER install
fi

# Build if dist/build directory doesn't exist
if [ ! -d "dist" ] && [ ! -d "build" ]; then
    echo "Building application..."
    $PKG_MANAGER run build
fi

# Set environment variables
export HOST=0.0.0.0
export PORT={port}
export VITE_PORT={port}
{env_vars}

# Start production server
exec $PKG_MANAGER run start
"""

    def _generate_nuxt_launcher(
        self,
        app_path: str,
        port: int,
        debug_mode: bool,
        extra_env: Optional[dict]
    ) -> str:
        """Generate launcher for Nuxt projects"""
        env_vars = self._format_env_vars(extra_env)

        if debug_mode:
            return f"""#!/bin/bash
set -e

cd "{app_path}"

# Auto-detect and fix PATH for node tools
echo "Detecting Node.js environment..."
export PATH="/www/_ubuntu_24/node/node-v24.11.1/pnpm-global/bin:/www/_ubuntu_24/node/node-v24.11.1/bin:/www/_ubuntu_24/node/node-v22.21.0/bin:$PATH"

# Detect available package manager
PKG_MANAGER=""
if command -v pnpm >/dev/null 2>&1; then
    PKG_MANAGER="pnpm"
    echo "Using package manager: pnpm"
elif command -v yarn >/dev/null 2>&1; then
    PKG_MANAGER="yarn"
    echo "Using package manager: yarn"
elif command -v npm >/dev/null 2>&1; then
    PKG_MANAGER="npm"
    echo "Using package manager: npm"
else
    echo "ERROR: No package manager found (pnpm, yarn, or npm)"
    exit 1
fi

# Check and install dependencies
if [ ! -d "node_modules" ]; then
    echo "node_modules not found, installing dependencies..."
    $PKG_MANAGER install
fi

# Auto-fix Nuxt config to use environment PORT
echo "Checking Nuxt configuration..."
if [ -f "nuxt.config.ts" ]; then
    if ! grep -q "process\\\\.env\\\\.NUXT_PORT\\\\|process\\\\.env\\\\.PORT" nuxt.config.ts; then
        if grep -q "port:[[:space:]]*[0-9]" nuxt.config.ts; then
            echo "Detected hardcoded port in nuxt.config.ts, applying auto-fix..."
            if [ -f "nuxt.config.ts" ] && [ ! -f "nuxt.config.ts.backup" ]; then
                cp nuxt.config.ts nuxt.config.ts.backup
            fi
            sed -i 's/port:[[:space:]]*[0-9]\\\\+/port: parseInt(process.env.NUXT_PORT || process.env.PORT || "3000")/' nuxt.config.ts
            echo "✓ Nuxt config auto-fixed to use NUXT_PORT environment variable"
        fi
    fi
elif [ -f "nuxt.config.js" ]; then
    if ! grep -q "process\\\\.env\\\\.NUXT_PORT\\\\|process\\\\.env\\\\.PORT" nuxt.config.js; then
        if grep -q "port:[[:space:]]*[0-9]" nuxt.config.js; then
            echo "Detected hardcoded port in nuxt.config.js, applying auto-fix..."
            if [ -f "nuxt.config.js" ] && [ ! -f "nuxt.config.js.backup" ]; then
                cp nuxt.config.js nuxt.config.js.backup
            fi
            sed -i 's/port:[[:space:]]*[0-9]\\\\+/port: parseInt(process.env.NUXT_PORT || process.env.PORT || "3000")/' nuxt.config.js
            echo "✓ Nuxt config auto-fixed to use NUXT_PORT environment variable"
        fi
    fi
fi

# Set environment variables for Nuxt
export HOST=0.0.0.0
export PORT={port}
export NUXT_PORT={port}
export NUXT_HOST=0.0.0.0
export NODE_ENV=development
{env_vars}

# Start Nuxt development server
exec $PKG_MANAGER run dev
"""
        else:
            return f"""#!/bin/bash
set -e

cd "{app_path}"

# Auto-detect and fix PATH for node tools
echo "Detecting Node.js environment..."
export PATH="/www/_ubuntu_24/node/node-v24.11.1/pnpm-global/bin:/www/_ubuntu_24/node/node-v24.11.1/bin:/www/_ubuntu_24/node/node-v22.21.0/bin:$PATH"

# Detect available package manager
PKG_MANAGER=""
if command -v pnpm >/dev/null 2>&1; then
    PKG_MANAGER="pnpm"
    echo "Using package manager: pnpm"
elif command -v yarn >/dev/null 2>&1; then
    PKG_MANAGER="yarn"
    echo "Using package manager: yarn"
elif command -v npm >/dev/null 2>&1; then
    PKG_MANAGER="npm"
    echo "Using package manager: npm"
else
    echo "ERROR: No package manager found (pnpm, yarn, or npm)"
    exit 1
fi

# Check and install dependencies
if [ ! -d "node_modules" ]; then
    echo "node_modules not found, installing dependencies..."
    $PKG_MANAGER install
fi

# Auto-fix Nuxt config to use environment PORT
echo "Checking Nuxt configuration..."
if [ -f "nuxt.config.ts" ]; then
    if ! grep -q "process\\\\.env\\\\.NUXT_PORT\\\\|process\\\\.env\\\\.PORT" nuxt.config.ts; then
        if grep -q "port:[[:space:]]*[0-9]" nuxt.config.ts; then
            echo "Detected hardcoded port in nuxt.config.ts, applying auto-fix..."
            if [ -f "nuxt.config.ts" ] && [ ! -f "nuxt.config.ts.backup" ]; then
                cp nuxt.config.ts nuxt.config.ts.backup
            fi
            sed -i 's/port:[[:space:]]*[0-9]\\\\+/port: parseInt(process.env.NUXT_PORT || process.env.PORT || "3000")/' nuxt.config.ts
            echo "✓ Nuxt config auto-fixed to use NUXT_PORT environment variable"
        fi
    fi
elif [ -f "nuxt.config.js" ]; then
    if ! grep -q "process\\\\.env\\\\.NUXT_PORT\\\\|process\\\\.env\\\\.PORT" nuxt.config.js; then
        if grep -q "port:[[:space:]]*[0-9]" nuxt.config.js; then
            echo "Detected hardcoded port in nuxt.config.js, applying auto-fix..."
            if [ -f "nuxt.config.js" ] && [ ! -f "nuxt.config.js.backup" ]; then
                cp nuxt.config.js nuxt.config.js.backup
            fi
            sed -i 's/port:[[:space:]]*[0-9]\\\\+/port: parseInt(process.env.NUXT_PORT || process.env.PORT || "3000")/' nuxt.config.js
            echo "✓ Nuxt config auto-fixed to use NUXT_PORT environment variable"
        fi
    fi
fi

# Build if .output directory doesn't exist
if [ ! -d ".output" ]; then
    echo "Building Nuxt application..."
    $PKG_MANAGER run build
fi

# Set environment variables
export HOST=0.0.0.0
export PORT={port}
export NUXT_PORT={port}
export NUXT_HOST=0.0.0.0
export NODE_ENV=production
{env_vars}

# Start Nuxt production server
exec $PKG_MANAGER run start
"""

    def _generate_laravel_launcher(
        self,
        app_path: str,
        port: int,
        debug_mode: bool,
        extra_env: Optional[dict]
    ) -> str:
        """Generate launcher for Laravel projects"""
        env_vars = self._format_env_vars(extra_env)

        env_setting = "development" if debug_mode else "production"

        return f"""#!/bin/bash
set -e

cd "{app_path}"

# Auto-detect and fix PATH for PHP and Composer
echo "Detecting PHP environment..."
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

# Check if composer is available
if ! command -v composer >/dev/null 2>&1; then
    echo "ERROR: Composer not found in PATH"
    echo "Please install composer or add it to PATH"
    exit 1
fi

# Check if php is available
if ! command -v php >/dev/null 2>&1; then
    echo "ERROR: PHP not found in PATH"
    exit 1
fi

echo "Using PHP: $(php -v | head -1)"
echo "Using Composer: $(composer --version | head -1)"

# Check and install composer dependencies
if [ ! -d "vendor" ]; then
    echo "vendor directory not found, installing composer dependencies..."
    composer install --no-interaction --prefer-dist
    if [ $? -ne 0 ]; then
        echo "ERROR: Composer install failed"
        exit 1
    fi
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "Creating .env from .env.example..."
        cp .env.example .env
    else
        echo "ERROR: No .env file found and no .env.example to copy from"
        exit 1
    fi
fi

# Generate app key if not exists
if ! grep -q "APP_KEY=base64:" .env; then
    echo "Generating Laravel application key..."
    php artisan key:generate --force
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to generate application key"
        exit 1
    fi
fi

# Run migrations (only in debug mode)
if [ "{debug_mode}" = "True" ]; then
    echo "Running database migrations..."
    if php artisan migrate --force 2>&1 | grep -q "could not find driver"; then
        echo "WARNING: Database driver not available, skipping migrations"
    else
        if [ $? -ne 0 ]; then
            echo "WARNING: Migration failed, continuing anyway"
        fi
    fi
fi

# Clear Laravel caches
echo "Clearing Laravel caches..."
php artisan config:clear
php artisan cache:clear

# Set environment variables
export APP_ENV={env_setting}
export SERVER_PORT={port}
export OCTANE_PORT={port}
{env_vars}

# Check if Octane is installed
echo "Checking for Laravel Octane..."
if php artisan list | grep -q "octane:start"; then
    echo "✓ Laravel Octane detected"
    echo "Starting Laravel Octane server on port {port}..."

    # Check which server is available
    if command -v roadrunner >/dev/null 2>&1; then
        echo "Using RoadRunner server"
        exec php artisan octane:start --server=roadrunner --host=0.0.0.0 --port={port}
    elif command -v frankenphp >/dev/null 2>&1; then
        echo "Using FrankenPHP server"
        exec php artisan octane:start --server=frankenphp --host=0.0.0.0 --port={port}
    elif command -v swoole-cli >/dev/null 2>&1; then
        echo "Using Swoole server"
        exec php artisan octane:start --server=swoole --host=0.0.0.0 --port={port}
    else
        echo "WARNING: No Octane server found (roadrunner/frankenphp/swoole)"
        echo "Falling back to standard Laravel server"
        exec php artisan serve --host=0.0.0.0 --port={port}
    fi
else
    echo "Laravel Octane not installed, using standard server"
    exec php artisan serve --host=0.0.0.0 --port={port}
fi
"""

    def _generate_flutter_launcher(
        self,
        app_path: str,
        port: int,
        debug_mode: bool,
        extra_env: Optional[dict]
    ) -> str:
        """Generate launcher for Flutter web projects"""
        env_vars = self._format_env_vars(extra_env)

        if debug_mode:
            return f"""#!/bin/bash
set -e

cd "{app_path}"

# Auto-detect and fix PATH for Flutter
echo "Detecting Flutter environment..."
# Common Flutter installation paths
FLUTTER_PATHS=(
    "$HOME/flutter/bin"
    "$HOME/development/flutter/bin"
    "/usr/local/flutter/bin"
    "/opt/flutter/bin"
)

# Add common Flutter paths to PATH
for flutter_path in "${{FLUTTER_PATHS[@]}}"; do
    if [ -d "$flutter_path" ]; then
        export PATH="$flutter_path:$PATH"
    fi
done

# Check if flutter is available
if ! command -v flutter >/dev/null 2>&1; then
    echo "ERROR: Flutter not found in PATH"
    echo "Please install Flutter or add it to PATH"
    echo "Searched in: ${{FLUTTER_PATHS[*]}}"
    exit 1
fi

echo "Using Flutter: $(flutter --version | head -1)"

# Get Flutter dependencies
if [ ! -d ".dart_tool" ] || [ ! -d ".flutter-plugins" ]; then
    echo "Flutter dependencies not found, running flutter pub get..."
    flutter pub get
fi

# Set environment variables
{env_vars}

# Start Flutter web development server
echo "Starting Flutter web server on port {port}..."
exec flutter run -d web-server --web-hostname=0.0.0.0 --web-port={port}
"""
        else:
            return f"""#!/bin/bash
set -e

cd "{app_path}"

# Auto-detect and fix PATH for Flutter
echo "Detecting Flutter environment..."
# Common Flutter installation paths
FLUTTER_PATHS=(
    "$HOME/flutter/bin"
    "$HOME/development/flutter/bin"
    "/usr/local/flutter/bin"
    "/opt/flutter/bin"
)

# Add common Flutter paths to PATH
for flutter_path in "${{FLUTTER_PATHS[@]}}"; do
    if [ -d "$flutter_path" ]; then
        export PATH="$flutter_path:$PATH"
    fi
done

# Check if flutter is available
if ! command -v flutter >/dev/null 2>&1; then
    echo "ERROR: Flutter not found in PATH"
    echo "Please install Flutter or add it to PATH"
    echo "Searched in: ${{FLUTTER_PATHS[*]}}"
    exit 1
fi

echo "Using Flutter: $(flutter --version | head -1)"

# Get Flutter dependencies
if [ ! -d ".dart_tool" ] || [ ! -d ".flutter-plugins" ]; then
    echo "Flutter dependencies not found, running flutter pub get..."
    flutter pub get
fi

# Build if build/web doesn't exist
if [ ! -d "build/web" ]; then
    echo "Building Flutter web application..."
    flutter build web
fi

# Check if python3 is available for serving
if ! command -v python3 >/dev/null 2>&1; then
    echo "ERROR: python3 not found, cannot serve built Flutter app"
    exit 1
fi

# Set environment variables
{env_vars}

# Serve built Flutter web app
echo "Starting HTTP server on port {port} for Flutter web app..."
exec python3 -m http.server {port} --bind 0.0.0.0 --directory build/web
"""

    def _generate_generic_nodejs_launcher(
        self,
        app_path: str,
        port: int,
        debug_mode: bool,
        extra_env: Optional[dict]
    ) -> str:
        """Generate launcher for generic Node.js projects"""
        env_vars = self._format_env_vars(extra_env)

        script_cmd = "dev" if debug_mode else "start"

        return f"""#!/bin/bash
set -e

cd "{app_path}"

# Auto-detect and fix PATH for node tools
echo "Detecting Node.js environment..."
export PATH="/www/_ubuntu_24/node/node-v24.11.1/pnpm-global/bin:/www/_ubuntu_24/node/node-v24.11.1/bin:/www/_ubuntu_24/node/node-v22.21.0/bin:$PATH"

# Detect available package manager
PKG_MANAGER=""
if [ -f "pnpm-lock.yaml" ] && command -v pnpm >/dev/null 2>&1; then
    PKG_MANAGER="pnpm"
    echo "Using package manager: pnpm"
elif [ -f "yarn.lock" ] && command -v yarn >/dev/null 2>&1; then
    PKG_MANAGER="yarn"
    echo "Using package manager: yarn"
elif [ -f "package-lock.json" ] && command -v npm >/dev/null 2>&1; then
    PKG_MANAGER="npm"
    echo "Using package manager: npm"
else
    # Fallback to any available package manager
    if command -v pnpm >/dev/null 2>&1; then
        PKG_MANAGER="pnpm"
        echo "Using package manager: pnpm (fallback)"
    elif command -v yarn >/dev/null 2>&1; then
        PKG_MANAGER="yarn"
        echo "Using package manager: yarn (fallback)"
    elif command -v npm >/dev/null 2>&1; then
        PKG_MANAGER="npm"
        echo "Using package manager: npm (fallback)"
    else
        echo "ERROR: No package manager found (pnpm, yarn, or npm)"
        exit 1
    fi
fi

# Check and install dependencies
if [ ! -d "node_modules" ]; then
    echo "node_modules not found, installing dependencies..."
    $PKG_MANAGER install
fi

# Set environment variables
export HOST=0.0.0.0
export PORT={port}
export VITE_PORT={port}
{env_vars}

# Start application
exec $PKG_MANAGER run {script_cmd}
"""

    def _format_env_vars(self, extra_env: Optional[dict]) -> str:
        """Format extra environment variables for bash script"""
        if not extra_env:
            return ""

        lines = []
        for key, value in extra_env.items():
            lines.append(f'export {key}="{value}"')

        return "\n".join(lines)

    def remove_launcher(self, service_name: str) -> bool:
        """
        Remove launcher script for a service

        Args:
            service_name: Name of the service

        Returns:
            True if removed successfully, False otherwise
        """
        launcher_path = self.launcher_dir / f"{service_name}.sh"

        if launcher_path.exists():
            launcher_path.unlink()
            return True

        return False


def main():
    """Test launcher generator"""
    generator = LauncherGenerator()

    # Test React launcher
    launcher = generator.generate_launcher(
        service_name="test-react-app",
        app_path="/www/programing/core_node/apps/test_app",
        framework_type="reactStart",
        port=3000,
        debug_mode=True
    )

    print(f"Generated launcher: {launcher}")
    print("\nLauncher content:")
    print(Path(launcher).read_text())


if __name__ == "__main__":
    main()
