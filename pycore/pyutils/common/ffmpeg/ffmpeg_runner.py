import re
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, Iterable, Optional

from pycore.pyutils.common.ffmpeg.ffmpeg_binary import ffmpeg_binary_resolver
from pycore.pyutils.common.ffmpeg.ffmpeg_constants import (
    ERROR_BINARY_NOT_FOUND,
    ERROR_PROCESS_FAILED,
    ERROR_PROCESS_STOPPED,
)
from pycore.pyutils.common.ffmpeg.ffmpeg_models import (
    FFmpegProcessResult,
    FFmpegProgress,
    ProgressCallback,
    StopCallback,
)


_NUMBER_PATTERN = re.compile(r"^-?\d+(?:\.\d+)?$")
_SPEED_PATTERN = re.compile(r"^-?\d+(?:\.\d+)?x$")


class FFmpegRunner:
    def run_ffmpeg(
        self,
        arguments: Iterable[str],
        progress_callback: Optional[ProgressCallback] = None,
        should_stop: Optional[StopCallback] = None,
    ) -> FFmpegProcessResult:
        binaries = ffmpeg_binary_resolver.resolve()
        if binaries.ffmpeg is None:
            return FFmpegProcessResult(error_code=ERROR_BINARY_NOT_FOUND)

        command = (
            str(binaries.ffmpeg),
            "-hide_banner",
            "-nostdin",
            "-loglevel",
            "error",
            "-nostats",
            "-progress",
            "pipe:1",
            *tuple(str(argument) for argument in arguments),
        )
        stderr_file = tempfile.TemporaryFile(
            mode="w+t",
            encoding="utf-8",
            errors="replace",
        )
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=stderr_file,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
        )
        progress_values: Dict[str, str] = {}
        progress = None
        stopped = False
        stdout_lines = []

        if process.stdout is not None:
            for raw_line in process.stdout:
                line = raw_line.strip()
                stdout_lines.append(line)
                if "=" in line:
                    key, value = line.split("=", 1)
                    progress_values[key] = value
                if line.startswith("progress="):
                    progress = self._build_progress(progress_values)
                    if progress_callback is not None:
                        progress_callback(progress)
                    progress_values = {}
                if should_stop is not None and should_stop():
                    stopped = True
                    process.terminate()
                    break

        return_code = process.wait()
        stderr_file.seek(0)
        stderr = stderr_file.read()
        stderr_file.close()
        success = return_code == 0 and not stopped
        error_code = None
        if stopped:
            error_code = ERROR_PROCESS_STOPPED
        elif not success:
            error_code = ERROR_PROCESS_FAILED
        return FFmpegProcessResult(
            success=success,
            command=command,
            return_code=return_code,
            stdout="\n".join(stdout_lines),
            stderr=stderr,
            error_code=error_code,
            stopped=stopped,
            progress=progress,
        )

    def run_ffprobe(self, arguments: Iterable[str]) -> FFmpegProcessResult:
        binaries = ffmpeg_binary_resolver.resolve()
        if binaries.ffprobe is None:
            return FFmpegProcessResult(error_code=ERROR_BINARY_NOT_FOUND)
        return self.run_binary(binaries.ffprobe, arguments)

    def run_ffmpeg_query(self, arguments: Iterable[str]) -> FFmpegProcessResult:
        binaries = ffmpeg_binary_resolver.resolve()
        if binaries.ffmpeg is None:
            return FFmpegProcessResult(error_code=ERROR_BINARY_NOT_FOUND)
        return self.run_binary(binaries.ffmpeg, arguments)

    @staticmethod
    def run_binary(binary: Path, arguments: Iterable[str]) -> FFmpegProcessResult:
        command = (str(binary), *tuple(str(argument) for argument in arguments))
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        success = completed.returncode == 0
        return FFmpegProcessResult(
            success=success,
            command=command,
            return_code=completed.returncode,
            stdout=completed.stdout or "",
            stderr=completed.stderr or "",
            error_code=None if success else ERROR_PROCESS_FAILED,
        )

    def _build_progress(self, values: Dict[str, str]) -> FFmpegProgress:
        return FFmpegProgress(
            frame=self._int_value(values.get("frame")),
            fps=self._float_value(values.get("fps")),
            speed=self._speed_value(values.get("speed")),
            out_time_seconds=self._time_value(values),
            total_size=self._int_value(values.get("total_size")),
            state=values.get("progress", "continue"),
            values=dict(values),
        )

    @staticmethod
    def _int_value(value: Optional[str]) -> int:
        text = (value or "").strip()
        return int(float(text)) if _NUMBER_PATTERN.fullmatch(text) else 0

    @staticmethod
    def _float_value(value: Optional[str]) -> float:
        text = (value or "").strip()
        return float(text) if _NUMBER_PATTERN.fullmatch(text) else 0.0

    @staticmethod
    def _speed_value(value: Optional[str]) -> float:
        text = (value or "").strip()
        return float(text[:-1]) if _SPEED_PATTERN.fullmatch(text) else 0.0

    def _time_value(self, values: Dict[str, str]) -> float:
        microseconds = self._int_value(values.get("out_time_us"))
        if microseconds:
            return microseconds / 1_000_000.0
        milliseconds = self._int_value(values.get("out_time_ms"))
        return milliseconds / 1_000_000.0 if milliseconds else 0.0


ffmpeg_runner = FFmpegRunner()
