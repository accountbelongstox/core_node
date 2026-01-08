# Official Production Start Commands

This document describes the official recommended start commands for built applications across different frameworks.

## Framework-Specific Start Commands

### 1. React with Vite
- **Build**: `npm run build` → outputs to `dist/`
- **Official Start**: `npm run preview -- --port {port} --host 0.0.0.0`
- **Reference**: [Vite Guide - Static Deploy](https://vitejs.dev/guide/static-deploy.html)
- **Why**: Vite preview command is the official way to test production builds locally

**Generated Command**:
```bash
cd {app_path} && pnpm preview --port 10000 --host 0.0.0.0
```

---

### 2. React with Create React App (CRA)
- **Build**: `npm run build` → outputs to `build/`
- **Official Start**: `npx serve -s build -l {port}`
- **Reference**: [CRA Deployment](https://create-react-app.dev/docs/deployment/)
- **Why**: CRA officially recommends `serve` package for serving production builds

**Generated Command**:
```bash
cd {app_path} && npx serve -s build -l 10000
```

---

### 3. Vue with Vite
- **Build**: `npm run build` → outputs to `dist/`
- **Official Start**: `npm run preview -- --port {port} --host 0.0.0.0`
- **Reference**: [Vite Guide - Static Deploy](https://vitejs.dev/guide/static-deploy.html)
- **Why**: Same as React-Vite, using Vite's preview command

**Generated Command**:
```bash
cd {app_path} && npm run preview -- --port 10000 --host 0.0.0.0
```

---

### 4. Nuxt (SSR)
- **Build**: `npm run build` → outputs to `.output/`
- **Official Start**: `node .output/server/index.mjs`
- **Reference**: [Nuxt Deployment](https://nuxt.com/docs/getting-started/deployment)
- **Why**: Nuxt builds SSR server that must be started with Node.js
- **Note**: Requires PORT environment variable

**Generated Command**:
```bash
cd {app_path} && PORT=10000 node .output/server/index.mjs
```

---

### 5. Next.js (SSR)
- **Build**: `npm run build` → outputs to `.next/`
- **Official Start**: `npm run start` or `next start`
- **Reference**: [Next.js Deployment](https://nextjs.org/docs/deployment)
- **Why**: Next.js requires its own Node.js server for SSR/ISR features

**Generated Command**:
```bash
cd {app_path} && npm start
```

---

### 6. Laravel
- **Build**: `composer install --no-dev --optimize-autoloader`
- **Official Start**: `php artisan serve --host=0.0.0.0 --port={port}`
- **High Performance Option**: Laravel Octane
  - Swoole: `php artisan octane:start --server=swoole --host=0.0.0.0 --port={port}`
  - RoadRunner: `php artisan octane:start --server=roadrunner --host=0.0.0.0 --port={port}`
- **Reference**: [Laravel Octane](https://laravel.com/docs/octane)

**Generated Command**:
```bash
cd {app_path} && php artisan serve --host=0.0.0.0 --port=10000
```

---

### 7. Flutter Web
- **Build**: `flutter build web` → outputs to `build/web/`
- **Official Start**: Any static file server
- **Reference**: [Flutter Web Deployment](https://docs.flutter.dev/deployment/web)
- **Why**: Flutter web builds are purely static files

**Generated Command**:
```bash
cd {app_path} && python3 -m http.server 10000 --directory /www/_build_dir/app/build/web --bind 0.0.0.0
```

---

## Key Differences: SSR vs Static

### SSR Applications (Must use Node.js/PHP server):
- **Next.js**: Requires `next start` for server-side rendering
- **Nuxt**: Requires `node .output/server/index.mjs` for SSR
- **Laravel**: Requires PHP runtime

❌ **Cannot use static file servers like nginx/serve/http.server**

### Static Applications (Can use any static server):
- **React-Vite**: Pure static after build
- **React-CRA**: Pure static after build
- **Vue-Vite**: Pure static after build
- **Flutter Web**: Pure static after build

✅ **Can use any static server, but prefer official preview/serve**

---

## Implementation in BuildManager

The `BuildManager.generate_build_start_command()` method uses this logic:

```python
def generate_build_start_command(self, app_path, build_output_path, project_type, port):
    # 1. Get project config with official start_command
    start_command = config.get("start_command")

    # 2. Replace placeholders
    start_command = start_command.replace("{port}", port)
    start_command = start_command.replace("{build_output_path}", build_output_path)

    # 3. Add PORT env if needed (Nuxt)
    if config.get("port_env"):
        return f"cd {app_path} && PORT={port} {start_command}"

    # 4. Run from app directory for Node.js projects
    if config.get("needs_node"):
        return f"cd {app_path} && {start_command}"

    # 5. Fallback to python http.server (static projects only)
    if config.get("is_static") and not start_command:
        return f"python3 -m http.server {port} --directory {build_output_path}"
```

---

## References

- **Vite**: https://vitejs.dev/guide/static-deploy.html
- **Next.js**: https://nextjs.org/docs/deployment
- **Nuxt**: https://nuxt.com/docs/getting-started/deployment
- **Create React App**: https://create-react-app.dev/docs/deployment/
- **Laravel Octane**: https://laravel.com/docs/octane
- **Flutter Web**: https://docs.flutter.dev/deployment/web

---

**Last Updated**: 2025-01-09
**Author**: Claude Code
**Related**: build_manager.py, service_file_generator.py
