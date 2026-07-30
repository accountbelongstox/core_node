# -*- coding: utf-8 -*-
"""
YOLO recording via direct import of GameAISDK. sys.path + RecordSession, in-memory control only (no HTTP, no bridge).
Uses YOLO_DATA_ROOT unified layout: project_path = root/client_type/project_name, segments = project_path/segment_id/, record in segment_id/record/.
"""

import json
import os
import runpy
import shutil
import sys
import threading
import time
from typing import List, Optional, Tuple

from pycore.pyfoundations.system_launcher import open_dir, open_path as open_path_system

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_D3_CHECK_ROOT = os.path.dirname(_THIS_DIR)
_PYAPPS = os.path.dirname(_D3_CHECK_ROOT)
GAMEAISDK_ROOT = os.path.join(_PYAPPS, "GameAISDK")
SDKTOOL_ROOT = os.path.join(GAMEAISDK_ROOT, "tools", "SDKTool")
GAMEAISDK_DOC = os.path.join(GAMEAISDK_ROOT, "doc")
ACTION_SAMPLER_PATH = os.path.join(SDKTOOL_ROOT, "src", "modules", "action_sampler")
ACTION_SAMPLER_ACTION_JSON = os.path.join(ACTION_SAMPLER_PATH, "cfg", "action.json")
SDKTOOL_MAIN = os.path.join(SDKTOOL_ROOT, "main.py")

DEFAULT_HTTP_PORT = 52808
DEVICE_WINDOWS = "Windows"

CLIENT_TYPE_TO_RECORD_SUBDIR = {
    "battlenet": "battlenet",
    "d3_game": "d3_game",
    "d4_game": "d4_game",
}

try:
    from pycore.pyutils.voc_annotator.yolo_data_layout import (
        YOLO_DATA_ROOT,
        get_yolo_data_root,
        get_yolo_project_path,
        get_yolo_segment_path,
        get_yolo_record_dir,
        ensure_yolo_segment_dirs_3,
        parse_project_path_to_client_project,
        RECORD_SUBDIR,
        FRAMES_SUBDIR,
    )
except ImportError:
    try:
        from providor.constants import common as _providor_common
        YOLO_DATA_ROOT = str(_providor_common.YOLO_DATA_ROOT)
    except Exception:
        YOLO_DATA_ROOT = os.environ.get("YOLO_DATA_ROOT", r"D:\programing\yolo_data")
    get_yolo_data_root = None
    get_yolo_project_path = None
    get_yolo_segment_path = None
    get_yolo_record_dir = None
    ensure_yolo_segment_dirs_3 = None
    parse_project_path_to_client_project = None
    RECORD_SUBDIR = "record"
    FRAMES_SUBDIR = "frames"

_session = None


def _ensure_gameaisdk_path():
    if ACTION_SAMPLER_PATH not in sys.path:
        sys.path.insert(0, ACTION_SAMPLER_PATH)


# Optional: GameAISDK embedded RecordSession (path set at module load so import at top per §6.1)
_ensure_gameaisdk_path()
try:
    import embedded as _embedded_record
except ImportError:
    _embedded_record = None

# Optional: cv2 for compose_segment_to_frames (module-level per §6.1)
try:
    from pycore.pyfoundations.third_party.api import get_third_package_cv2
    _cv2 = get_third_package_cv2()
except Exception:
    _cv2 = None
if _cv2 is None:
    try:
        import cv2 as _cv2
    except ImportError:
        _cv2 = None


def _get_record_session():
    global _session
    if _session is not None and not _session.is_running():
        _session = None
    return _session


def get_gameaisdk_root():
    return GAMEAISDK_ROOT


def get_sdktool_path():
    return SDKTOOL_ROOT


def launch_sdktool():
    if not os.path.isfile(SDKTOOL_MAIN):
        return False, "SDKTool not found"
    def _run_sdktool():
        prev_cwd = os.getcwd()
        prev_path0 = sys.path[0] if sys.path else ""
        try:
            os.chdir(SDKTOOL_ROOT)
            if SDKTOOL_ROOT not in sys.path:
                sys.path.insert(0, SDKTOOL_ROOT)
            runpy.run_path(SDKTOOL_MAIN, run_name="__main__")
        finally:
            os.chdir(prev_cwd)
            if sys.path and sys.path[0] == SDKTOOL_ROOT:
                sys.path.pop(0)
            if prev_path0 and prev_path0 not in sys.path:
                sys.path.insert(0, prev_path0)
    t = threading.Thread(target=_run_sdktool, daemon=True)
    t.start()
    return True, ""


