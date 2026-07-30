# -*- coding: utf-8 -*-
"""
YOLO detection training pipeline (aligned with GameAISDK doc/YOLO/TrainDetModel.md).
Steps: 1.Record 2.Export frames 3.Label 4.Clean unlabeled (optional) 5.VOC->YOLO 6.Config and train.
References GameAISDK Modules/darknetV3/src/yolo_label_lib.py for steps 3/4/5.
"""

import glob
import os
import shutil
import sys
from typing import List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from d3utils.yolo_record import (
    run_gameaisdk_start_record,
    stop_record,
    end_record_segment,
    start_record_segment,
    is_recording,
    get_latest_segment_dir,
    compose_segment_to_frames,
    open_frames_dir_for_labeling,
    get_gameaisdk_root,
)

_root = get_gameaisdk_root()
if _root:
    _core_node = os.path.dirname(os.path.dirname(_root))
    if os.path.isdir(os.path.join(_core_node, "pycore")) and _core_node not in sys.path:
        sys.path.insert(0, _core_node)
    _darknet_src = os.path.join(_root, "Modules", "darknetV3", "src")
    if os.path.isdir(_darknet_src) and _darknet_src not in sys.path:
        sys.path.insert(0, _darknet_src)

# GameAISDK yolo_label_lib (optional)
_gameaisdk_clean_unlabeled = None
_gameaisdk_voc_to_yolo = None
_gameaisdk_launch_labelimg = None
if _root:
    try:
        from yolo_label_lib import clean_unlabeled as _gameaisdk_clean_unlabeled
        from yolo_label_lib import voc_annotations_to_yolo_labels as _gameaisdk_voc_to_yolo
        from yolo_label_lib import launch_labelimg as _gameaisdk_launch_labelimg
    except ImportError:
        pass

import pycore.pyutils.voc_annotator.yolo_data_layout as yolo_data_layout

# ---------------------------------------------------------------------------
# Step 1: Record (GameAISDK action_sampler via d3utils.yolo_record RecordSession)
# ---------------------------------------------------------------------------


def flow1_config_record() -> None:
    """Step 1a: Config record. UI opens RecordConfigDialog; writes record_cfg.json (GameAISDK Config Record)."""
    pass


def flow1_start_record(project_path: str, hwnd: int, width: int, height: int, config: dict) -> Tuple[bool, str]:
    """Step 1b: Start recording. Calls GameAISDK RecordSession (run_gameaisdk_start_record)."""
    ok, msg, _ = run_gameaisdk_start_record(
        project=project_path,
        serial=hwnd,
        width=width,
        height=height,
    )
    return ok, msg or ""


def flow1_stop_record() -> Tuple[bool, str]:
    """Step 1c: Stop recording. end_segment then quit (stop_record)."""
    stop_record()
    return True, ""


def flow1_new_segment() -> bool:
    """Step 1d: New segment. end_segment then start_segment."""
    end_record_segment()
    return start_record_segment()


def flow1_is_recording() -> bool:
    """Step 1 state: whether currently recording."""
    return is_recording()


# ---------------------------------------------------------------------------
# Step 2: Export frames (TrainDetModel saveImg.py equivalent; compose_segment_to_frames)
# ---------------------------------------------------------------------------


def flow2_export_frames(project_path: str, skip_frames: int = 1) -> Tuple[bool, str, Optional[str]]:
    """Step 2: Export latest segment to frames dir (segment/frames/)."""
    segment_dir = get_latest_segment_dir(project_path)
    if not segment_dir:
        return False, "no_segment", None
    ok, msg, frames_dir = compose_segment_to_frames(
        segment_dir, output_subdir="frames", skip_frames=skip_frames
    )
    return ok, msg or "", frames_dir


# ---------------------------------------------------------------------------
# Step 3: Label (labelImg, VOC XML). TrainDetModel.md §3; GameAISDK yolo_label_lib.launch_labelimg
# ---------------------------------------------------------------------------


