import argparse
import configparser
import json
import os
import shutil
import sys
from pathlib import Path
import xml.etree.ElementTree as ET
import re

try:
    from PIL import Image, ImageOps
except ImportError:
    Image = None
    ImageOps = None


SKIP_DIRS = {".git", "node_modules"}
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".bmp", ".heic", ".heif"}


def read_config(root: Path, namespace: str) -> dict:
    cfg = {
        "AppName": namespace,
        "DisplayNameEnglish": "",
        "DisplayNameChinese": "",
        "IconFile": "logo.png",
        "UseExternalSafeBuild": True,
        "PackageId": "com.anwuyou.app",
        "RandomPackageId": False,
        "RootProjectName": "",
    }
    cfg_path = root / "src" / "apps" / namespace / "build_config.ini"
    if not cfg_path.exists():
        return cfg

    parser = configparser.ConfigParser()
    parser.read(cfg_path, encoding="utf-8")

    if parser.has_option("app_info", "app_name"):
        val = parser.get("app_info", "app_name").strip()
        if val:
            cfg["AppName"] = val

    if parser.has_option("app_info", "display_name_english"):
        val = parser.get("app_info", "display_name_english").strip()
        if val:
            cfg["DisplayNameEnglish"] = val

    if parser.has_option("app_info", "display_name_chinese"):
        val = parser.get("app_info", "display_name_chinese").strip()
        if val:
            cfg["DisplayNameChinese"] = val

    if parser.has_option("resources", "icon_file"):
        val = parser.get("resources", "icon_file").strip()
        if val:
            cfg["IconFile"] = val

    if parser.has_option("package_settings", "default_package_id"):
        val = parser.get("package_settings", "default_package_id").strip()
        if val:
            cfg["PackageId"] = val
    if parser.has_option("package_settings", "random_package_id"):
        cfg["RandomPackageId"] = parser.getboolean(
            "package_settings", "random_package_id", fallback=False
        )

    if parser.has_option("package_settings", "root_project_name"):
        val = parser.get("package_settings", "root_project_name").strip()
        if val:
            cfg["RootProjectName"] = val

    if parser.has_option("build_settings", "use_external_safe_build"):
        cfg["UseExternalSafeBuild"] = parser.getboolean(
            "build_settings", "use_external_safe_build", fallback=True
        )

    return cfg


def sanitize_app_name(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)


def count_files(src: Path) -> int:
    total = 0
    for root, dirs, files in os.walk(src):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        total += len(files)
    return total


def sync_tree(src: Path, dst: Path) -> int:
    print(f"[SYNC] Source: {src}")
    print(f"[SYNC] Target: {dst}")
    dst.mkdir(parents=True, exist_ok=True)

    total = count_files(src)
    print(f"[SYNC] Total files to process: {total}")

    copied = 0
    skipped = 0
    processed = 0

    for root, dirs, files in os.walk(src):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        rel = Path(root).relative_to(src)
        target_dir = dst / rel
        target_dir.mkdir(parents=True, exist_ok=True)

        for name in files:
            s = Path(root) / name
            t = target_dir / name
            processed += 1
            try:
                shutil.copy2(s, t)
                copied += 1
            except Exception as exc:
                skipped += 1
                print(f"\n[SYNC] Skip: {s} ({exc})")
            progress = f"[SYNC] Progress {processed}/{total} copied={copied} skipped={skipped}"
            print(progress, end="\r", flush=True)

    print()
    print(f"[SYNC] Copy done. Files copied: {copied}, skipped: {skipped}")
    return 0


def find_first(root: Path, filename: str) -> Path | None:
    for p in root.rglob(filename):
        if p.is_file():
            return p
    return None


def copy_icon(root: Path, namespace: str, default_name: str):
    source_root = root / f"assets/apps/app_{namespace}"
    icon_source = find_first(source_root, default_name)

    if not icon_source:
        print(f"[ICON] Not found: {default_name} under {source_root}", file=sys.stderr)
        return 1, None, []

    print(f"[ICON] Using source: {icon_source}")
    return 0, icon_source, []


def _density_from_path(path: Path) -> str:
    parts = path.parts
    for p in parts:
        if p.startswith("mipmap-"):
            return p.split("mipmap-")[1].split("-")[0]
    return ""


def _expected_size_for_density(density: str) -> tuple[int, int]:
    base = 48  # mdpi launcher default
    factors = {
        "mdpi": 1.0,
        "hdpi": 1.5,
        "xhdpi": 2.0,
        "xxhdpi": 3.0,
        "xxxhdpi": 4.0,
    }
    factor = factors.get(density, 1.0)
    size = int(base * factor)
    return size, size


