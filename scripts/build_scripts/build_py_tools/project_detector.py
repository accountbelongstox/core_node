#!/usr/bin/env python3

import json
import os
from pathlib import Path
from keys_center import KeysCenter
from file_var_handler import FileVarHandler

class ProjectDetector:
    def __init__(self, scan_base_path, base_port=10000):
        self.scan_base_path = Path(scan_base_path)
        self.base_port = base_port
        self.var_handler = FileVarHandler()
        self.projects = []
        self.port_assignments = {}

    def detect_project_type(self, project_path):
        project_path = Path(project_path)
        package_json = project_path / "package.json"
        pubspec_yaml = project_path / "pubspec.yaml"
        composer_json = project_path / "composer.json"
        nuxt_config_ts = project_path / "nuxt.config.ts"
        nuxt_config_js = project_path / "nuxt.config.js"
        next_config_js = project_path / "next.config.js"
        vite_config_js = project_path / "vite.config.js"
        vite_config_ts = project_path / "vite.config.ts"

        if nuxt_config_ts.exists() or nuxt_config_js.exists():
            return KeysCenter.PROJECT_TYPE_NUXT

        if next_config_js.exists():
            return KeysCenter.PROJECT_TYPE_NEXT

        if pubspec_yaml.exists():
            return KeysCenter.PROJECT_TYPE_FLUTTER

        if composer_json.exists() and (project_path / "artisan").exists():
            return KeysCenter.PROJECT_TYPE_LARAVEL

        if package_json.exists():
            try:
                with open(package_json, 'r', encoding='utf-8') as f:
                    pkg_data = json.load(f)
                    dependencies = pkg_data.get("dependencies", {})
                    dev_dependencies = pkg_data.get("devDependencies", {})

                    if "react-native" in dependencies or "react-native" in dev_dependencies:
                        android_dir = project_path / "android"
                        ios_dir = project_path / "ios"
                        if android_dir.exists() or ios_dir.exists():
                            return KeysCenter.PROJECT_TYPE_REACT_NATIVE

                    if vite_config_js.exists() or vite_config_ts.exists():
                        if "react" in dependencies or "react" in dev_dependencies:
                            return KeysCenter.PROJECT_TYPE_REACT
                        if "vue" in dependencies or "vue" in dev_dependencies:
                            return KeysCenter.PROJECT_TYPE_VUE
                        return KeysCenter.PROJECT_TYPE_VITE

                    if "react" in dependencies or "react" in dev_dependencies:
                        return KeysCenter.PROJECT_TYPE_REACT

                    if "vue" in dependencies or "vue" in dev_dependencies:
                        return KeysCenter.PROJECT_TYPE_VUE
            except Exception as e:
                print(f"Error reading package.json in {project_path}: {e}")

        return KeysCenter.PROJECT_TYPE_UNKNOWN

    def scan_projects(self):
        if not self.scan_base_path.exists():
            print(f"Error: Scan base path does not exist: {self.scan_base_path}")
            return []

        current_port = self.base_port

        for item in sorted(self.scan_base_path.iterdir()):
            if item.is_dir() and not item.name.startswith('.'):
                project_type = self.detect_project_type(item)

                if project_type != KeysCenter.PROJECT_TYPE_UNKNOWN:
                    project_info = {
                        KeysCenter.KEY_PROJECT_NAME: item.name,
                        KeysCenter.KEY_PROJECT_PATH: str(item.absolute()),
                        KeysCenter.KEY_PROJECT_TYPE: project_type,
                        KeysCenter.KEY_PROJECT_PORT: current_port,
                    }

                    self.projects.append(project_info)
                    self.port_assignments[item.name] = current_port

                    print(f"Detected: {item.name} [{project_type}] on port {current_port}")
                    current_port += 1

        return self.projects

    def save_results(self):
        results_data = "\n".join([json.dumps(p) for p in self.projects])
        self.var_handler.set_var(KeysCenter.KEY_SCAN_RESULTS, results_data)

        port_data = json.dumps(self.port_assignments)
        self.var_handler.set_var(KeysCenter.KEY_PORT_ASSIGNMENTS, port_data)

        self.var_handler.set_var(KeysCenter.KEY_BASE_PORT, str(self.base_port))
        self.var_handler.set_var(KeysCenter.KEY_SCAN_BASE_PATH, str(self.scan_base_path))

        import time
        self.var_handler.set_var(KeysCenter.KEY_LAST_SCAN_TIMESTAMP, str(int(time.time())))

        print(f"\nScan complete: {len(self.projects)} projects found")
        print(f"Results saved to global variables")

if __name__ == "__main__":
    import sys

    script_dir = Path(__file__).parent.absolute()
    core_node_dir = script_dir.parent.parent.parent
    poly_apps_dir = core_node_dir / "poly_apps"

    if len(sys.argv) > 1:
        poly_apps_dir = Path(sys.argv[1])

    base_port = 10000
    if len(sys.argv) > 2:
        try:
            base_port = int(sys.argv[2])
        except ValueError:
            print(f"Invalid base port: {sys.argv[2]}, using default 10000")

    print(f"Scanning projects in: {poly_apps_dir}")
    print(f"Base port: {base_port}")
    print("-" * 60)

    detector = ProjectDetector(poly_apps_dir, base_port)
    detector.scan_projects()
    detector.save_results()
