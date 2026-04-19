# App Manager - Windows PS1 Configuration
# Central config for scan paths, ports, and command templates (Windows)

$Script:AppManagerConfig = @{
    BasePort      = 10000
    PortRange     = 5000
    AutoIncrement = $true
}

# Command templates: placeholder keys {app_path}, {app_name}, {port}, {root_dir}
# Windows: use "cd /d `"{app_path}`" && ..." or "Set-Location ...; ..." for PowerShell; we use cmd-style for compatibility
$Script:CommandTemplates = @{
    react_dev     = 'cd /d "{app_path}" && pnpm run dev'
    react_build   = 'cd /d "{app_path}" && pnpm run build && pnpm start'
    reactnative_dev = 'cd /d "{app_path}" && pnpm run dev'
    reactnative_build = 'cd /d "{app_path}" && pnpm run build && pnpm start'
    vue_dev       = 'cd /d "{app_path}" && pnpm run dev'
    vue_build     = 'cd /d "{app_path}" && pnpm run build && pnpm start'
    nuxt_dev      = 'cd /d "{app_path}" && pnpm run dev'
    nuxt_build    = 'cd /d "{app_path}" && pnpm run build && pnpm start'
    laravel_dev   = 'cd /d "{app_path}" && php artisan serve --host=0.0.0.0 --port={port}'
    laravel_prod  = 'cd /d "{app_path}" && php artisan serve --host=0.0.0.0 --port={port} --env=production'
    flutter_dev   = 'cd /d "{app_path}" && flutter run -d web-server --web-hostname=0.0.0.0 --web-port={port}'
    flutter_build = 'cd /d "{app_path}" && flutter build web'
    kotlin_dev    = 'cd /d "{app_path}" && .\gradlew.bat run'
    php_dev       = 'php -S 0.0.0.0:{port} -t "{app_path}"'
    python_dev    = 'python "{app_path}\main.py"'
    ncore_dev     = 'node "{root_dir}\main.js" app={app_name}'
    pycore_dev    = 'python "{root_dir}\pymain.py" app={app_name}'
    polyLauncher  = 'cd /d "{app_path}" && pnpm run dev'
}

# Framework detection: priority order and entry patterns per type
$Script:FrameworkPriority = @(
    'reactNativeStart', 'nuxtStart', 'reactStart', 'vueStart',
    'laravelStart', 'flutterStart', 'kotlinMultiPlatformStart', 'phpStart', 'pyStart', 'polyLauncher'
)

$Script:EntryPoints = @(
    'main.py', 'main.js', 'package.json', 'composer.json', 'pubspec.yaml',
    'index.php', 'build.gradle', 'build.gradle.kts', 'nuxt.config.js', 'nuxt.config.ts'
)
