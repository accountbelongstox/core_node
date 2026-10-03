# -*- coding: utf-8 -*-
"""Command line of the Colab pycore runner, for people and AI agents:

    python -m pycore.pyctl.colab.colab_cli start
    python -m pycore.pyctl.colab.colab_cli logs [--tail 200] [--grep REGEX]
    python -m pycore.pyctl.colab.colab_cli restart

Drives the user's signed-in Chrome through the mcp-chrome service.
"""

import argparse
import json
import sys
from typing import List

from pycore.pyctl.colab.colab_constants import DEFAULT_LOG_TAIL_LINES
from pycore.pyctl.colab.colab_pycore_runner import colab_pycore_runner
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

COMMAND_START = "start"
COMMAND_LOGS = "logs"
COMMAND_RESTART = "restart"


def main(argv: List[str]) -> int:
    parser = argparse.ArgumentParser(description="Start, read and restart pycore on Google Colab.")
    parser.add_argument("command", choices=(COMMAND_START, COMMAND_LOGS, COMMAND_RESTART))
    parser.add_argument("--tail", type=int, default=DEFAULT_LOG_TAIL_LINES, help="logs: newest N lines")
    parser.add_argument("--grep", default="", help="logs: regular expression a line must match")
    args = parser.parse_args(argv)

    try:
        if args.command == COMMAND_START:
            result = colab_pycore_runner.start()
        elif args.command == COMMAND_RESTART:
            result = colab_pycore_runner.restart()
        else:
            result = colab_pycore_runner.logs(args.tail, args.grep or None)
    except Exception as error:
        ColorPrint.red(f"[Colab] {args.command} failed: {type(error).__name__}: {error}")
        return 1
    if args.command == COMMAND_LOGS:
        ColorPrint.plain("\n".join(result.pop("lines", [])))
    ColorPrint.plain(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
