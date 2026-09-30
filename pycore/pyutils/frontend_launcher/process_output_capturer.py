"""Subprocess output capture for frontend launchers."""

import subprocess
import threading
from typing import List, Optional
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


class OutputCapturer:
    """Drain stdout and stderr while waiting for a child process."""

    def __init__(self, prefix: str = ""):
        self.prefix = prefix
        self.lines: List[str] = []

    def wait_and_capture(self, process: subprocess.Popen, timeout: Optional[float] = None) -> int:
        threads = []
        for stream in (process.stdout, process.stderr):
            if stream is None:
                continue
            thread = threading.Thread(target=self._drain, args=(stream,), daemon=True)
            thread.start()
            threads.append(thread)
        try:
            exit_code = process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            process.terminate()
            exit_code = process.wait(timeout=5)
        for thread in threads:
            thread.join(timeout=1)
        return exit_code

    def _drain(self, stream) -> None:
        for raw_line in iter(stream.readline, ""):
            line = raw_line.rstrip("\r\n")
            self.lines.append(line)
            ColorPrint.plain(f"{self.prefix} {line}".strip())


__all__ = ["OutputCapturer"]