def open_gameaisdk_doc(subpath: Optional[str] = None) -> bool:
    if not os.path.isdir(GAMEAISDK_DOC):
        return False
    target = os.path.join(GAMEAISDK_DOC, subpath) if subpath else GAMEAISDK_DOC
    target = os.path.normpath(target)
    if not os.path.exists(target):
        target = GAMEAISDK_DOC
    return open_path_system(target)


def get_action_sampler_path():
    return ACTION_SAMPLER_PATH


def get_cfg_path():
    return os.path.join(ACTION_SAMPLER_PATH, "cfg", "cfg.json")


def get_record_config_path():
    return os.path.join(GAMEAISDK_ROOT, "tools", "SDKTool", "Resource", "cfg", "record_cfg.json")


DEFAULT_RECORD_CONFIG = {
    "Debug": True,
    "FrameFPS": 10,
    "OutputAsVideo": False,
    "LogTimestamp": False,
    "FrameWidth": 640,
    "FrameHeight": 360,
    "RecordHttpPort": DEFAULT_HTTP_PORT,
}


def load_record_config():
    path = get_record_config_path()
    out = dict(DEFAULT_RECORD_CONFIG)
    if not os.path.isfile(path):
        return out
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        for k, v in data.items():
            if k in out:
                out[k] = v
    except (OSError, ValueError, TypeError):
        pass
    return out


def save_record_config(data):
    path = get_record_config_path()
    allowed = set(DEFAULT_RECORD_CONFIG)
    to_write = {k: data[k] for k in allowed if k in data}
    for k, default in DEFAULT_RECORD_CONFIG.items():
        if k not in to_write:
            to_write[k] = default
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(to_write, f, indent=4, ensure_ascii=False)
        return True, ""
    except Exception as e:
        return False, str(e)


def _project_path_from_client_type(client_type: str):
    """Return project path under YOLO_DATA_ROOT for client_type (default project name)."""
    return get_default_project_path(client_type)


def get_default_project_path(client_type: str) -> str:
    """Return and ensure YOLO_DATA_ROOT/{client_type}/default/ (per unified layout)."""
    if get_yolo_project_path is None:
        root = (YOLO_DATA_ROOT or "").replace("/", os.sep).rstrip(os.sep)
        if not root:
            return ""
        subdir = CLIENT_TYPE_TO_RECORD_SUBDIR.get(client_type) or "d3_game"
        path = os.path.join(root, subdir, "default")
        os.makedirs(path, exist_ok=True)
        return path
    subdir = CLIENT_TYPE_TO_RECORD_SUBDIR.get(client_type) or "d3_game"
    path = get_yolo_project_path(subdir, "default")
    if path:
        os.makedirs(path, exist_ok=True)
    return path


def is_valid_project_path(path: str) -> bool:
    """True if path is exactly {YOLO_DATA_ROOT}/{client_type}/{project_name} (no segment_id). Rejects old layout and segment paths."""
    if not path or not path.strip():
        return False
    if parse_project_path_to_client_project is None or get_yolo_project_path is None:
        root = (YOLO_DATA_ROOT or "").replace("/", os.sep).rstrip(os.sep)
        if not root or not os.path.normpath(path).startswith(os.path.normpath(root)):
            return False
        rel = os.path.normpath(path)[len(os.path.normpath(root)):].lstrip(os.sep)
        parts = [p for p in rel.split(os.sep) if p]
        return len(parts) == 2
    ct, pname = parse_project_path_to_client_project(path)
    if not ct or not pname:
        return False
    expected = get_yolo_project_path(ct, pname)
    return os.path.normpath(path.rstrip(os.sep)) == os.path.normpath(expected.rstrip(os.sep))


def is_recording():
    return _get_record_session() is not None


def _make_segment_id() -> str:
    """Generate segment id like seg_0_20250221_120000."""
    return "seg_0_{}".format(time.strftime("%Y%m%d_%H%M%S"))