def replace_launchers_with_logo(root: Path, logo_path: Path):
    res_dir = root / "android"
    targets = list(res_dir.rglob("mipmap*/*ic_launcher*.png"))
    if not targets:
        print("[ICON] No launcher icons found to replace.")
        return []

    if Image is None or ImageOps is None:
        print("[ICON] Pillow not available; copying logo without resizing.", file=sys.stderr)
        replaced = []
        for t in targets:
            t.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(logo_path, t)
            replaced.append((logo_path, t))
        return replaced

    src_img = Image.open(logo_path).convert("RGBA")
    replaced = []
    for t in targets:
        size = None
        if t.exists():
            try:
                with Image.open(t) as im_target:
                    size = im_target.size
            except Exception:
                size = None
        if size is None:
            density = _density_from_path(t)
            size = _expected_size_for_density(density)
        try:
            fitted = ImageOps.fit(src_img, size, method=Image.Resampling.LANCZOS)
            fitted.save(t, format="PNG")
            print(f"[ICON] Replaced {t} with resized logo {size}")
            replaced.append((logo_path, t))
        except Exception as exc:
            print(f"[ICON] Failed to replace {t}: {exc}", file=sys.stderr)
    return replaced


def copy_android_resources(root: Path, namespace: str):
    src_dir = root / f"assets/apps/app_{namespace}"
    dest_dir = root / "android"

    found = []
    unmapped = []
    android_assets = []

    for item in src_dir.rglob("*"):
        if not item.is_file():
            continue
        rel = item.relative_to(src_dir)
        rel_parts = rel.parts

        # map only res-like paths: android/res/<...> or direct res/<...>
        if len(rel_parts) >= 2 and rel_parts[0].lower() == "android" and rel_parts[1].lower() == "res":
            target_rel = Path(*rel_parts[2:])
            target = dest_dir / target_rel
            target.parent.mkdir(parents=True, exist_ok=True)
            try:
                shutil.copy2(item, target)
                found.append((item, target))
            except Exception as exc:
                print(f"[RES] Skip {item}: {exc}", file=sys.stderr)
        elif rel_parts[0].lower() == "res":
            target_rel = Path(*rel_parts[1:])
            target = dest_dir / target_rel
            target.parent.mkdir(parents=True, exist_ok=True)
            try:
                shutil.copy2(item, target)
                found.append((item, target))
            except Exception as exc:
                print(f"[RES] Skip {item}: {exc}", file=sys.stderr)
        else:
            unmapped.append(item)
        if len(rel_parts) > 0 and rel_parts[0].lower() == "android":
            android_assets.append(item)

    return found, unmapped, android_assets


def apply_resources(root: Path, namespace: str, icon_file: str) -> int:
    def is_image(p: Path) -> bool:
        name = p.name.lower()
        if name.endswith(".9.png"):
            return True
        return p.suffix.lower() in IMAGE_EXTS

    assets_root = root / f"assets/apps/app_{namespace}"
    all_files = [p for p in assets_root.rglob("*") if p.is_file()]
    all_images = [p for p in all_files if is_image(p)]

    # Print all images under android/ before any mapping.
    android_root = root / "android"
    android_all_images = [p for p in android_root.rglob("*") if p.is_file() and is_image(p)]
    print("[RES] android/ images (pre-copy):")
    if android_all_images:
        for img in android_all_images:
            print(f" - {img}")
    else:
        print(" - (none)")

    icon_rc, icon_src, _ = copy_icon(root, namespace, icon_file)
    res_mapped, res_unmapped, android_assets = copy_android_resources(root, namespace)

    replaced = []
    if icon_src:
        replaced = replace_launchers_with_logo(root, icon_src)

    mapped_pairs = res_mapped + replaced
    mapped_sources = {src for src, _ in mapped_pairs}

    unmapped_extra = [p for p in all_files if p not in mapped_sources]
    unmapped = [u for u in (res_unmapped + unmapped_extra) if u not in mapped_sources]

    print("[RES] All asset files:")
    for f in all_files:
        print(f" - {f}")
    print("[RES] All asset images:")
    if all_images:
        for img in all_images:
            print(f" - {img}")
    else:
        print(" - (none)")

    print("[RES] Mapped files:")
    for src, dst in mapped_pairs:
        print(f" - {src} -> {dst}")
    if unmapped:
        print("[RES] Unmapped files:")
        for u in unmapped:
            print(f" - {u}")
    # Show android/ subtree files and highlight those not mapped
    print("[RES] android/ subtree files:")
    if android_assets:
        for a in android_assets:
            print(f" - {a}")
    else:
        print(" - (none)")
    android_unmapped = [p for p in android_assets if p not in mapped_sources]
    if android_unmapped:
        print("[RES] android/ subtree files not mapped; app may show default/dev assets:")
        for u in android_unmapped:
            print(f" - {u}")

    # Also list images currently present under android/ after copy
    res_dir = root / "android"
    res_images = [p for p in res_dir.rglob("*") if p.is_file() and is_image(p)]
    print("[RES] Android images under android/ after copy:")
    if res_images:
        for img in res_images:
            print(f" - {img}")
    else:
        print(" - (none)")

    return icon_rc


