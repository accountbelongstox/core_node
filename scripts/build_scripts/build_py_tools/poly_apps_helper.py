import json
import os
import sys
import time
from pathlib import Path

try:
    import msvcrt
except ImportError:  # pragma: no cover - fallback in unlikely case
    msvcrt = None


KEY_CENTER = {
    "repo_root": "repo_root",
    "poly_root": "poly_root",
    "projects": "projects",
    "project_count": "project_count",
    "project_name": "project_name",
    "project_path": "project_path",
    "project_port": "project_port",
    "project_type": "project_type",
    "base_port": "base_port",
    "generated_at": "generated_at",
    "build_modes": "build_modes",
    "platforms": "platforms",
    "build_mode_index": "build_mode_index",
    "platform_index": "platform_index",
    "build_mode_label": "build_mode_label",
    "platform_label": "platform_label",
    "menu_items": "menu_items",
    "menu_items_count": "menu_items_count",
    "display_line": "display_line",
    "selection_index": "selection_index",
    "framework_profile": "framework_profile",
    "state_file": "poly_apps_state.txt",
    "menu_cache": "poly_apps_menu_cache.txt",
    "selection_file": "poly_apps_selection.txt",
    "scan_signature": "scan_signature",
    "command_windows": "command_windows",
    "command_unix": "command_unix",
    "env_var_count": "env_var_count",
    "env_var_name": "env_var_name",
    "env_var_value": "env_var_value"
}

FRAMEWORK_PROFILES = {
    "react": {
        KEY_CENTER["build_modes"]: ["build", "start", "inspect"],
        KEY_CENTER["platforms"]: ["web"]
    },
    "react_native": {
        KEY_CENTER["build_modes"]: ["debug", "release", "profile"],
        KEY_CENTER["platforms"]: ["web", "android"]
    },
    "nuxt": {
        KEY_CENTER["build_modes"]: ["dev", "build", "generate"],
        KEY_CENTER["platforms"]: ["web"]
    },
    "nexus": {
        KEY_CENTER["build_modes"]: ["dev", "build"],
        KEY_CENTER["platforms"]: ["web", "server"]
    },
    "vue": {
        KEY_CENTER["build_modes"]: ["serve", "build", "test"],
        KEY_CENTER["platforms"]: ["web"]
    },
    "vite": {
        KEY_CENTER["build_modes"]: ["dev", "build", "preview"],
        KEY_CENTER["platforms"]: ["web", "ssr"]
    },
    "unknown": {
        KEY_CENTER["build_modes"]: ["dev", "build"],
        KEY_CENTER["platforms"]: ["web"]
    }
}


def format_pair(key: str, value: object) -> str:
    safe_value = "" if value is None else str(value)
    return f"{key}\t{safe_value}"


def write_pairs(path: Path, lines: list[str]) -> None:
    data = "\n".join(lines)
    if lines:
        data += "\n"
    path.write_text(data, encoding="utf-8")


def load_pairs(path: Path) -> dict:
    if not path.exists():
        return {}
    pairs = {}
    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        if not raw_line.strip():
            continue
        if "\t" not in raw_line:
            continue
        key, value = raw_line.split("\t", 1)
        pairs[key.strip()] = value
    return pairs


def indexed_key(base_key: str, index: int) -> str:
    return f"{base_key}_{index}"


