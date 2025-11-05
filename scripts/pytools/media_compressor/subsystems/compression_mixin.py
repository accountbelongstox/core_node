"""Compression utilities for media files."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
from typing import Tuple

try:
    from ..colors import Colors
except ImportError:
    from colors import Colors

try:
    from PIL import Image
except ImportError:  # pragma: no cover - optional dependency
    print("Warning: PIL/Pillow not installed, image compression will be limited")
    print("Please run: pip install Pillow")
    Image = None  # type: ignore


class CompressionMixin:
    """Provides image/video/audio compression helpers."""

    IMAGE_MAX_DIMENSION: int
    IMAGE_MAX_SIZE_KB: int
    IMAGE_QUALITY: int
    VIDEO_MAX_DIMENSION: int
    VIDEO_CRF: int
    VIDEO_PRESET: str
    AUDIO_BITRATE: str
    COMPRESS_DIR: Path
    unified_compressor = None

    def _check_ffmpeg(self) -> bool:
        """Check if ffmpeg is available."""

        try:
            subprocess.run(
                ["ffmpeg", "-version"],
                capture_output=True,
                check=True,
                timeout=5,
            )
            return True
        except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
            return False

    def _get_video_dimensions(self, video_path: Path) -> Tuple[int, int]:
        """Return (width, height) for a video via ffprobe."""

        try:
            cmd = [
                "ffprobe",
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=width,height",
                "-of",
                "csv=p=0",
                str(video_path),
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                encoding="utf-8",
                errors="ignore",
                timeout=30,
            )
            if result.returncode == 0 and result.stdout and result.stdout.strip():
                output = result.stdout.strip()
                if "," in output:
                    parts = output.split(",")
                    if len(parts) == 2 and parts[0] and parts[1]:
                        width, height = map(int, parts)
                        return width, height
        except Exception as exc:  # pragma: no cover - ffprobe failure guard
            print(f"  ⚠ Failed to get video dimensions: {exc}")

        return 0, 0

    def _compress_image(self, src: Path, dst: Path) -> bool:
        """Compress an image using unified compressor or a PIL fallback."""

        if self.unified_compressor is not None:
            try:
                dst.parent.mkdir(parents=True, exist_ok=True)

                file_size_kb = src.stat().st_size / 1024
                needs_resize = False
                resize_dims = None

                if Image is not None:
                    try:
                        with Image.open(src) as img:
                            width, height = img.size
                            if max(width, height) > self.IMAGE_MAX_DIMENSION:
                                needs_resize = True
                                if width > height:
                                    new_width = self.IMAGE_MAX_DIMENSION
                                    new_height = int(height * (self.IMAGE_MAX_DIMENSION / width))
                                else:
                                    new_height = self.IMAGE_MAX_DIMENSION
                                    new_width = int(width * (self.IMAGE_MAX_DIMENSION / height))
                                resize_dims = (new_width, new_height)
                    except Exception:
                        pass

                needs_compress = file_size_kb > self.IMAGE_MAX_SIZE_KB

                if not needs_resize and not needs_compress:
                    shutil.copy2(src, dst)
                    return True

                stats = self.unified_compressor.compress_image(
                    input_path=str(src),
                    output_path=str(dst),
                    quality=self.IMAGE_QUALITY,
                    resize=resize_dims,
                    use_gpu=True,
                )

                return stats.compressed_size > 0

            except Exception as exc:
                print(f"  Unified compressor failed, falling back to legacy: {exc}")
                print(f"    Source: {src}")
                print(f"    Destination: {dst}")

        if Image is None:
            print("PIL not installed, cannot compress images")
            return False

        try:
            with Image.open(src) as img:
                if img.mode == "RGBA":
                    background = Image.new("RGB", img.size, (255, 255, 255))
                    background.paste(img, mask=img.split()[3])
                    img = background
                elif img.mode != "RGB":
                    img = img.convert("RGB")

                width, height = img.size
                file_size_kb = src.stat().st_size / 1024
                needs_resize = max(width, height) > self.IMAGE_MAX_DIMENSION
                needs_compress = file_size_kb > self.IMAGE_MAX_SIZE_KB

                if not needs_resize and not needs_compress:
                    shutil.copy2(src, dst)
                    return True

                if needs_resize:
                    if width > height:
                        new_width = self.IMAGE_MAX_DIMENSION
                        new_height = int(height * (self.IMAGE_MAX_DIMENSION / width))
                    else:
                        new_height = self.IMAGE_MAX_DIMENSION
                        new_width = int(width * (self.IMAGE_MAX_DIMENSION / height))

                    img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

                try:
                    dst.parent.mkdir(parents=True, exist_ok=True)
                except Exception as mkdir_err:  # pragma: no cover - filesystem guard
                    print(f"  Failed to create directory: {dst.parent}")
                    print(f"  Error: {mkdir_err}")
                    return False

                save_path = dst.with_suffix(".jpg") if dst.suffix.lower() != ".jpg" else dst
                try:
                    img.save(save_path, "JPEG", quality=self.IMAGE_QUALITY, optimize=True)
                except Exception as save_err:
                    print(f"  Failed to save image: {save_path}")
                    print(f"  Error: {save_err}")
                    return False

                if save_path != dst:
                    dst = save_path

                return True

        except Exception as exc:  # pragma: no cover - fallback guard
            print(f"Image compression failed: {exc}")
            print(f"  Source: {src}")
            print(f"  Destination: {dst}")
            print(f"  Destination parent: {dst.parent}")
            print(f"  Parent exists: {dst.parent.exists() if dst.parent else 'N/A'}")
            return False

    def _compress_video(self, src: Path, dst: Path) -> bool:
        """Compress a video using the unified compressor or ffmpeg fallback."""

        if self.unified_compressor is not None:
            try:
                dst.parent.mkdir(parents=True, exist_ok=True)

                width, height = self._get_video_dimensions(src)
                resolution = None
                if height > self.VIDEO_MAX_DIMENSION and width > 0 and height > 0:
                    new_height = self.VIDEO_MAX_DIMENSION
                    new_width = int(width * (self.VIDEO_MAX_DIMENSION / height))
                    new_width = new_width - (new_width % 2)
                    new_height = new_height - (new_height % 2)
                    resolution = (new_width, new_height)
                    print(
                        f"  Using unified compressor... (CRF={self.VIDEO_CRF}, "
                        f"{width}x{height} -> {new_width}x{new_height})"
                    )
                elif height > 0:
                    print(
                        f"  Using unified compressor... (CRF={self.VIDEO_CRF}, keeping {width}x{height})"
                    )
                else:
                    print(
                        f"  Using unified compressor... (CRF={self.VIDEO_CRF}, preset={self.VIDEO_PRESET})"
                    )

                stats = self.unified_compressor.compress_video(
                    input_path=str(src),
                    output_path=str(dst),
                    codec="h264",
                    preset=self.VIDEO_PRESET,
                    crf=self.VIDEO_CRF,
                    resolution=resolution,
                    use_gpu=True,
                    audio_codec="aac",
                    audio_bitrate=self.AUDIO_BITRATE,
                )

                if stats.compressed_size > 0:
                    print(
                        f"  ✓ Unified compressor completed: "
                        f"{self._format_size(stats.compressed_size)}"
                    )
                    return True

            except Exception as exc:
                print(f"  Unified compressor failed, falling back to legacy: {exc}")
                print(f"    Source: {src}")
                print(f"    Destination: {dst}")
                print(f"    Parent: {dst.parent}")

        if not self._check_ffmpeg():
            print("ffmpeg not installed or not in PATH")
            return False

        try:
            dst.parent.mkdir(parents=True, exist_ok=True)

            width, height = self._get_video_dimensions(src)
            cmd = [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                str(src),
                "-c:v",
                "libx264",
                "-preset",
                self.VIDEO_PRESET,
                "-crf",
                str(self.VIDEO_CRF),
            ]

            if height > self.VIDEO_MAX_DIMENSION:
                cmd.extend(["-vf", f"scale=-2:{self.VIDEO_MAX_DIMENSION}"])
                print(
                    f"  Compressing... (CRF={self.VIDEO_CRF}, {width}x{height} -> {self.VIDEO_MAX_DIMENSION}p)"
                )
            elif height > 0:
                print(
                    f"  Compressing... (CRF={self.VIDEO_CRF}, keeping {width}x{height})"
                )
            else:
                print(
                    f"  Compressing... (CRF={self.VIDEO_CRF}, preset={self.VIDEO_PRESET})"
                )

            cmd.extend(
                [
                    "-c:a",
                    "aac",
                    "-b:a",
                    self.AUDIO_BITRATE,
                    "-movflags",
                    "+faststart",
                    "-y",
                    str(dst),
                ]
            )

            print(f"  Command: {' '.join(cmd)}")
            print(f"  Processing (output below):")
            print(f"  {'-'*50}")

            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                encoding="utf-8",
                errors="ignore",
                bufsize=1,
                universal_newlines=True,
            )

            for line in process.stdout:
                line = line.strip()
                if line:
                    print(f"  {line}")

            process.wait()
            print(f"  {'-'*50}")

            if dst.exists() and dst.stat().st_size > 0:
                print(f"  ✓ Output file created: {self._format_size(dst.stat().st_size)}")
                return True

            print("  ✗ Output file not created or empty")
            return False

        except Exception as exc:  # pragma: no cover - ffmpeg guard
            print(f"  ✗ Video compression failed: {exc}")
            return False

    def _compress_audio(self, src: Path, dst: Path) -> bool:
        """Compress audio via ffmpeg."""

        if not self._check_ffmpeg():
            print("ffmpeg not installed or not in PATH")
            return False

        try:
            dst.parent.mkdir(parents=True, exist_ok=True)

            cmd = [
                "ffmpeg",
                "-i",
                str(src),
                "-c:a",
                "aac",
                "-b:a",
                self.AUDIO_BITRATE,
                "-vn",
                "-y",
                str(dst),
            ]

            print(f"  Compressing... (bitrate={self.AUDIO_BITRATE})")
            print(f"  Command: {' '.join(cmd)}")
            print(f"  Processing (output below):")
            print(f"  {'-'*50}")

            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                encoding="utf-8",
                errors="ignore",
                bufsize=1,
                universal_newlines=True,
            )

            for line in process.stdout:
                line = line.strip()
                if line:
                    print(f"  {line}")

            process.wait()
            print(f"  {'-'*50}")

            if dst.exists() and dst.stat().st_size > 0:
                print(f"  ✓ Output file created: {self._format_size(dst.stat().st_size)}")
                return True

            print("  ✗ Output file not created or empty")
            return False

        except Exception as exc:  # pragma: no cover - ffmpeg guard
            print(f"  ✗ Audio compression failed: {exc}")
            return False

    def _verify_file(self, filepath: Path):
        """Basic integrity verification hook for audio/video files."""

        try:
            if not filepath.exists():
                return False

            if filepath.stat().st_size == 0:
                return False

            if filepath.suffix.lower() in self.VIDEO_EXTENSIONS:
                if not self._check_ffmpeg():
                    return True

                cmd = [
                    "ffmpeg",
                    "-v",
                    "error",
                    "-i",
                    str(filepath),
                    "-f",
                    "null",
                    "-",
                ]

                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    encoding="utf-8",
                    errors="ignore",
                    timeout=600,
                )

                if result.returncode != 0:
                    return False

            return True
        except Exception:
            return None