def update_app_json(root: Path, cfg: dict):
    app_json_path = root / "app.json"
    if not app_json_path.exists():
        print(f"[APPJSON] app.json not found at {app_json_path}", file=sys.stderr)
        return 1

    try:
        data = json.loads(app_json_path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"[APPJSON] Failed to read app.json: {exc}", file=sys.stderr)
        return 1

    raw_name = cfg.get("AppName") or "app"
    name_val = sanitize_app_name(raw_name)
    display_val = cfg.get("DisplayNameEnglish") or raw_name

    data["name"] = name_val
    data["displayName"] = display_val

    app_json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[APPJSON] Updated app.json with name={name_val}, displayName={display_val}")
    return 0


def update_android_app_name(root: Path, cfg: dict):
    strings_path = root / "android" / "app" / "src" / "main" / "res" / "values" / "strings.xml"
    if not strings_path.exists():
        print(f"[ANDROID] strings.xml not found at {strings_path}", file=sys.stderr)
        return 1

    target_en = cfg.get("DisplayNameEnglish") or cfg.get("AppName") or "app"
    target_cn = cfg.get("DisplayNameChinese") or target_en
    target_name = target_cn or target_en
    try:
        tree = ET.parse(strings_path)
        root_el = tree.getroot()
        updated = False
        for s in root_el.findall("string"):
            if s.get("name") == "app_name":
                s.text = target_name
                updated = True
            if s.get("name") == "app_name_en":
                s.text = target_en
        if not updated:
            new_s = ET.SubElement(root_el, "string", {"name": "app_name"})
            new_s.text = target_name
        # ensure English alias exists
        if not any(s.get("name") == "app_name_en" for s in root_el.findall("string")):
            new_en = ET.SubElement(root_el, "string", {"name": "app_name_en"})
            new_en.text = target_en
        tree.write(strings_path, encoding="utf-8", xml_declaration=False)
        print(f"[ANDROID] Updated app_name/app_name_en in {strings_path} to '{target_name}' / '{target_en}'")
        return 0
    except Exception as exc:
        print(f"[ANDROID] Failed to update {strings_path}: {exc}", file=sys.stderr)
        return 1


def update_android_identifiers(root: Path, cfg: dict):
    src_pkg = "com.anwuyou.app"
    ns_new = cfg.get("PackageId") or src_pkg
    app_name = cfg.get("AppName") or "app"
    app_name_safe = sanitize_app_name(cfg.get("RootProjectName") or app_name)

    # settings.gradle: rootProject.name
    settings_path = root / "android" / "settings.gradle"
    if settings_path.exists():
        txt = settings_path.read_text(encoding="utf-8")
        txt = re.sub(r"rootProject\.name\s*=\s*'.*?'", f"rootProject.name = '{app_name_safe}'", txt)
        settings_path.write_text(txt, encoding="utf-8")
        print(f"[ANDROID] Updated settings.gradle rootProject.name")

    # app/build.gradle: namespace, applicationId
    app_gradle = root / "android" / "app" / "build.gradle"
    if app_gradle.exists():
        txt = app_gradle.read_text(encoding="utf-8")
        txt = re.sub(r'namespace\\s+"[^"]+"', f'namespace "{ns_new}"', txt)
        txt = re.sub(r'applicationId\\s+"[^"]+"', f'applicationId "{ns_new}"', txt)
        app_gradle.write_text(txt, encoding="utf-8")
        print(f"[ANDROID] Updated app/build.gradle namespace/applicationId -> {ns_new}")

    # Kotlin package dirs: rename directory and package declaration
    src_dir = root / "android" / "app" / "src" / "main" / "java"
    old_pkg_dir = src_dir / "com" / "react_native_new"
    if old_pkg_dir.exists():
        new_pkg_parts = ns_new.split(".")
        new_pkg_dir = src_dir.joinpath(*new_pkg_parts)
        new_pkg_dir.mkdir(parents=True, exist_ok=True)
        for f in old_pkg_dir.glob("*.kt"):
            txt = f.read_text(encoding="utf-8")
            txt = re.sub(r"package\\s+com\\.react_native_new", f"package {ns_new}", txt)
            new_path = new_pkg_dir / f.name
            new_path.write_text(txt, encoding="utf-8")
        shutil.rmtree(old_pkg_dir, ignore_errors=True)
        print(f"[ANDROID] Updated Kotlin package declarations to {ns_new} (moved to new dir)")