def run_gameaisdk_start_record(
    *,
    project=None,
    client_type=None,
    device_type=DEVICE_WINDOWS,
    serial=None,
    port=DEFAULT_HTTP_PORT,
    width=640,
    height=360,
    log_callback=None,
):
    """Start recording via GameAISDK RecordSession (direct import, in-memory). Returns (ok, msg, project_path).
    Creates a new segment under project_path and writes to segment_path/record/ (SDK uses SavePath=segment_path, GameName=record).
    """
    global _session
    if _get_record_session() is not None:
        return False, "already_recording", None

    if not os.path.isfile(ACTION_SAMPLER_ACTION_JSON):
        return False, "action_config_not_found", None

    if project is None or (isinstance(project, str) and not project.strip()):
        project = _project_path_from_client_type(client_type) if (client_type and str(client_type).strip()) else None

    project_abs = os.path.abspath(project).rstrip(os.sep) if project and str(project).strip() else None
    if not project_abs:
        return False, "project_path_required", None

    segment_path = project_abs
    if parse_project_path_to_client_project and ensure_yolo_segment_dirs_3:
        ct, pname = parse_project_path_to_client_project(project_abs)
        if ct and pname:
            segment_id = _make_segment_id()
            ensure_yolo_segment_dirs_3(ct, pname, segment_id)
            segment_path = get_yolo_segment_path(ct, pname, segment_id)
    else:
        os.makedirs(project_abs, exist_ok=True)

    cfg = load_record_config()
    save_path = (segment_path.rstrip(os.sep) + os.sep) if segment_path else ""
    config_dict = {
        "GameName": RECORD_SUBDIR,
        "SavePath": save_path,
        "FrameFPS": int(cfg.get("FrameFPS", 10)),
        "FrameHeight": int(height),
        "FrameWidth": int(width),
        "Debug": bool(cfg.get("Debug", True)),
        "OutputAsVideo": bool(cfg.get("OutputAsVideo", False)),
        "LogTimestamp": bool(cfg.get("LogTimestamp", False)),
    }

    if device_type != DEVICE_WINDOWS or serial is None:
        return False, "windows_hwnd_required", None

    if _embedded_record is None:
        return False, "embedded_record_not_available", None
    try:
        hwnd = int(serial)
        _session = _embedded_record.RecordSession.create(
            hwnd, "Windows", config_dict, os.path.abspath(ACTION_SAMPLER_ACTION_JSON)
        )
        if _session is None:
            return False, "embedded_init_failed", None
    except Exception as e:
        _session = None
        return False, str(e), None
    return True, "", project_abs


start_record = run_gameaisdk_start_record


def start_record_segment(port: int = DEFAULT_HTTP_PORT) -> bool:
    s = _get_record_session()
    if s is not None:
        s.start_segment()
        return True
    return False


def end_record_segment(port: int = DEFAULT_HTTP_PORT) -> bool:
    s = _get_record_session()
    if s is not None:
        s.end_segment()
        return True
    return False


def stop_record(port: int = DEFAULT_HTTP_PORT):
    global _session
    s = _get_record_session()
    if s is not None:
        s.stop()
        _session = None
    return True, ""


def get_record_output_subdir(project_path: str) -> str:
    """Return project_path (segments are direct children under unified layout)."""
    if not project_path or not project_path.strip():
        return ""
    return os.path.abspath(project_path.rstrip(os.sep))


def open_record_directory(path: str, open_latest_segment: bool = True) -> bool:
    if not path or not path.strip():
        return False
    path = os.path.abspath(path.rstrip(os.sep))
    open_path = path
    if open_latest_segment and os.path.isdir(path):
        latest = get_latest_segment_dir(path)
        if latest:
            open_path = latest
    return open_dir(open_path)


def get_latest_segment_dir(project_path: str):
    """Return latest segment dir (project_path/segment_id). Segments are direct children of project_path."""
    if not project_path or not project_path.strip():
        return None
    proj = os.path.abspath(project_path.rstrip(os.sep))
    if not os.path.isdir(proj):
        return None
    try:
        subdirs = [d for d in os.listdir(proj) if os.path.isdir(os.path.join(proj, d))]
        if not subdirs:
            return None
        subdirs.sort(reverse=True)
        return os.path.join(proj, subdirs[0])
    except OSError:
        return None


def list_segments(project_path: str):
    """List all segment dirs under project_path. Returns list of (segment_id, segment_path) sorted newest first."""
    if not project_path or not project_path.strip():
        return []
    proj = os.path.abspath(project_path.rstrip(os.sep))
    if not os.path.isdir(proj):
        return []
    try:
        subdirs = [d for d in os.listdir(proj) if os.path.isdir(os.path.join(proj, d))]
        subdirs.sort(reverse=True)
        return [(d, os.path.join(proj, d)) for d in subdirs]
    except OSError:
        return []


