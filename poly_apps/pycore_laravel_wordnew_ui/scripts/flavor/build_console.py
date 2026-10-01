#!/usr/bin/env python3
"""Console helpers shared by the flavor build scripts: numbered step logging,
a cross-platform "press any key" pause and prompts where Enter keeps the default."""
from __future__ import annotations

import os
import sys


def interactive() -> bool:
    return sys.stdin.isatty() and sys.stdout.isatty()


class StepLog:
    """Prints `[tag] [step n/N] title` so every processing stage is visible."""

    def __init__(self, tag: str, total: int) -> None:
        self.tag = tag
        self.total = total
        self.index = 0

    def step(self, title: str) -> None:
        self.index += 1
        print(f"\n[{self.tag}] [step {self.index}/{self.total}] {title}", flush=True)

    def detail(self, message: str) -> None:
        print(f"[{self.tag}]     {message}", flush=True)


def pause_any_key(message: str) -> None:
    """Block until one key is pressed (Enter on terminals without raw mode)."""
    print(f"{message}\n>>> Press any key to continue...", end="", flush=True)
    try:
        if os.name == "nt":
            import msvcrt
            msvcrt.getch()
        else:
            import termios
            import tty
            descriptor = sys.stdin.fileno()
            previous = termios.tcgetattr(descriptor)
            try:
                tty.setraw(descriptor)
                key = sys.stdin.read(1)
            finally:
                termios.tcsetattr(descriptor, termios.TCSADRAIN, previous)
            if key == "\x03":
                raise KeyboardInterrupt
    except (ImportError, OSError, ValueError):
        input()
    print(flush=True)


def ask_text(prompt: str, default: str = "") -> str:
    """Prompt for a value; Enter (or EOF) keeps `default`. The chosen value is printed."""
    suffix = f" [{default}]" if default else " [skip]"
    try:
        answer = input(f">>> {prompt}{suffix}: ").strip()
    except EOFError:
        answer = ""
    value = answer or default
    print(f"    -> {value if value else '(skipped)'}", flush=True)
    return value


def ask_choice(prompt: str, choices: dict[str, str], default: str) -> str:
    """Single-letter choice; Enter keeps `default`."""
    options = " / ".join(f"[{key.upper() if key == default else key}] {label}" for key, label in choices.items())
    while True:
        try:
            answer = input(f">>> {prompt}  {options}: ").strip().lower()
        except EOFError:
            answer = ""
        answer = answer or default
        if answer in choices:
            print(f"    -> {choices[answer]}", flush=True)
            return answer
        print(f"    Unknown choice '{answer}'.", flush=True)
