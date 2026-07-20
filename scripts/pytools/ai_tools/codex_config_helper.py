#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Codex CLI config.toml patcher (called by the generated codex${index} launch script).

PROBLEM: new Codex CLI's WebSocket transport (Responses API) IGNORES the
OPENAI_BASE_URL env var and falls back to OpenAI's official endpoint
(wss://api.openai.com/v1/responses), which 401s on a non-OpenAI key (e.g. an
sk-ant- Claude key used via a relay).

FIX: write ~/.codex/config.toml with a custom model_provider whose base_url is
the relay (OPENAI_BASE_URL normalized with /v1), wire_api = "responses" (the
ONLY valid value - "chat" was REMOVED in recent codex), supports_websockets =
false (force HTTP POST to /v1/responses, NO wss fallback), env_key =
"OPENAI_API_KEY" + requires_openai_auth = false (use the env key, skip login).
Per the official codex source (codex-rs/model-provider-info/src/lib.rs):
wire_api only accepts "responses"; supports_websockets=false disables the
WebSocket transport so codex POSTs to the relay's /v1/responses.
Also writes a personalized global AGENTS.md (idempotent).

Uses the `toml` package (already a project dep) to merge - preserves user settings.
"""
import argparse
import os
import sys
from pathlib import Path


def normalize_base_url(url: str) -> str:
    url = (url or "").strip().rstrip("/")
    if not url:
        return ""
    if not url.endswith("/v1"):
        url = url + "/v1"
    return url


def write_agents_md(codex_home: Path) -> None:
    agents_path = codex_home / "AGENTS.md"
    if agents_path.exists():
        print(f"[INFO] AGENTS.md exists (kept): {agents_path}")
        return
    content = """# Codex Global Instructions

- Write all code, comments, logs, and commit messages in English.
- Follow the project's AGENTS.md / CLAUDE.md conventions when present.
- Prefer reusing/upgrading existing components over reinventing.
- Keep changes minimal, idempotent, and aligned with surrounding code style.
- Never execute destructive actions without explicit approval.
- Declare variables at the top of each file; no relative paths in PowerShell.
"""
    try:
        agents_path.parent.mkdir(parents=True, exist_ok=True)
        agents_path.write_text(content, encoding="utf-8")
        print(f"[INFO] Wrote Codex global AGENTS.md: {agents_path}")
    except Exception as exc:  # noqa: BLE001
        print(f"[WARN] Failed to write AGENTS.md: {exc}", file=sys.stderr)


def write_config(codex_home: Path, base_url: str, model: str, provider: str) -> bool:
    codex_home.mkdir(parents=True, exist_ok=True)
    config_path = codex_home / "config.toml"
    try:
        import toml  # project dep (toml package)
    except ImportError:
        # Fallback: minimal manual write (no merge) when toml is unavailable.
        try:
            config_path.write_text(_manual_config(model, base_url, provider), encoding="utf-8")
            print(f"[INFO] Wrote Codex config (manual, no toml dep): {config_path}")
            return True
        except Exception as exc:  # noqa: BLE001
            print(f"[ERROR] Failed to write config: {exc}", file=sys.stderr)
            return False

    config = {}
    if config_path.exists():
        try:
            config = toml.load(str(config_path))
        except Exception as exc:  # noqa: BLE001
            print(f"[WARN] Could not parse existing config.toml ({exc}); rewriting.")
            config = {}

    if model:
        config["model"] = model
    if base_url:
        # A NAMED provider is the ONLY way to make Codex honor a custom base_url
        # (the built-in OpenAI transport ignores OPENAI_BASE_URL and falls back to
        # wss://api.openai.com). Per codex-rs/model-provider-info: wire_api MUST be
        # "responses" ("chat" was removed); supports_websockets=false forces HTTP
        # POST to /v1/responses (no wss fallback); env_key reads $OPENAI_API_KEY;
        # requires_openai_auth=false skips the login screen.
        config["model_provider"] = provider
        config.setdefault("model_reasoning_effort", "medium")
        config.setdefault("approval_policy", "on-request")
        config.setdefault("sandbox_mode", "workspace-write")
        config.setdefault("model_providers", {})
        config["model_providers"][provider] = {
            "name": provider,
            "base_url": base_url,
            "env_key": "OPENAI_API_KEY",
            "wire_api": "responses",
            "requires_openai_auth": False,
            "supports_websockets": False,
        }
    else:
        # No custom base URL -> official OpenAI; drop a forced provider if present.
        config.pop("model_provider", None)

    try:
        with open(config_path, "w", encoding="utf-8") as f:
            f.write("# Codex CLI configuration (managed by core_node codex_config_helper)\n")
            toml.dump(config, f)
    except Exception as exc:  # noqa: BLE001
        print(f"[ERROR] Failed to write config: {exc}", file=sys.stderr)
        return False

    print(f"[INFO] Wrote Codex config: {config_path}")
    if base_url:
        print(f"[INFO] Provider '{provider}' -> base_url={base_url} wire_api=responses "
              f"supports_websockets=false (HTTP POST /v1/responses, NO wss fallback)")
    else:
        print("[INFO] No custom base URL -> official OpenAI (provider removed)")
    return True


def _manual_config(model: str, base_url: str, provider: str) -> str:
    lines = ["# Codex CLI configuration (managed by core_node codex_config_helper)"]
    if model:
        lines.append(f'model = "{model}"')
    if base_url:
        lines.append(f'model_provider = "{provider}"')
        lines.append('model_reasoning_effort = "medium"')
        lines.append('approval_policy = "on-request"')
        lines.append('sandbox_mode = "workspace-write"')
        lines.append("")
        lines.append(f"[model_providers.{provider}]")
        lines.append(f'name = "{provider}"')
        lines.append(f'base_url = "{base_url}"')
        lines.append('env_key = "OPENAI_API_KEY"')
        lines.append('wire_api = "responses"')
        lines.append("requires_openai_auth = false")
        lines.append("supports_websockets = false")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Codex CLI config.toml patcher")
    parser.add_argument("--codex-home", required=True, help="Path to ~/.codex")
    parser.add_argument("--base-url", default="", help="OPENAI_BASE_URL (custom relay)")
    parser.add_argument("--model", default="", help="CODEX_MODEL (e.g. gpt-5.6-sol)")
    parser.add_argument("--provider", default="custom", help="model_provider name")
    args = parser.parse_args()

    codex_home = Path(args.codex_home).expanduser()
    base_url = normalize_base_url(args.base_url)
    model = (args.model or "").strip() or "gpt-5-codex"

    write_agents_md(codex_home)
    ok = write_config(codex_home, base_url, model, args.provider)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