def get_directory_size(path: str) -> int:
    """Return total size in bytes of directory (recursive). Returns 0 if path invalid."""
    if not path or not os.path.isdir(path):
        return 0
    total = 0
    try:
        for dirpath, _dirnames, filenames in os.walk(path):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                try:
                    total += os.path.getsize(fp)
                except OSError:
                    pass
    except OSError:
        pass
    return total


def _record_video_path(segment_path: str) -> Optional[str]:
    """Return path to video.avi: segment_path/record/video.avi or latest segment_path/record/*/video.avi."""
    if not segment_path or not os.path.isdir(segment_path):
        return None
    rec = os.path.join(segment_path, RECORD_SUBDIR)
    direct = os.path.join(rec, "video.avi")
    if os.path.isfile(direct):
        return direct
    candidates = []
    try:
        for name in os.listdir(rec):
            p = os.path.join(rec, name)
            if os.path.isdir(p):
                v = os.path.join(p, "video.avi")
                if os.path.isfile(v):
                    candidates.append((os.path.getmtime(v), v))
        if candidates:
            candidates.sort(key=lambda x: x[0], reverse=True)
            return candidates[0][1]
    except OSError:
        pass
    return None


def _record_jpgs(segment_path: str) -> List[str]:
    """Return list of .jpg paths under segment_path/record/ (direct or in subdirs). Prefer latest subdir first."""
    if not segment_path or not os.path.isdir(segment_path):
        return []
    rec = os.path.join(segment_path, RECORD_SUBDIR)
    out = []
    try:
        for f in os.listdir(rec):
            if f.lower().endswith(".jpg"):
                out.append(os.path.join(rec, f))
        subdirs = [(os.path.getmtime(os.path.join(rec, n)), n) for n in os.listdir(rec)
                   if os.path.isdir(os.path.join(rec, n))]
        subdirs.sort(key=lambda x: x[0], reverse=True)
        for _, name in subdirs:
            p = os.path.join(rec, name)
            for f in os.listdir(p):
                if f.lower().endswith(".jpg"):
                    out.append(os.path.join(p, f))
    except OSError:
        pass
    return out


def segment_has_labeled(segment_path: str) -> bool:
    """True if segment has frames/ dir with at least one .xml (VOC) or .txt (YOLO) label file."""
    if not segment_path or not os.path.isdir(segment_path):
        return False
    frames_dir = os.path.join(segment_path, FRAMES_SUBDIR)
    if not os.path.isdir(frames_dir):
        return False
    try:
        for f in os.listdir(frames_dir):
            low = f.lower()
            if low.endswith(".xml") or low.endswith(".txt"):
                return True
    except OSError:
        pass
    return False


def segment_info(segment_path: str):
    """Return dict with frames_count, has_video, has_frames, status, size_mb for a segment dir.
    status is one of: raw, exported, labeled. Video and raw images live under record/."""
    out = {"frames_count": 0, "has_video": False, "has_frames": False, "status": "raw", "size_mb": 0.0}
    if not segment_path or not os.path.isdir(segment_path):
        return out
    try:
        out["has_video"] = _record_video_path(segment_path) is not None
        frames_dir = os.path.join(segment_path, FRAMES_SUBDIR)
        out["has_frames"] = os.path.isdir(frames_dir)
        if out["has_frames"]:
            out["frames_count"] = len([f for f in os.listdir(frames_dir) if f.lower().endswith((".jpg", ".png"))])
        if not out["frames_count"] and not out["has_video"]:
            out["frames_count"] = len(_record_jpgs(segment_path))
        if segment_has_labeled(segment_path):
            out["status"] = "labeled"
        elif out["has_frames"] and out["frames_count"]:
            out["status"] = "exported"
        else:
            out["status"] = "raw"
        out["size_mb"] = round(get_directory_size(segment_path) / (1024 * 1024), 1)
    except OSError:
        pass
    return out


def continue_to_labeling(project_path: str, output_subdir: str = "frames", skip_frames: int = 1):
    """
    After stop: get latest segment dir, compose to frames, return (segment_dir, frames_dir).
    If no segment or compose fails, returns (segment_dir, None) or (None, None). Caller can open frames_dir for labeling.
    """
    segment_dir = get_latest_segment_dir(project_path)
    if not segment_dir:
        return None, None
    ok, _, frames_path = compose_segment_to_frames(
        segment_dir, output_subdir=output_subdir, skip_frames=skip_frames
    )
    return segment_dir, (frames_path if ok else None)