def replace_identifiers(root: Path, cfg: dict):
    app_name = cfg.get("AppName") or "app"
    app_name_safe = sanitize_app_name(app_name)
    package_id = cfg.get("PackageId") or "com.anwuyou.app"
    old_names = ["react_native_new", "com.react_native_new"]
    targets = [
        root / "package.json",
        root / "package-lock.json",
        root / "android" / "settings.gradle",
        root / "android" / "app" / "build.gradle",
        root / "android" / "app" / "src" / "main" / "res" / "values" / "strings.xml",
        root / "android" / "app" / "src" / "main" / "java" / "com" / "react_native_new" / "MainActivity.kt",
        root / "android" / "app" / "src" / "main" / "java" / "com" / "react_native_new" / "MainApplication.kt",
        root / "ios" / "Podfile",
        root / "ios" / "react_native_new.xcodeproj" / "project.pbxproj",
        root / "ios" / "react_native_new.xcodeproj" / "xcshareddata" / "xcschemes" / "react_native_new.xcscheme",
        root / "ios" / "react_native_new" / "LaunchScreen.storyboard",
        root / "ios" / "react_native_new" / "Info.plist",
    ]

    for path in targets:
        if not path.exists():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except Exception:
            continue
        new_text = text.replace("react_native_new", app_name_safe)
        new_text = new_text.replace("com.react_native_new", package_id)
        # strings.xml app_name
        if path.name == "strings.xml":
            disp_en = cfg.get("DisplayNameEnglish") or app_name
            disp_cn = cfg.get("DisplayNameChinese") or disp_en
            new_text = re.sub(r'(<string\\s+name="app_name">)(.*?)(</string>)', rf'\1{disp_cn}\3', new_text)
            if "app_name_en" in new_text:
                new_text = re.sub(r'(<string\\s+name="app_name_en">)(.*?)(</string>)', rf'\1{disp_en}\3', new_text)
        if new_text != text:
            path.write_text(new_text, encoding="utf-8")
            print(f"[REPLACE] Updated {path}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Build helper for RN automation.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    c_read = sub.add_parser("read-config")
    c_read.add_argument("--root", required=True)
    c_read.add_argument("--namespace", required=True)

    c_sync = sub.add_parser("sync")
    c_sync.add_argument("--src", required=True)
    c_sync.add_argument("--dst", required=True)

    c_res = sub.add_parser("apply-resources")
    c_res.add_argument("--root", required=True)
    c_res.add_argument("--namespace", required=True)
    c_res.add_argument("--icon", required=True)

    c_appjson = sub.add_parser("update-app-json")
    c_appjson.add_argument("--root", required=True)
    c_appjson.add_argument("--namespace", required=True)

    c_android_name = sub.add_parser("update-android-name")
    c_android_name.add_argument("--root", required=True)
    c_android_name.add_argument("--namespace", required=True)

    c_android_ids = sub.add_parser("update-android-ids")
    c_android_ids.add_argument("--root", required=True)
    c_android_ids.add_argument("--namespace", required=True)

    c_replace = sub.add_parser("replace-identifiers")
    c_replace.add_argument("--root", required=True)
    c_replace.add_argument("--namespace", required=True)

    args = parser.parse_args()

    if args.cmd == "read-config":
        cfg = read_config(Path(args.root).resolve(), args.namespace)
        sys.stdout.reconfigure(encoding="utf-8")
        print(json.dumps(cfg, ensure_ascii=False))
        return 0

    if args.cmd == "sync":
        return sync_tree(Path(args.src).resolve(), Path(args.dst).resolve())

    if args.cmd == "apply-resources":
        return apply_resources(Path(args.root).resolve(), args.namespace, args.icon)

    if args.cmd == "update-app-json":
        root = Path(args.root).resolve()
        cfg = read_config(root, args.namespace)
        return update_app_json(root, cfg)

    if args.cmd == "update-android-name":
        root = Path(args.root).resolve()
        cfg = read_config(root, args.namespace)
        return update_android_app_name(root, cfg)

    if args.cmd == "update-android-ids":
        root = Path(args.root).resolve()
        cfg = read_config(root, args.namespace)
        return update_android_identifiers(root, cfg)

    if args.cmd == "replace-identifiers":
        root = Path(args.root).resolve()
        cfg = read_config(root, args.namespace)
        return replace_identifiers(root, cfg)

    return 0


if __name__ == "__main__":
    sys.exit(main())
