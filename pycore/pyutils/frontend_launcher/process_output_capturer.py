"""Subprocess output capture for frontend launchers."""

import subprocess
import threading
from typing import Optional, TextIO

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


class StreamDrainThread(threading.Thread):
    """Echo one child-process stream line by line until EOF."""

    def __init__(self, stream: TextIO, prefix: str):
        super().__init__(name=f"StreamDrainThread{prefix}", daemon=True)
        self.stream = stream
        self.prefix = prefix

    def run(self) -> None:
        for raw_line in iter(self.stream.readline, ""):
            ColorPrint.plain(f"{self.prefix} {raw_line.rstrip()}".strip())


class OutputCapturer:
    """Drain stdout and stderr while waiting for a child process."""

    def __init__(self, prefix: str = ""):
        self.prefix = prefix

    def wait_and_capture(self, process: subprocess.Popen, timeout: Optional[float] = None) -> int:
        threads = [StreamDrainThread(stream, self.prefix) for stream in (process.stdout, process.stderr) if stream is not None]
        for thread in threads:
            thread.start()
        try:
            exit_code = process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            ColorPrint.yellow(f"[OutputCapturer] Process {process.pid} exceeded {timeout}s; terminating")
            process.terminate()
            exit_code = process.wait(timeout=5)
        for thread in threads:
            thread.join(timeout=1)
        return exit_code


__all__ = ["OutputCapturer"]
