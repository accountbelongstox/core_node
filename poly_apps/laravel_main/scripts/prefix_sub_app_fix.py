# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

import os
import sys
import shutil
from pathlib import Path

def get_all_subs(apps_dir):
    return [d.name for d in apps_dir.iterdir() if d.is_dir()]

def remove_existing_prefix(name, prefixes):
    for prefix in prefixes:
        if name.startswith(prefix):
            return name[len(prefix):]
    return name

def fix_name_with_prefix(name, prefix, all_prefixes):
    clean_name = remove_existing_prefix(name, all_prefixes)
    return prefix + clean_name

def rename_entity(path, new_name):
    new_path = path.parent / new_name
    if new_path != path:
        print(f"Renaming: {path} -> {new_path}")
        path.rename(new_path)
    return new_path

def process_directory(base_dir, prefix, all_prefixes):
    for root, dirs, files in os.walk(base_dir, topdown=False):
        root_path = Path(root)

        # Rename files
        for file_name in files:
            correct_name = fix_name_with_prefix(file_name, prefix, all_prefixes)
            if correct_name != file_name:
                old_file_path = root_path / file_name
                rename_entity(old_file_path, correct_name)

        # Rename dirs
        for dir_name in dirs:
            correct_name = fix_name_with_prefix(dir_name, prefix, all_prefixes)
            if correct_name != dir_name:
                old_dir_path = root_path / dir_name
                rename_entity(old_dir_path, correct_name)

def fix_controller_names(base_dir):
    for root, _, files in os.walk(base_dir):
        root_path = Path(root)
        for file_name in files:
            if "Controller" in file_name:
                old_file_path = root_path / file_name
                new_file_name = file_name.replace("Controller", "Ctl")
                new_file_path = root_path / new_file_name
                if not new_file_path.exists():
                    print(f"[Controller Fix] Renaming: {old_file_path} -> {new_file_path}")
                    old_file_path.rename(new_file_path)

def ensure_router_dirs(subs, routes_root):
    routes_root.mkdir(parents=True, exist_ok=True)
    for sub in subs:
        router_dir = routes_root / f"{sub}Router"
        if not router_dir.exists():
            router_dir.mkdir()
            print(f"[Router] Created: {router_dir}")
        else:
            print(f"[Router] Exists: {router_dir}")

def fix_router_files(routes_root, subapp_name, all_prefixes):
    router_dir = routes_root / f"{subapp_name}Router"
    if not router_dir.exists():
        return
    for root, _, files in os.walk(router_dir):
        root_path = Path(root)
        for file_name in files:
            fixed_name = remove_existing_prefix(file_name, all_prefixes)
            fixed_name = subapp_name + fixed_name
            if not fixed_name[0].isupper():
                fixed_name = fixed_name[0].upper() + fixed_name[1:]

            if file_name != fixed_name:
                old_path = root_path / file_name
                new_path = root_path / fixed_name
                print(f"[Router File Fix] Renaming: {old_path} -> {new_path}")
                old_path.rename(new_path)

def print_directory_tree(root_path: Path, indent=""):
    for item in sorted(root_path.iterdir()):
        if item.is_dir():
            print(f"{indent}📁 {item.name}")
            print_directory_tree(item, indent + "  ")
        else:
            print(f"{indent}📄 {item.name}")

def replace_namespace_in_file(file_path, old_namespace, new_namespace):
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        if old_namespace in content:
            new_content = content.replace(old_namespace, new_namespace)
            with open(file_path, 'w', encoding='utf-8') as file:
                file.write(new_content)
            print(f"[Namespace] Updated in {file_path}")
    except Exception as e:
        print(f"[Namespace Error] Failed to process {file_path}: {str(e)}")

def process_namespace_replacement(directory, template_name, new_app_name):
    for root, _, files in os.walk(directory):
        for file_name in files:
            if file_name.endswith('.php'):
                file_path = Path(root) / file_name
                replace_namespace_in_file(file_path, template_name, new_app_name)

def copy_template_app(apps_root, routes_root, new_app, template_app):
    src = apps_root / template_app
    dst = apps_root / new_app
    if dst.exists():
        print(f"[COPY ERROR] Target {new_app} already exists.")
        return False
    shutil.copytree(src, dst)
    print(f"[COPY] Copied {template_app} -> {new_app}")

    # Process namespace replacement in the copied files
    process_namespace_replacement(dst, template_app, new_app)

    # Copy router template
    src_router = routes_root / f"{template_app}Router"
    dst_router = routes_root / f"{new_app}Router"
    if src_router.exists() and not dst_router.exists():
        shutil.copytree(src_router, dst_router)
        print(f"[COPY] Copied router {template_app}Router -> {new_app}Router")
        
        # Process namespace replacement in router files
        process_namespace_replacement(dst_router, template_app, new_app)
    return True

def prompt_template_choice(subs):
    print("\n🔽 Subapp not found. Select a template to clone:")
    for i, name in enumerate(subs):
        print(f"  {i+1}. {name}")
    try:
        choice = int(input("Enter number: ").strip())
        if 1 <= choice <= len(subs):
            return subs[choice - 1]
    except:
        pass
    print("❌ Invalid choice.")
    sys.exit(1)

def show_usage():
    print("\n📘 Usage:")
    print("  python script.py init <SubAppName>     Initialize or create a sub app from template")
    print("  python script.py                       Process all apps and routes\n")

def main():
    script_path = Path(__file__).resolve()
    apps_root = (script_path.parent / "../app/Apps").resolve()
    app_root = apps_root.parent
    routes_root = (script_path.parent / "../routes").resolve()

    if not apps_root.exists():
        print(f"❌ Apps directory not found: {apps_root}")
        sys.exit(1)

    args = sys.argv[1:]
    if not args:
        show_usage()

    if args and args[0] == "init":
        if len(args) < 2:
            show_usage()
            sys.exit(1)

        app_name = args[1]
        target_dir = apps_root / app_name

        subs = get_all_subs(apps_root)

        if not target_dir.exists():
            if not subs:
                print("❌ No existing subapps to clone.")
                sys.exit(1)
            template = prompt_template_choice(subs)
            copy_template_app(apps_root, routes_root, app_name, template)

        print(f"[INIT MODE] Working on: {app_name}")
        subs = get_all_subs(apps_root)
        process_directory(apps_root / app_name, app_name, subs)
        process_directory(apps_root / app_name, app_name, subs)
        fix_controller_names(apps_root / app_name)
        ensure_router_dirs([app_name], routes_root)
        fix_router_files(routes_root, app_name, subs)

    else:
        subs = get_all_subs(apps_root)
        print(f"[FULL MODE] Subapps found: {subs}")
        for sub in subs:
            print(f"\n--- Processing: {sub} ---")
            process_directory(apps_root / sub, sub, subs)
            fix_controller_names(apps_root / sub)
            ensure_router_dirs([sub], routes_root)
            fix_router_files(routes_root, sub, subs)

    print("\n📦 Final directory structure under ../app:")
    print_directory_tree(app_root)

    print("\n📦 Final directory structure under ../routes:")
    print_directory_tree(routes_root)

if __name__ == "__main__":
    main()