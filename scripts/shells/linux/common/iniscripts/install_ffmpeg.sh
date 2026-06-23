#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# install_ffmpeg.sh - Shared prerequisite installer for the ffmpeg/ffprobe binaries.
#
# Run by prepare.sh before the Pycore service launches. ffmpeg (and the ffprobe it
# bundles) are REQUIRED at run time by every audio engine pycore can use:
#   - openai-whisper / faster-whisper decode the input audio with ffmpeg;
#   - the TTS engines (edge-tts playback, MeloTTS, GPT-SoVITS) use it to encode /
#     convert audio.
# Previously install_whisper.sh only *checked* for ffmpeg and told the user to
# "install it later"; this installer actually provides it so STT/TTS work out of the
# box. ffmpeg is a runtime (not build-time) dependency, so its order among the other
# prerequisites does not matter - it just has to be present before the service serves.
#
# IDEMPOTENT: skips entirely when both ffmpeg and ffprobe are already on PATH.
# Cross-distro: the `ffmpeg` apt package ships ffmpeg + ffprobe on Debian 11-13,
# Ubuntu 18.04-26.04 and Kali (all from the distro's main repo).
#
# Usage:  ./install_ffmpeg.sh [--python <py>]
#         (--python is accepted but unused: ffmpeg is a system binary, not a pip pkg.)
# ---------------------------------------------------------------------------
set -uo pipefail

# Accept (and ignore) prepare.sh's --python / --force so the standard invocation works.
while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) shift 2 2>/dev/null || shift ;;
        --force)  shift ;;
        *)        shift ;;
    esac
done

echo "============================================================"
echo " Installing ffmpeg (audio codec for STT + TTS)"
echo "============================================================"

# Idempotent: reuse an existing install (ffmpeg ships ffprobe in the same package).
if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1; then
    echo "[install_ffmpeg] [OK] ffmpeg + ffprobe already present ($(ffmpeg -version 2>/dev/null | head -1)); skipping."
    exit 0
fi

# sudo prefix (root -> none; else sudo when available).
SUDO=""
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then SUDO="sudo"; fi

if ! command -v apt-get >/dev/null 2>&1; then
    echo "[install_ffmpeg] [!] apt-get not found; cannot auto-install ffmpeg. Install it manually: apt install ffmpeg"
    exit 0
fi

echo "[install_ffmpeg] [..] installing ffmpeg via apt ..."
$SUDO apt-get update -qq 2>/dev/null || true
if $SUDO apt-get install -y ffmpeg >/dev/null 2>&1; then
    if command -v ffmpeg >/dev/null 2>&1; then
        echo "[install_ffmpeg] [OK] ffmpeg installed: $(ffmpeg -version 2>/dev/null | head -1)"
    else
        echo "[install_ffmpeg] [!] apt reported success but ffmpeg is still not on PATH."
    fi
else
    echo "[install_ffmpeg] [!] failed to apt-install ffmpeg; STT/TTS audio decode may not work."
fi
exit 0