def to_int(value: object, fallback: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def load_state_payload(state_path: Path) -> dict:
    pairs = load_pairs(state_path)
    project_count = to_int(pairs.get(KEY_CENTER["project_count"]))
    projects = []
    for idx in range(project_count):
        project = {
            KEY_CENTER["project_name"]: pairs.get(indexed_key(KEY_CENTER["project_name"], idx), ""),
            KEY_CENTER["project_path"]: pairs.get(indexed_key(KEY_CENTER["project_path"], idx), ""),
            KEY_CENTER["project_port"]: to_int(pairs.get(indexed_key(KEY_CENTER["project_port"], idx))),
            KEY_CENTER["project_type"]: pairs.get(indexed_key(KEY_CENTER["project_type"], idx), "")
        }
        projects.append(project)

    return {
        KEY_CENTER["repo_root"]: pairs.get(KEY_CENTER["repo_root"], ""),
        KEY_CENTER["poly_root"]: pairs.get(KEY_CENTER["poly_root"], ""),
        KEY_CENTER["base_port"]: to_int(pairs.get(KEY_CENTER["base_port"])),
        KEY_CENTER["generated_at"]: pairs.get(KEY_CENTER["generated_at"], ""),
        KEY_CENTER["project_count"]: project_count,
        KEY_CENTER["projects"]: projects
    }


def save_state_payload(state_path: Path, payload: dict) -> None:
    lines = [
        format_pair(KEY_CENTER["repo_root"], payload.get(KEY_CENTER["repo_root"], "")),
        format_pair(KEY_CENTER["poly_root"], payload.get(KEY_CENTER["poly_root"], "")),
        format_pair(KEY_CENTER["base_port"], payload.get(KEY_CENTER["base_port"], "")),
        format_pair(KEY_CENTER["generated_at"], time.strftime("%Y-%m-%dT%H:%M:%S")),
    ]
    projects = payload.get(KEY_CENTER["projects"], [])
    lines.append(format_pair(KEY_CENTER["project_count"], len(projects)))
    for idx, project in enumerate(projects):
        lines.append(format_pair(indexed_key(KEY_CENTER["project_name"], idx), project.get(KEY_CENTER["project_name"], "")))
        lines.append(format_pair(indexed_key(KEY_CENTER["project_path"], idx), project.get(KEY_CENTER["project_path"], "")))
        lines.append(format_pair(indexed_key(KEY_CENTER["project_port"], idx), project.get(KEY_CENTER["project_port"], "")))
        lines.append(format_pair(indexed_key(KEY_CENTER["project_type"], idx), project.get(KEY_CENTER["project_type"], "")))
    write_pairs(state_path, lines)


def read_package_manifest(project_root: Path) -> dict:
    package_path = project_root / "package.json"
    if not package_path.exists():
        return {}
    try:
        with package_path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except json.JSONDecodeError:
        return {}


def has_config_file(project_root: Path, patterns: list[str]) -> bool:
    for pattern in patterns:
        if any(project_root.glob(pattern)):
            return True
    return False


def detect_framework(project_root: Path) -> str:
    manifest = read_package_manifest(project_root)
    dependencies = set()
    scripts_blob = ""
    if manifest:
        for section in ("dependencies", "devDependencies", "peerDependencies"):
            for name in manifest.get(section, {}) or {}:
                dependencies.add(name.lower())
        script_values = (manifest.get("scripts") or {}).values()
        scripts_blob = " ".join(script_values).lower()

    lower_name = project_root.name.lower()

    if (
        "react-native" in dependencies
        or "expo" in dependencies
        or "react native" in scripts_blob
        or has_config_file(project_root, ["app.json", "app.config.*", "react-native.config.*"])
    ):
        return "react_native"

    if (
        "nuxt" in dependencies
        or "nuxt3" in dependencies
        or "nuxt" in scripts_blob
        or has_config_file(project_root, ["nuxt.config.*"])
    ):
        return "nuxt"

    if (
        "nexus" in dependencies
        or "graphql-nexus" in dependencies
        or "nexus" in scripts_blob
        or has_config_file(project_root, ["nexus.config.*", "schema.prisma", "schema.graphql"])
    ):
        return "nexus"

    if (
        "vite" in dependencies
        or "vite" in scripts_blob
        or has_config_file(project_root, ["vite.config.*"])
    ):
        return "vite"

    if (
        "vue" in dependencies
        or "vue-cli-service" in dependencies
        or "vue" in scripts_blob
        or has_config_file(project_root, ["vue.config.*"])
    ):
        return "vue"

    if (
        "react" in dependencies
        or "react-dom" in dependencies
        or "react-scripts" in dependencies
        or "react" in scripts_blob
        or lower_name.endswith("-react")
    ):
        return "react"
    return "unknown"


def load_menu_cache(cache_path: Path) -> tuple[dict, int]:
    pairs = load_pairs(cache_path)
    selection_index = to_int(pairs.get(KEY_CENTER["selection_index"]))
    count = to_int(pairs.get(KEY_CENTER["menu_items_count"]))
    lookup = {}
    for idx in range(count):
        project_path = pairs.get(indexed_key(KEY_CENTER["project_path"], idx))
        if not project_path:
            continue
        lookup[project_path] = {
            KEY_CENTER["build_mode_index"]: to_int(pairs.get(indexed_key(KEY_CENTER["build_mode_index"], idx))),
            KEY_CENTER["platform_index"]: to_int(pairs.get(indexed_key(KEY_CENTER["platform_index"], idx)))
        }
    return lookup, selection_index


def apply_cache_defaults(menu_items: list, cache_lookup: dict) -> list:
    for item in menu_items:
        cached = cache_lookup.get(item[KEY_CENTER["project_path"]])
        if cached:
            item[KEY_CENTER["build_mode_index"]] = cached.get(KEY_CENTER["build_mode_index"], 0)
            item[KEY_CENTER["platform_index"]] = cached.get(KEY_CENTER["platform_index"], 0)
    return menu_items


def persist_menu_cache(cache_path: Path, menu_items: list, selection_index: int) -> None:
    lines = [
        format_pair(KEY_CENTER["generated_at"], time.strftime("%Y-%m-%dT%H:%M:%S")),
        format_pair(KEY_CENTER["selection_index"], selection_index),
        format_pair(KEY_CENTER["menu_items_count"], len(menu_items))
    ]
    for idx, item in enumerate(menu_items):
        lines.append(format_pair(indexed_key(KEY_CENTER["project_name"], idx), item[KEY_CENTER["project_name"]]))
        lines.append(format_pair(indexed_key(KEY_CENTER["project_path"], idx), item[KEY_CENTER["project_path"]]))
        lines.append(format_pair(indexed_key(KEY_CENTER["project_port"], idx), item[KEY_CENTER["project_port"]]))
        lines.append(format_pair(indexed_key(KEY_CENTER["project_type"], idx), item[KEY_CENTER["project_type"]]))
        lines.append(format_pair(indexed_key(KEY_CENTER["build_mode_index"], idx), item[KEY_CENTER["build_mode_index"]]))
        lines.append(format_pair(indexed_key(KEY_CENTER["platform_index"], idx), item[KEY_CENTER["platform_index"]]))
        lines.append(format_pair(indexed_key(KEY_CENTER["display_line"], idx), format_display_line(item)))
    write_pairs(cache_path, lines)


def format_display_line(item: dict) -> str:
    mode_label = get_mode_label(item)
    platform_label = get_platform_label(item)
    return f"{item[KEY_CENTER['project_name']]}[{item[KEY_CENTER['project_port']]}]  [{mode_label}|{platform_label}]"


def get_mode_label(item: dict) -> str:
    modes = item[KEY_CENTER["build_modes"]]
    if not modes:
        return "default"
    mode_index = item.get(KEY_CENTER["build_mode_index"], 0)
    return modes[mode_index % len(modes)]


def get_platform_label(item: dict) -> str:
    platforms = item[KEY_CENTER["platforms"]]
    if not platforms:
        return "web"
    platform_index = item.get(KEY_CENTER["platform_index"], 0)
    return platforms[platform_index % len(platforms)]


def determine_command_details(project_type: str, mode_label: str, platform_label: str, port: int) -> dict:
    pt = (project_type or "unknown").lower()
    mode = (mode_label or "").lower()
    platform = (platform_label or "").lower()
    env_map: dict[str, str] = {}
    port_str = str(port)
    npx_prefix = "npx --yes"

    def npm_run(script: str, extra_args: str | None = None) -> str:
        base = f"npm run {script}".strip()
        if extra_args:
            return f"{base} {extra_args.strip()}"
        return base

    if pt == "vite":
        if mode in ("dev", "debug"):
            env_map["PORT"] = port_str
            cmd = f"{npx_prefix} vite --port {port_str}"
        elif mode in ("preview", "serve"):
            env_map["PORT"] = port_str
            cmd = f"{npx_prefix} vite preview --port {port_str}"
        else:
            cmd = f"{npx_prefix} vite build"
    elif pt == "nuxt":
        if mode in ("dev", "debug"):
            env_map["NITRO_PORT"] = port_str
            cmd = f"{npx_prefix} nuxi dev --port {port_str}"
        elif mode in ("generate", "static"):
            cmd = f"{npx_prefix} nuxi generate"
        else:
            cmd = f"{npx_prefix} nuxi build"
    elif pt == "react_native":
        env_map["RCT_METRO_PORT"] = port_str
        if platform in ("android",):
            cmd = f"{npx_prefix} react-native run-android"
        elif platform in ("ios", "apple"):
            cmd = f"{npx_prefix} react-native run-ios"
        elif platform in ("web", "browser"):
            cmd = f"{npx_prefix} expo start --web"
        else:
            cmd = f"{npx_prefix} expo start"
        if mode in ("release", "build"):
            cmd += " --clear"
    elif pt == "react":
        if mode in ("dev", "start", "debug"):
            env_map["PORT"] = port_str
            cmd = f"{npx_prefix} react-scripts start"
        elif mode in ("test", "inspect"):
            cmd = f"{npx_prefix} react-scripts test"
        else:
            cmd = f"{npx_prefix} react-scripts build"
    elif pt == "vue":
        if mode in ("dev", "serve", "debug"):
            env_map["PORT"] = port_str
            cmd = f"{npx_prefix} vue-cli-service serve --port {port_str}"
        elif mode in ("test",):
            cmd = f"{npx_prefix} vue-cli-service test"
        else:
            cmd = f"{npx_prefix} vue-cli-service build"
    elif pt == "nexus":
        if mode in ("dev", "debug"):
            cmd = f"{npx_prefix} nexus dev"
        else:
            cmd = f"{npx_prefix} nexus build"
    else:
        if mode in ("build", "release"):
            cmd = npm_run("build")
        else:
            env_map["PORT"] = port_str
            cmd = npm_run("start")

    return {
        KEY_CENTER["command_windows"]: cmd,
        KEY_CENTER["command_unix"]: cmd,
        "env": env_map
    }


def get_clear_screen_command() -> str:
    """
    Returns the appropriate clear screen command for the platform.
    Does NOT execute the command - returns it for Shell to execute.

    Architecture compliance: Python only returns command strings.
    """
    return "cls" if os.name == "nt" else "clear"

def clear_screen() -> None:
    """
    Print ANSI escape codes to clear screen without executing system commands.
    This is a pure Python solution that doesn't violate architecture rules.
    """
    # Use ANSI escape codes for cross-platform screen clearing
    print("\033[2J\033[H", end="")


def read_key() -> str:
    if msvcrt:
        first = msvcrt.getch()
        if first in (b"\x00", b"\xe0"):
            second = msvcrt.getch()
            mapping = {72: "UP", 80: "DOWN", 75: "LEFT", 77: "RIGHT"}
            return mapping.get(second[0], "")
        if first in (b"\x1b",):
            return "ESC"
        if first in (b"\r", b"\n"):
            return "ENTER"
        if first.lower() == b"q":
            return "ESC"
        return ""
    else:  # pragma: no cover - fallback for environments without msvcrt
        return sys.stdin.readline().strip().upper()


def render_menu(menu_items: list, selection_index: int) -> None:
    clear_screen()
    print("Poly Apps Menu")
    print("Up/Down select | Left toggles build mode | Right toggles platform | Enter confirm | Esc quit")
    print("-" * 72)
    for idx, item in enumerate(menu_items):
        line = format_display_line(item)
        prefix = "->" if idx == selection_index else "  "
        print(f"{prefix} {line}")


def run_menu_loop(menu_items: list, selection_index: int, cache_path: Path) -> int:
    persist_menu_cache(cache_path, menu_items, selection_index)
    while True:
        render_menu(menu_items, selection_index)
        key = read_key()
        if key == "UP":
            selection_index = (selection_index - 1) % len(menu_items)
        elif key == "DOWN":
            selection_index = (selection_index + 1) % len(menu_items)
        elif key == "LEFT":
            item = menu_items[selection_index]
            item[KEY_CENTER["build_mode_index"]] = (item[KEY_CENTER["build_mode_index"]] + 1) % len(item[KEY_CENTER["build_modes"]])
        elif key == "RIGHT":
            item = menu_items[selection_index]
            item[KEY_CENTER["platform_index"]] = (item[KEY_CENTER["platform_index"]] + 1) % len(item[KEY_CENTER["platforms"]])
        elif key == "ENTER":
            persist_menu_cache(cache_path, menu_items, selection_index)
            return selection_index
        elif key == "ESC":
            print("Menu cancelled by user.")
            persist_menu_cache(cache_path, menu_items, selection_index)
            sys.exit(0)
        persist_menu_cache(cache_path, menu_items, selection_index)


def record_selection(selection_path: Path, selected_item: dict) -> None:
    mode_label = get_mode_label(selected_item)
    platform_label = get_platform_label(selected_item)
    command_details = determine_command_details(
        selected_item.get(KEY_CENTER["project_type"]),
        mode_label,
        platform_label,
        selected_item.get(KEY_CENTER["project_port"], 0)
    )
    env_map = command_details.get("env", {})

    lines = [
        format_pair(KEY_CENTER["generated_at"], time.strftime("%Y-%m-%dT%H:%M:%S")),
        format_pair(KEY_CENTER["project_name"], selected_item[KEY_CENTER["project_name"]]),
        format_pair(KEY_CENTER["project_path"], selected_item[KEY_CENTER["project_path"]]),
        format_pair(KEY_CENTER["project_port"], selected_item[KEY_CENTER["project_port"]]),
        format_pair(KEY_CENTER["project_type"], selected_item[KEY_CENTER["project_type"]]),
        format_pair(KEY_CENTER["build_mode_index"], selected_item[KEY_CENTER["build_mode_index"]]),
        format_pair(KEY_CENTER["platform_index"], selected_item[KEY_CENTER["platform_index"]]),
        format_pair(KEY_CENTER["build_mode_label"], mode_label),
        format_pair(KEY_CENTER["platform_label"], platform_label),
        format_pair(KEY_CENTER["command_windows"], command_details.get(KEY_CENTER["command_windows"], "")),
        format_pair(KEY_CENTER["command_unix"], command_details.get(KEY_CENTER["command_unix"], "")),
        format_pair(KEY_CENTER["display_line"], format_display_line(selected_item)),
        format_pair(KEY_CENTER["env_var_count"], len(env_map))
    ]

    for idx, (env_key, env_value) in enumerate(env_map.items()):
        lines.append(format_pair(indexed_key(KEY_CENTER["env_var_name"], idx), env_key))
        lines.append(format_pair(indexed_key(KEY_CENTER["env_var_value"], idx), env_value))

    write_pairs(selection_path, lines)


def main() -> None:
    script_dir = Path(__file__).resolve().parent
    state_path = script_dir / KEY_CENTER["state_file"]
    menu_cache_path = script_dir / KEY_CENTER["menu_cache"]
    selection_path = script_dir / KEY_CENTER["selection_file"]

    state_payload = load_state_payload(state_path)
    projects = state_payload.get(KEY_CENTER["projects"])
    if not projects:
        print("State file is missing project definitions.")
        sys.exit(1)

    for project in projects:
        project_root = Path(project[KEY_CENTER["project_path"]])
        framework = detect_framework(project_root)
        project[KEY_CENTER["project_type"]] = framework

    save_state_payload(state_path, state_payload)

    menu_items = []
    for project in projects:
        framework = project.get(KEY_CENTER["project_type"], "unknown")
        profile = FRAMEWORK_PROFILES.get(framework, FRAMEWORK_PROFILES["unknown"])
        menu_items.append({
            KEY_CENTER["project_name"]: project[KEY_CENTER["project_name"]],
            KEY_CENTER["project_path"]: project[KEY_CENTER["project_path"]],
            KEY_CENTER["project_port"]: project[KEY_CENTER["project_port"]],
            KEY_CENTER["project_type"]: framework,
            KEY_CENTER["build_modes"]: profile[KEY_CENTER["build_modes"]],
            KEY_CENTER["platforms"]: profile[KEY_CENTER["platforms"]],
            KEY_CENTER["build_mode_index"]: 0,
            KEY_CENTER["platform_index"]: 0
        })

    cache_lookup, selection_index = load_menu_cache(menu_cache_path)
    menu_items = apply_cache_defaults(menu_items, cache_lookup)

    selected_idx = run_menu_loop(menu_items, selection_index, menu_cache_path)
    record_selection(selection_path, menu_items[selected_idx])


if __name__ == "__main__":
    main()
