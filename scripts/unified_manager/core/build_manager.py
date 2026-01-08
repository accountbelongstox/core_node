#!/usr/bin/env python3
"""
Build Manager for Unified App Manager
Intelligently builds different types of projects before creating services
"""

import os
import subprocess
import json
from pathlib import Path
from typing import Optional, Dict, Tuple


class BuildManager:
    """Handles intelligent building of different project types"""

    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.build_dir_base = Path("/www/_build_dir")

    def detect_project_type(self, app_path: str) -> Tuple[str, Dict]:
        """
        Detect project type and return build configuration
        Returns: (project_type, build_config)
        """
        app_path = Path(app_path)

        # React/Next.js projects
        if (app_path / "package.json").exists():
            package_json = json.loads((app_path / "package.json").read_text())
            dependencies = package_json.get("dependencies", {})
            dev_dependencies = package_json.get("devDependencies", {})
            scripts = package_json.get("scripts", {})

            # Check for Next.js
            if "next" in dependencies or "next" in dev_dependencies:
                return "nextjs", {
                    "build_command": "pnpm build" if (app_path / "pnpm-lock.yaml").exists() else "npm run build",
                    "start_command": "pnpm start" if (app_path / "pnpm-lock.yaml").exists() else "npm start",
                    "output_dir": ".next",
                    "needs_node": True
                }

            # Check for React (Vite/CRA)
            if "react" in dependencies:
                if "vite" in dev_dependencies:
                    return "react-vite", {
                        "build_command": "pnpm build" if (app_path / "pnpm-lock.yaml").exists() else "npm run build",
                        "start_command": "pnpm preview --port {port} --host 0.0.0.0" if (app_path / "pnpm-lock.yaml").exists() else "npm run preview -- --port {port} --host 0.0.0.0",
                        "output_dir": "dist",
                        "needs_node": True,
                        "is_static": True
                    }
                else:
                    return "react-cra", {
                        "build_command": "pnpm build" if (app_path / "pnpm-lock.yaml").exists() else "npm run build",
                        "start_command": "npx serve -s build -l {port}",
                        "output_dir": "build",
                        "needs_node": True,
                        "is_static": True
                    }

            # Check for Vue
            if "vue" in dependencies:
                if "vite" in dev_dependencies:
                    return "vue-vite", {
                        "build_command": "pnpm build" if (app_path / "pnpm-lock.yaml").exists() else "npm run build",
                        "start_command": "pnpm preview --port {port} --host 0.0.0.0" if (app_path / "pnpm-lock.yaml").exists() else "npm run preview -- --port {port} --host 0.0.0.0",
                        "output_dir": "dist",
                        "needs_node": True,
                        "is_static": True
                    }
                else:
                    return "vue", {
                        "build_command": "pnpm build" if (app_path / "pnpm-lock.yaml").exists() else "npm run build",
                        "start_command": "npx serve -s dist -l {port}",
                        "output_dir": "dist",
                        "needs_node": True,
                        "is_static": True
                    }

        # Nuxt projects
        if (app_path / "nuxt.config.ts").exists() or (app_path / "nuxt.config.js").exists():
            return "nuxt", {
                "build_command": "pnpm build" if (app_path / "pnpm-lock.yaml").exists() else "npm run build",
                "start_command": "node .output/server/index.mjs",
                "output_dir": ".output",
                "needs_node": True,
                "port_env": "PORT"
            }

        # Laravel projects
        if (app_path / "artisan").exists() and (app_path / "composer.json").exists():
            return "laravel", {
                "build_command": "composer install --no-dev --optimize-autoloader",
                "start_command": "php artisan serve --host=0.0.0.0 --port={port}",
                "output_dir": None,
                "needs_node": False
            }

        # Flutter projects
        if (app_path / "pubspec.yaml").exists():
            return "flutter", {
                "build_command": "flutter build web",
                "start_command": "python3 -m http.server {port} --directory {build_output_path} --bind 0.0.0.0",
                "output_dir": "build/web",
                "needs_node": False,
                "is_static": True
            }

        return "unknown", {}

    def build_project(self, app_path: str, app_name: str, project_type: str = None) -> Tuple[bool, str, Optional[str]]:
        """
        Build the project and return success status, message, and build output path
        Returns: (success, message, build_output_path)
        """
        app_path = Path(app_path)

        # Auto-detect if type not provided
        if not project_type:
            project_type, build_config = self.detect_project_type(app_path)
        else:
            _, build_config = self.detect_project_type(app_path)

        if project_type == "unknown":
            return False, "Unknown project type - cannot build", None

        build_command = build_config.get("build_command")
        if not build_command:
            return False, f"No build command defined for {project_type}", None

        # Create build directory
        build_output_base = self.build_dir_base / app_name
        build_output_base.mkdir(parents=True, exist_ok=True)

        print(f"\n{'='*80}")
        print(f"Building {project_type} project: {app_name}")
        print(f"{'='*80}\n")
        print(f"Project path: {app_path}")
        print(f"Build command: {build_command}")
        print(f"Build output: {build_output_base}")
        print()

        # Change to project directory
        original_dir = os.getcwd()
        try:
            os.chdir(app_path)

            # Install dependencies first if needed
            if "package.json" in str(app_path):
                print("Installing dependencies...")
                if (app_path / "pnpm-lock.yaml").exists():
                    subprocess.run(["pnpm", "install"], check=True)
                elif (app_path / "package-lock.json").exists():
                    subprocess.run(["npm", "install"], check=True)
                elif (app_path / "yarn.lock").exists():
                    subprocess.run(["yarn", "install"], check=True)
                print()

            # Run build command
            print(f"Running build: {build_command}")
            result = subprocess.run(
                build_command.split(),
                check=True,
                capture_output=False,
                text=True
            )

            # Copy build output to build directory
            output_dir = build_config.get("output_dir")
            if output_dir:
                source = app_path / output_dir
                if source.exists():
                    import shutil
                    dest = build_output_base / output_dir
                    if dest.exists():
                        shutil.rmtree(dest)
                    shutil.copytree(source, dest)
                    print(f"\nBuild artifacts copied to: {dest}")
                    build_output_path = str(dest)
                else:
                    print(f"\nWarning: Output directory {output_dir} not found")
                    build_output_path = str(app_path / output_dir)
            else:
                build_output_path = str(app_path)

            print(f"\n{'='*80}")
            print(f"Build completed successfully!")
            print(f"{'='*80}\n")

            return True, f"Build successful for {project_type} project", build_output_path

        except subprocess.CalledProcessError as e:
            return False, f"Build failed: {str(e)}", None
        except Exception as e:
            return False, f"Build error: {str(e)}", None
        finally:
            os.chdir(original_dir)

    def generate_build_start_command(self, app_path: str, build_output_path: str, project_type: str = None, port: int = None) -> Optional[str]:
        """
        Generate the appropriate start command for the built project using official recommended methods
        """
        app_path = Path(app_path)
        port_str = str(port) if port else "10000"  # Default port matches unified_config.ini base_port

        if not project_type:
            project_type, build_config = self.detect_project_type(app_path)
        else:
            _, build_config = self.detect_project_type(app_path)

        # Get start command from config
        start_command = build_config.get("start_command")

        if start_command:
            # Replace placeholders in start command
            start_command = start_command.replace("{port}", port_str)
            start_command = start_command.replace("{build_output_path}", build_output_path)

            # For Node.js projects, run from app directory
            if build_config.get("needs_node", False):
                # Check if command needs PORT environment variable
                if build_config.get("port_env"):
                    return f"cd {app_path} && PORT={port_str} {start_command}"
                else:
                    return f"cd {app_path} && {start_command}"
            else:
                # For non-Node projects (PHP, Flutter, etc)
                return f"cd {app_path} && {start_command}"

        # Fallback: For static projects without specific start command, use python http.server
        if build_config.get("is_static", False):
            return f"python3 -m http.server {port_str} --directory {build_output_path} --bind 0.0.0.0"

        return None


__all__ = ['BuildManager']
