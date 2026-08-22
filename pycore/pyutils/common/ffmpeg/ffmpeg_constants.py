from pathlib import Path


VIDEO_EXTENSIONS = {
    ".3g2", ".3gp", ".asf", ".avi", ".divx", ".f4v", ".flv", ".m2ts",
    ".m4v", ".mkv", ".mov", ".mp4", ".mpeg", ".mpg", ".mts", ".ogv",
    ".rm", ".rmvb", ".ts", ".vob", ".webm", ".wmv",
}

AUDIO_CODECS = {
    "aac": {"encoder": "aac", "extension": ".m4a", "bitrate": "32k"},
    "mp3": {"encoder": "libmp3lame", "extension": ".mp3", "bitrate": "32k"},
    "opus": {"encoder": "libopus", "extension": ".opus", "bitrate": "24k"},
    "vorbis": {"encoder": "libvorbis", "extension": ".ogg", "bitrate": "48k"},
}

VIDEO_ENCODER_CODECS = {
    "h264_nvenc": "h264",
    "hevc_nvenc": "hevc",
    "libx264": "h264",
    "libx265": "hevc",
}
AUDIO_ENCODER_CODECS = {
    "aac": "aac",
    "libmp3lame": "mp3",
    "libopus": "opus",
    "libvorbis": "vorbis",
}

OPUS_SAMPLE_RATES = (8000, 12000, 16000, 24000, 48000)
OPUS_PROBE_SAMPLE_RATE = 48000
DEFAULT_MOBILE_VIDEO_RESOLUTION = (1080, 1920)
DEFAULT_VIDEO_FRAME_RATE = 30
DEFAULT_VIDEO_BACKGROUND_COLOR = "#10131A"
DEFAULT_PROGRESS_TRACK_COLOR = "#303846"
DEFAULT_PROGRESS_FILL_COLOR = "#4DA3FF"
DEFAULT_PROGRESS_BAR_HEIGHT = 24
LINUX_BINARY_DIRECTORIES = (Path("/usr/local/bin"), Path("/usr/bin"), Path("/bin"))
WINDOWS_INSTALL_ROOTS = (Path("D:/applications/FFmpeg"),)
WINDOWS_SEARCH_DEPTH = 4

ERROR_BINARY_NOT_FOUND = "ffmpeg_binary_not_found"
ERROR_INPUT_NOT_FOUND = "ffmpeg_input_not_found"
ERROR_OUTPUT_INVALID = "ffmpeg_output_invalid"
ERROR_PROCESS_FAILED = "ffmpeg_process_failed"
ERROR_PROCESS_STOPPED = "ffmpeg_process_stopped"
ERROR_PROBE_FAILED = "ffprobe_failed"
ERROR_AUDIO_INPUT_INVALID = "ffmpeg_audio_input_invalid"
ERROR_SUBTITLE_INPUT_INVALID = "ffmpeg_subtitle_input_invalid"
