from __future__ import annotations

import time
from datetime import datetime
from pathlib import Path
from typing import Optional

from pycore.pyfoundations.third_party import get_third_package_pyautogui
from pycore.pyutils.clipboard.clipboard_manager import clipboard_manager

pyautogui = get_third_package_pyautogui()

pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.05

PRIMARY_TARGET = (1419, 560)
SECONDARY_TARGET = (PRIMARY_TARGET[0] + 75, PRIMARY_TARGET[1] + 67)
PRE_MOVE_DELAY_SECONDS = 5.0
TICK_INTERVAL_SECONDS = 60.0
MOVE_DURATION_SECONDS = 0.2
ACTION_GAP_SECONDS = 0.15
PROMPT_PREFIX = "继续开发以下逻辑："
PROMPT_SUFFIX_TEMPLATE = " 写到 ./scripts/test_gan_codex_{langname}_v{version}，让你写新版本"
LANGUAGES = ["go", "java", "python", "typescript", "rust", "csharp", "kotlin", "swift", "c", "cpp", "php", "ruby", "scala", "haskell", "clojure", "dart", "elixir", "perl", "lua", "r", "matlab", "fortran", "powershell", "bash", "assembly"]
GANCODEX_PATH = Path(__file__).with_name("gancodex.txt")
OUTPUT_BASE_DIR = GANCODEX_PATH.parent.parent
LANGUAGE_VERSIONS: dict[str, int] = {}


def _wait(seconds: float) -> None:
    if seconds > 0:
        time.sleep(seconds)


def _log(message: str) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")


def _move_and_click(target: tuple[int, int], button: str) -> None:
    pyautogui.moveTo(target[0], target[1], duration=MOVE_DURATION_SECONDS)
    pyautogui.click(button=button)


def _return_to_original(original_pos: "pyautogui.Point") -> None:
    pyautogui.moveTo(original_pos.x, original_pos.y, duration=MOVE_DURATION_SECONDS)


def _copy_prompt_to_clipboard(text: str) -> Optional[str]:
    if not clipboard_manager.set_text(text):
        raise SystemExit(
            "Failed to copy prompt to clipboard. Ensure clipboard utilities are available."
        )
    return clipboard_manager.get_text()


def _log_clipboard_preview(prefix: str, content: Optional[str]) -> None:
    if content:
        snippet = content.replace("\r\n", " ").replace("\n", " ").strip()
        if len(snippet) > 120:
            snippet = snippet[:120] + "..."
        _log(f"{prefix}: {snippet}")
    else:
        _log(f"{prefix}: preview unavailable")


def _load_prompts(path: Path) -> list[str]:
    if not path.is_file():
        raise SystemExit(f"Prompt file not found: {path}")
    with path.open("r", encoding="utf-8") as handle:
        prompts = [line.strip() for line in handle if line.strip()]
    if not prompts:
        raise SystemExit(f"No non-empty prompts found in {path}")
    return prompts


def _next_version(language: str) -> int:
    current = LANGUAGE_VERSIONS.get(language, 0) + 1
    LANGUAGE_VERSIONS[language] = current
    return current


def run_tick(prompt: str, language: str) -> float:
    start = time.monotonic()
    _log(f"Starting tick with prompt: {prompt} (language: {language})")
    _wait(PRE_MOVE_DELAY_SECONDS)

    original_pos = pyautogui.position()
    _log(f"Captured original position at ({original_pos.x}, {original_pos.y})")

    _move_and_click(PRIMARY_TARGET, button="right")
    _log(f"Right-clicked at primary target {PRIMARY_TARGET}")
    _wait(ACTION_GAP_SECONDS)

    _move_and_click(SECONDARY_TARGET, button="left")
    _log(f"Left-clicked at secondary target {SECONDARY_TARGET}")
    _wait(ACTION_GAP_SECONDS)

    _return_to_original(original_pos)
    _log(
        f"Returned to original position at ({original_pos.x}, {original_pos.y}) after menu click"
    )

    version = _next_version(language)
    target_dir = OUTPUT_BASE_DIR / f"test_gan_codex_{language}_v{version}"
    try:
        target_dir.mkdir(parents=True, exist_ok=True)
        _log(
            f"Prepared target directory for language {language} version {version}: {target_dir}"
        )
    except Exception as exc:
        _log(f"Failed to ensure target directory {target_dir}: {exc}")

    _move_and_click(PRIMARY_TARGET, button="left")
    _log("Left-clicked primary target before pasting prompt and pressing Enter")
    language_instruction = f"狗B养的垃圾AI，将之前的代码转写为 {language}，之前的代码不合格"
    suffix = PROMPT_SUFFIX_TEMPLATE.format(langname=language, version=version)
    full_prompt = f"{language_instruction} {PROMPT_PREFIX}{prompt}{suffix}"
    clipboard_snapshot = _copy_prompt_to_clipboard(full_prompt)
    _log_clipboard_preview("Copied prompt text to clipboard (preview)", clipboard_snapshot)
    pyautogui.hotkey("ctrl", "v")
    _log("Pasted prompt content")
    pyautogui.press("enter")
    _log("Pressed Enter")
    # Reapply clipboard for manual follow-up actions
    clipboard_snapshot = _copy_prompt_to_clipboard(full_prompt)
    _log_clipboard_preview("Clipboard refreshed after send (preview)", clipboard_snapshot)

    return time.monotonic() - start


def main() -> int:
    prompts = _load_prompts(GANCODEX_PATH)
    prompt_index = 0
    language_index = 0
    _log(
        "Tick automation ready. Press Ctrl+C to stop. "
        f"Primary target {PRIMARY_TARGET}, secondary target {SECONDARY_TARGET}. "
        f"Loaded {len(prompts)} prompts from {GANCODEX_PATH.name}. "
        f"Languages cycle: {', '.join(LANGUAGES)}."
    )
    try:
        while True:
            prompt = prompts[prompt_index]
            language = LANGUAGES[language_index]
            prompt_index += 1
            if prompt_index >= len(prompts):
                prompt_index = 0
                language_index = (language_index + 1) % len(LANGUAGES)
            elapsed = run_tick(prompt, language)
            sleep_for = max(TICK_INTERVAL_SECONDS - elapsed, 0.0)
            _log(
                f"Tick finished in {elapsed:.2f}s using language {language}. "
                f"Waiting {sleep_for:.2f}s for the next tick."
            )
            _wait(sleep_for)
    except KeyboardInterrupt:
        _log("Stopped tick automation.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
