# -*- coding: utf-8 -*-
"""Fix bad paths from first rewrite pass (broken relative-import resolution)."""
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]

# Wrong prefix -> correct prefix (module path before final segment is package)
REPLACEMENTS = [
    # third_party private modules were resolved under pyfoundations/
    ("from pycore.pyfoundations._getters_core", "from pycore.pyfoundations.third_party.api"),
    ("from pycore.pyfoundations._getters_optional", "from pycore.pyfoundations.third_party.api"),
    ("from pycore.pyfoundations._deps", "from pycore.pyfoundations.third_party.api"),
    ("from pycore.pyfoundations._package_cache", "from pycore.pyfoundations.third_party.api"),
    ("from pycore.pyfoundations._cache", "from pycore.pyfoundations.third_party.api"),
    ("from pycore.pyfoundations._dep_check", "from pycore.pyfoundations.third_party.api"),
    ("from pycore.pyfoundations._pip_runner", "from pycore.pyfoundations.third_party.api"),
    ("from pycore.pyfoundations._torch_cuda", "from pycore.pyfoundations.third_party.api"),
    ("from pycore.pyfoundations._hf_helpers", "from pycore.pyfoundations.third_party.api"),
    ("from pycore.pyfoundations._ocr_models", "from pycore.pyfoundations.third_party.api"),
    ("from pycore.pyfoundations._ocr_initializer", "from pycore.pyfoundations.third_party.api"),
    # callmodule.services relative drop
    ("from pycore.callmodule.translation_worker_service", "from pycore.callmodule.services.translation_worker_service"),
    ("from pycore.callmodule.tts_queue_poller_service", "from pycore.callmodule.services.tts_queue_poller_service"),
    ("from pycore.callmodule.tts_sentence_worker_service", "from pycore.callmodule.services.tts_sentence_worker_service"),
    ("from pycore.callmodule.queue_monitor_service", "from pycore.callmodule.services.queue_monitor_service"),
    ("from pycore.callmodule.translation_ws_client_service", "from pycore.callmodule.services.translation_ws_client_service"),
    ("from pycore.callmodule.ai_rate_reset_service", "from pycore.callmodule.services.ai_rate_reset_service"),
    ("from pycore.callmodule.module_call_service", "from pycore.callmodule.services.module_call_service"),
]


def module_exists(dotted: str) -> bool:
    parts = dotted.split(".")
    base = REPO.joinpath(*parts)
    return base.with_suffix(".py").is_file() or (base / "__init__.py").is_file()


def main() -> None:
    changed_files = 0
    for path in REPO.rglob("*.py"):
        if "__pycache__" in path.parts:
            continue
        if path.name.startswith("_empty_pycore"):
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            print(f"skip read {path}: {exc}")
            continue
        new = text
        for old, repl in REPLACEMENTS:
            new = new.replace(old, repl)
        if new != text:
            try:
                path.write_text(new, encoding="utf-8")
            except OSError as exc:
                print(f"skip write {path}: {exc}")
                continue
            changed_files += 1
            print(f"fixed {path.relative_to(REPO)}")
    print(f"fixed files: {changed_files}")


if __name__ == "__main__":
    main()
