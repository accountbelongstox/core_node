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

        # Validate source file
        if not src.exists():
            print(f"  {Colors.RED}Source file not found{Colors.RESET}", flush=True)
            return False

        print(f"  Compressing image...", flush=True)

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
                                print(f"    {width}x{height} -> {new_width}x{new_height}", flush=True)
                    except Exception:
                        pass

                needs_compress = file_size_kb > self.IMAGE_MAX_SIZE_KB

                if not needs_resize and not needs_compress:
                    print(f"    No compression needed, copying...", flush=True)
                    shutil.copy2(src, dst)
                    return True

                print(f"    Quality={self.IMAGE_QUALITY}, processing...", flush=True)
                stats = self.unified_compressor.compress_image(
                    input_path=str(src),
                    output_path=str(dst),
                    quality=self.IMAGE_QUALITY,
                    resize=resize_dims,
                    use_gpu=True,
                )

                return stats.compressed_size > 0

            except Exception as exc:
                print(f"  {Colors.YELLOW}Unified compressor failed, using PIL fallback{Colors.RESET}")
                print(f"    Error: {exc}")

        if Image is None:
            print(f"  {Colors.RED}PIL not installed, cannot compress images{Colors.RESET}")
            return False

        try:
            print(f"    Opening image with PIL...", flush=True)
            with Image.open(src) as img:
                if img.mode == "RGBA":
                    print(f"    Converting RGBA to RGB...", flush=True)
                    background = Image.new("RGB", img.size, (255, 255, 255))
                    background.paste(img, mask=img.split()[3])
                    img = background
                elif img.mode != "RGB":
                    print(f"    Converting {img.mode} to RGB...", flush=True)
                    img = img.convert("RGB")

                width, height = img.size
                file_size_kb = src.stat().st_size / 1024
                needs_resize = max(width, height) > self.IMAGE_MAX_DIMENSION
                needs_compress = file_size_kb > self.IMAGE_MAX_SIZE_KB

                if not needs_resize and not needs_compress:
                    print(f"    No compression needed, copying...", flush=True)
                    shutil.copy2(src, dst)
                    return True

                if needs_resize:
                    if width > height:
                        new_width = self.IMAGE_MAX_DIMENSION
                        new_height = int(height * (self.IMAGE_MAX_DIMENSION / width))
                    else:
                        new_height = self.IMAGE_MAX_DIMENSION
                        new_width = int(width * (self.IMAGE_MAX_DIMENSION / height))

                    print(f"    Resizing {width}x{height} -> {new_width}x{new_height}...", flush=True)
                    img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

                try:
                    # Ensure parent directory exists and is valid
                    dst.parent.mkdir(parents=True, exist_ok=True)
                except Exception as mkdir_err:  # pragma: no cover - filesystem guard
                    print(f"  {Colors.RED}Failed to create directory{Colors.RESET}", flush=True)
                    print(f"    Path: {dst.parent}", flush=True)
                    print(f"    Error: {mkdir_err}", flush=True)
                    return False

                save_path = dst.with_suffix(".jpg") if dst.suffix.lower() != ".jpg" else dst
                print(f"    Saving JPEG (quality={self.IMAGE_QUALITY})...", flush=True)
                try:
                    img.save(save_path, "JPEG", quality=self.IMAGE_QUALITY, optimize=True)
                except Exception as save_err:
                    print(f"  {Colors.RED}Failed to save image: {save_path}{Colors.RESET}")
                    print(f"  Error: {save_err}")
                    return False

                if save_path != dst:
                    dst = save_path

                return True

        except Exception as exc:  # pragma: no cover - fallback guard
            print(f"  {Colors.RED}Image compression failed: {exc}{Colors.RESET}")
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
                "info",
                "-stats",
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
                    f"  Compressing video: {width}x{height} -> {self.VIDEO_MAX_DIMENSION}p (CRF={self.VIDEO_CRF})", flush=True
                )
            elif height > 0:
                print(
                    f"  Compressing video: {width}x{height} (CRF={self.VIDEO_CRF})", flush=True
                )
            else:
                print(
                    f"  Compressing video (CRF={self.VIDEO_CRF}, preset={self.VIDEO_PRESET})", flush=True
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

            print(f"  $ {' '.join(cmd)}", flush=True)
            print(f"  {'-'*50}", flush=True)

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

            MIN_VALID_SIZE = 1024

            if dst.exists():
                size = dst.stat().st_size
                if size > MIN_VALID_SIZE:
                    print(f"  ✓ Output file created: {self._format_size(size)}")
                    return True
                elif size == 0:
                    print(f"  {Colors.RED}✗ Output file is empty (0 bytes){Colors.RESET}")
                else:
                    print(f"  {Colors.RED}✗ Output file too small ({size} bytes, likely corrupt){Colors.RESET}")
            else:
                print(f"  {Colors.RED}✗ Output file not created{Colors.RESET}")

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
                "-hide_banner",
                "-loglevel",
                "info",
                "-stats",
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

            print(f"  Compressing audio (bitrate={self.AUDIO_BITRATE})", flush=True)
            print(f"  $ {' '.join(cmd)}", flush=True)
            print(f"  {'-'*50}", flush=True)

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

            MIN_VALID_SIZE = 1024

            if dst.exists():
                size = dst.stat().st_size
                if size > MIN_VALID_SIZE:
                    print(f"  ✓ Output file created: {self._format_size(size)}")
                    return True
                elif size == 0:
                    print(f"  {Colors.RED}✗ Output file is empty (0 bytes){Colors.RESET}")
                else:
                    print(f"  {Colors.RED}✗ Output file too small ({size} bytes, likely corrupt){Colors.RESET}")
            else:
                print(f"  {Colors.RED}✗ Output file not created{Colors.RESET}")

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