def open_frames_dir_for_labeling(frames_dir: str) -> bool:
    """Open frames directory in explorer for labeling (labelImg / YOLO). Returns True if opened."""
    if not frames_dir or not os.path.isdir(frames_dir):
        return False
    return open_dir(frames_dir)


def compose_segment_to_frames(
    segment_dir: str,
    output_subdir: str = "frames",
    skip_frames: int = 1,
    image_ext: str = ".png",
):
    """Export record to frames. Video/jpgs under segment_dir/record/ (or record/*/). Writes to segment_dir/output_subdir."""
    if not segment_dir or not os.path.isdir(segment_dir):
        return False, "segment_dir not found", None
    segment_dir = os.path.abspath(segment_dir)
    video_path = _record_video_path(segment_dir)
    out_frames_dir = os.path.join(segment_dir, output_subdir)
    try:
        if video_path and os.path.isfile(video_path):
            if _cv2 is None:
                return False, "cv2 not available", None
            os.makedirs(out_frames_dir, exist_ok=True)
            cap = _cv2.VideoCapture(video_path)
            idx = 0
            written = 0
            while True:
                ret, frame = cap.read()
                if frame is None or not ret:
                    break
                if idx % max(1, skip_frames) == 0:
                    name = "frame_{:06d}{}".format(written, image_ext)
                    _cv2.imwrite(os.path.join(out_frames_dir, name), frame)
                    written += 1
                idx += 1
            cap.release()
            return True, "extracted %d frames" % written, out_frames_dir
        jpgs = _record_jpgs(segment_dir)
        if jpgs:
            jpgs.sort()
            os.makedirs(out_frames_dir, exist_ok=True)
            written = 0
            for i, src in enumerate(jpgs):
                if i % max(1, skip_frames) == 0:
                    dst = os.path.join(out_frames_dir, "frame_{:06d}{}".format(written, image_ext))
                    shutil.copy2(src, dst)
                    written += 1
            return True, "copied %d frames" % written, out_frames_dir
        return False, "no video.avi or .jpg in segment record/", None
    except Exception as e:
        return False, str(e), None


def delete_segment(segment_path: str) -> tuple:
    """
    Delete a segment directory on disk. Returns (ok, message).
    Caller should ensure not recording and confirm with user.
    Safety: path must be under YOLO_DATA_ROOT.
    """
    if not segment_path or not os.path.isdir(segment_path):
        return False, "segment path not found or not a directory"
    segment_path = os.path.abspath(segment_path)
    root = (get_yolo_data_root() or YOLO_DATA_ROOT or "").replace("\\", "/")
    seg_n = segment_path.replace("\\", "/")
    if not root or not seg_n.startswith(root):
        return False, "path is not under YOLO_DATA_ROOT (safety)"
    try:
        shutil.rmtree(segment_path)
        return True, ""
    except OSError as e:
        return False, str(e)


def merge_segments_to_folder(
    segment_paths: List[str],
    target_dir: str,
    skip_frames: int = 1,
    image_ext: str = ".png",
) -> tuple:
    """
    Export each segment to frames, then copy all frames into target_dir with
    prefix seg_0_, seg_1_, ... to avoid name clash. Returns (ok, message, merged_frames_dir).
    """
    if not segment_paths or not target_dir:
        return False, "no segments or target dir", None
    target_dir = os.path.abspath(target_dir)
    try:
        os.makedirs(target_dir, exist_ok=True)
    except OSError as e:
        return False, str(e), None
    total_written = 0
    for i, seg_path in enumerate(segment_paths):
        if not seg_path or not os.path.isdir(seg_path):
            continue
        ok, _, frames_dir = compose_segment_to_frames(
            seg_path, output_subdir="frames", skip_frames=skip_frames, image_ext=image_ext
        )
        if not ok or not frames_dir or not os.path.isdir(frames_dir):
            continue
        prefix = "seg_{}_".format(i)
        for f in os.listdir(frames_dir):
            if f.lower().endswith((".jpg", ".png")):
                src = os.path.join(frames_dir, f)
                dst = os.path.join(target_dir, prefix + f)
                try:
                    shutil.copy2(src, dst)
                    total_written += 1
                except OSError:
                    pass
    if total_written == 0:
        return False, "no frames exported", None
    return True, "merged {} frames".format(total_written), target_dir