def flow3_open_label_tool(
    images_dir: Optional[str] = None,
    labels_output_dir: Optional[str] = None,
    project_path: Optional[str] = None,
    tk_after: Optional[object] = None,
) -> Tuple[bool, str]:
    """Open the GameAISDK labelImg integration for one image directory."""
    ColorPrint.blue("[DEBUG] flow3_open_label_tool entry: project_path=%s, images_dir=%s, labels_output_dir=%s" % (project_path, images_dir, labels_output_dir))
    ColorPrint.blue("[DEBUG] flow3_open_label_tool: project_ok=%s" % bool(project_path and os.path.isdir(project_path)))
    if not images_dir or not os.path.isdir(images_dir):
        ColorPrint.yellow("[DEBUG] flow3_open_label_tool: no valid images_dir or project_path, returning False")
        return False, "images_dir not found"
    if _gameaisdk_launch_labelimg is None:
        ColorPrint.yellow("[DEBUG] flow3_open_label_tool: GameAISDK launch_labelimg not available")
        return False, "GameAISDK yolo_label_lib not available"
    project_name = None
    config_path = None
    if project_path and os.path.isdir(project_path):
        project_name = os.path.basename(project_path.rstrip(os.sep))
        config_path = os.path.join(project_path, "annotator_config.json")
    ColorPrint.blue("[DEBUG] flow3_open_label_tool: using GameAISDK launch_labelimg, images_dir=%s" % images_dir)
    ok, msg = _gameaisdk_launch_labelimg(
        images_dir,
        labels_output_dir,
        project_name=project_name,
        config_path=config_path,
    )
    ColorPrint.blue("[DEBUG] flow3_open_label_tool: GameAISDK launch_labelimg returned ok=%s, msg=%s" % (ok, msg))
    if not ok:
        return False, msg or "Annotator failed to start"
    if open_frames_dir_for_labeling:
        open_frames_dir_for_labeling(images_dir)
    return True, ""


# ---------------------------------------------------------------------------
# Step 4: Clean unlabeled (optional). TrainDetModel.md §4; GameAISDK yolo_label_lib.clean_unlabeled
# ---------------------------------------------------------------------------


def flow4_clean_unlabeled(images_dir: str, labels_dir: Optional[str] = None) -> Tuple[bool, str]:
    """Step 4 (optional): Remove images without labels and labels without images. Uses GameAISDK yolo_label_lib."""
    if _gameaisdk_clean_unlabeled:
        return _gameaisdk_clean_unlabeled(images_dir, labels_dir)
    return False, "GameAISDK yolo_label_lib not available"


# ---------------------------------------------------------------------------
# Step 5: VOC to YOLO format. TrainDetModel.md §5; GameAISDK yolo_label_lib.voc_annotations_to_yolo_labels
# ---------------------------------------------------------------------------


def flow5_voc_to_yolo(
    voc_annotations_dir: str,
    labels_output_dir: str,
    image_id_list: List[str],
    classes: List[str],
) -> Tuple[bool, str]:
    """Step 5: VOC XML -> YOLO txt. Calls GameAISDK yolo_label_lib.voc_annotations_to_yolo_labels."""
    if _gameaisdk_voc_to_yolo:
        return _gameaisdk_voc_to_yolo(
            voc_annotations_dir, labels_output_dir, image_id_list, classes
        )
    return False, "GameAISDK yolo_label_lib not available"


def flow5_voc_to_yolo_from_annotations_dir(
    voc_annotations_dir: str,
    labels_output_dir: str,
    classes: List[str],
) -> Tuple[bool, str]:
    """Step 5 convenience: build image_id_list from *.xml in voc_annotations_dir then run VOC->YOLO."""
    if not os.path.isdir(voc_annotations_dir):
        return False, "annotations dir not found"
    xml_pattern = os.path.join(voc_annotations_dir, "*.xml")
    image_id_list = [os.path.splitext(os.path.basename(p))[0] for p in glob.glob(xml_pattern)]
    if not image_id_list:
        return False, "no XML files in annotations dir"
    return flow5_voc_to_yolo(voc_annotations_dir, labels_output_dir, image_id_list, classes)


# ---------------------------------------------------------------------------
# Training dir layout: D:\\programing\\yolo_data\\{project_name}\\{segment_id}\\
# Per Ultralytics: images/, labels/, data.yaml. Training auto-resizes (imgsz=640).
# ---------------------------------------------------------------------------


