# -*- coding: utf-8 -*-
"""CLI: python -m pycore.pyutils.voc_annotator [--project-path PATH] [--images-dir DIR] | <images_dir> [save_dir] [--config PATH] [--project-name NAME]"""

import argparse
import sys

from .main_window import run_voc_annotator


def main() -> None:
    ap = argparse.ArgumentParser(description="VOC Annotator (pycore)")
    ap.add_argument("images_dir", nargs="?", default="", help="Directory of images to annotate (positional)")
    ap.add_argument("save_dir", nargs="?", default="", help="Directory to save VOC XML (default: images_dir)")
    ap.add_argument("--config", dest="config_path", default="", help="Path to project config JSON (classes, project_name)")
    ap.add_argument("--project-name", dest="project_name", default="", help="Project name (used with config)")
    ap.add_argument("--project-path", dest="project_path", default="", help="Project root (YOLO layout); loads config and segments from here")
    ap.add_argument("--images-dir", dest="images_dir_opt", default="", help="Images directory (optional when using --project-path)")
    args = ap.parse_args()
    images_dir = (args.images_dir_opt or args.images_dir or "").strip() or None
    run_voc_annotator(
        images_dir=images_dir,
        save_dir=args.save_dir or None,
        project_name=args.project_name or None,
        config_path=args.config_path or None,
        project_path=args.project_path or None,
    )
    sys.exit(0)


if __name__ == "__main__":
    main()
