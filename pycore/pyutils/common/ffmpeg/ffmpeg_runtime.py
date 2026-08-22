import hashlib
import os
from pathlib import Path
from typing import Iterable, Optional

from pycore.pyutils.common.ffmpeg.ffmpeg_binary import ffmpeg_binary_resolver
from pycore.pyutils.common.ffmpeg.ffmpeg_constants import (
    ERROR_OUTPUT_INVALID,
)
from pycore.pyutils.common.ffmpeg.ffmpeg_models import (
    FFmpegBinaries,
    FFmpegCommandResult,
    MediaProbeResult,
    ProbeValidator,
    ProgressCallback,
    StopCallback,
)
from pycore.pyutils.common.ffmpeg.ffmpeg_probe import ffprobe_client
from pycore.pyutils.common.ffmpeg.ffmpeg_runner import ffmpeg_runner


class FFmpegRuntime:
    def binaries(self) -> FFmpegBinaries:
        return ffmpeg_binary_resolver.resolve()

    def available(self) -> bool:
        return self.binaries().available

    def probe(self, media_path: str | Path) -> MediaProbeResult:
        return ffprobe_client.probe(media_path)

    def supports_encoder(self, encoder: str) -> bool:
        result = ffmpeg_runner.run_ffmpeg_query(("-hide_banner", "-encoders"))
        return result.success and encoder in result.stdout

    def execute_output_step(
        self,
        arguments: Iterable[str],
        output_path: str | Path,
        dependencies: Iterable[str | Path] = (),
        expected_streams: tuple[str, ...] = (),
        output_validator: Optional[ProbeValidator] = None,
        progress_callback: Optional[ProgressCallback] = None,
        should_stop: Optional[StopCallback] = None,
    ) -> FFmpegCommandResult:
        argument_tuple = tuple(str(argument) for argument in arguments)
        dependency_tuple = tuple(Path(dependency).expanduser() for dependency in dependencies)
        output = Path(output_path).expanduser().resolve()
        operation_key = self._operation_key(argument_tuple, dependency_tuple)
        temporary = output.with_name(
            f"{output.stem}.partial.{operation_key[:12]}{output.suffix}")
        state = output.parent / ".ffmpeg_steps" / f"{output.name}.step"

        if (
            self._state_matches(state, operation_key)
            and self._valid_output(output, expected_streams, output_validator)
        ):
            return FFmpegCommandResult(success=True, output_path=output, skipped=True)

        output.parent.mkdir(parents=True, exist_ok=True)
        if self._valid_output(temporary, expected_streams, output_validator):
            os.replace(temporary, output)
            self._write_state(state, operation_key)
            return FFmpegCommandResult(success=True, output_path=output, recovered=True)

        if temporary.exists():
            temporary.unlink()

        process = ffmpeg_runner.run_ffmpeg(
            (*argument_tuple, str(temporary)),
            progress_callback=progress_callback,
            should_stop=should_stop,
        )
        if not process.success:
            if temporary.exists():
                temporary.unlink()
            return FFmpegCommandResult(
                output_path=output,
                error_code=process.error_code,
                process=process,
            )

        if not self._valid_output(temporary, expected_streams, output_validator):
            if temporary.exists():
                temporary.unlink()
            return FFmpegCommandResult(
                output_path=output,
                error_code=ERROR_OUTPUT_INVALID,
                process=process,
            )

        os.replace(temporary, output)
        self._write_state(state, operation_key)
        return FFmpegCommandResult(success=True, output_path=output, process=process)

    @staticmethod
    def _operation_key(
        arguments: tuple[str, ...],
        dependencies: tuple[Path, ...] = (),
    ) -> str:
        fingerprint_parts = list(arguments)
        input_paths = []
        for index, argument in enumerate(arguments):
            if index == 0 or arguments[index - 1] != "-i":
                continue
            input_path = Path(argument).expanduser()
            if input_path.exists():
                input_paths.append(input_path)
        input_paths.extend(dependencies)
        for input_path in input_paths:
            FFmpegRuntime._append_path_fingerprint(fingerprint_parts, input_path)
        payload = "\0".join(fingerprint_parts).encode("utf-8")
        return hashlib.sha256(payload).hexdigest()

    @staticmethod
    def _append_path_fingerprint(fingerprint_parts: list[str], input_path: Path) -> None:
        path = input_path.resolve()
        if path.is_file():
            input_stat = path.stat()
            fingerprint_parts.extend((
                str(path),
                str(input_stat.st_size),
                str(input_stat.st_mtime_ns),
            ))
            return
        if not path.is_dir():
            fingerprint_parts.extend((str(path), "missing"))
            return
        directory_stat = path.stat()
        fingerprint_parts.extend((str(path), str(directory_stat.st_mtime_ns)))
        for child in sorted(item for item in path.rglob("*") if item.is_file()):
            child_stat = child.stat()
            fingerprint_parts.extend((
                str(child.resolve()),
                str(child_stat.st_size),
                str(child_stat.st_mtime_ns),
            ))

    @staticmethod
    def _state_matches(state: Path, operation_key: str) -> bool:
        return state.is_file() and state.read_text(encoding="ascii").strip() == operation_key

    @staticmethod
    def _write_state(state: Path, operation_key: str) -> None:
        state.parent.mkdir(parents=True, exist_ok=True)
        temporary_state = state.with_name(f"{state.name}.partial")
        temporary_state.write_text(operation_key, encoding="ascii")
        os.replace(temporary_state, state)

    @staticmethod
    def _valid_output(
        output: Path,
        expected_streams: tuple[str, ...],
        output_validator: Optional[ProbeValidator],
    ) -> bool:
        probe = ffprobe_client.probe(output)
        if not probe.success:
            return False
        if not all(probe.has_stream(stream_type) for stream_type in expected_streams):
            return False
        return output_validator(probe) if output_validator is not None else True


ffmpeg_runtime = FFmpegRuntime()