def get_yolo_training_dir(project_name: str, segment_id: str) -> str:
    """Return path to YOLO training dir for this project/segment (yolo_data_root/project/segment)."""
    if yolo_data_layout is None:
        return ""
    return yolo_data_layout.get_yolo_data_dir(project_name, segment_id)


def flow5_prepare_training_dir(
    project_name: str,
    segment_id: str,
    frames_dir: str,
    voc_annotations_dir: str,
    classes: List[str],
) -> Tuple[bool, str, Optional[str]]:
    """
    Prepare training dir at yolo_data/{project_name}/{segment_id}/: create images/, labels/,
    copy images from frames_dir to images/, run VOC->YOLO into labels/, write data.yaml.
    Returns (ok, message, data_yaml_path). Annotation uses any image size; export is normalized.
    Training will auto-resize (imgsz=640).
    """
    if yolo_data_layout is None:
        return False, "pycore voc_annotator not available", None
    if not os.path.isdir(frames_dir):
        return False, "frames_dir not found", None
    if not os.path.isdir(voc_annotations_dir):
        return False, "voc_annotations_dir not found", None
    if not classes:
        return False, "classes list is empty", None
    segment_dir = yolo_data_layout.ensure_yolo_segment_dirs(project_name, segment_id)
    if not segment_dir:
        return False, "invalid project_name or segment_id", None
    images_dir = os.path.join(segment_dir, yolo_data_layout.IMAGES_SUBDIR)
    labels_dir = os.path.join(segment_dir, yolo_data_layout.LABELS_SUBDIR)
    exts = (".jpg", ".jpeg", ".png", ".bmp")
    copied = 0
    try:
        for f in os.listdir(frames_dir):
            if f.lower().endswith(exts):
                src = os.path.join(frames_dir, f)
                if os.path.isfile(src):
                    shutil.copy2(src, os.path.join(images_dir, f))
                    copied += 1
    except OSError as e:
        return False, "copy images: %s" % e, None
    xml_pattern = os.path.join(voc_annotations_dir, "*.xml")
    image_id_list = [os.path.splitext(os.path.basename(p))[0] for p in glob.glob(xml_pattern)]
    if not image_id_list:
        return False, "no XML files in annotations dir", None
    ok, msg = flow5_voc_to_yolo(voc_annotations_dir, labels_dir, image_id_list, classes)
    if not ok:
        return False, msg or "VOC->YOLO failed", None
    yaml_path = yolo_data_layout.write_data_yaml(segment_dir, classes)
    return True, "Prepared %d images, %s" % (copied, msg or ""), yaml_path


# ---------------------------------------------------------------------------
# Step 6: Config and train. TODO: reference GameAISDK darknet. TrainDetModel.md §6
# ---------------------------------------------------------------------------


def flow6_get_train_config_paths() -> dict:
    """Step 6a: Return paths for training config (voc.names, voc.data, yolov3-voc.cfg). TODO: GameAISDK paths."""
    return {
        "voc_names": "TODO: data/voc.names",
        "voc_data": "TODO: cfg/voc.data",
        "yolo_cfg": "TODO: cfg/yolov3-voc.cfg",
        "backup": "TODO: backup",
    }


def flow6_start_train(
    train_txt: str,
    valid_txt: str,
    names_path: str,
    data_cfg_path: str,
    model_cfg_path: str,
    pretrained_weights: Optional[str] = None,
) -> Tuple[bool, str]:
    """Step 6b: Start darknet training. TODO: reference GameAISDK. TrainDetModel.md §6."""
    return False, "TODO: call GameAISDK darknet detector train (TrainDetModel.md §6)"


# ---------------------------------------------------------------------------
# Step summary for UI (which steps are ready)
# ---------------------------------------------------------------------------


def flow_get_step_summary(project_path: Optional[str], has_segment: bool, has_frames: bool) -> dict:
    """Return per-step readiness and step1 status for UI."""
    status = "recording" if flow1_is_recording() else "idle"
    return {
        "step1_ready": True,
        "step1_status": status,
        "step2_ready": bool(project_path and has_segment),
        "step3_ready": has_frames,
        "step4_ready": False,
        "step5_ready": False,
        "step6_ready": False,
    }
