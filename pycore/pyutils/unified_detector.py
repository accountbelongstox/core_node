#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified Object Detector
通用目标检测器 - 可作为类库使用，也可作为命令行工具运行

Usage as library:
    from pycore.pyutils.unified_detector import UnifiedDetector

    # 简单使用（自动使用最新模型）
    detector = UnifiedDetector("d3-check")
    results = detector.detect("screenshot.png")

    # 指定模型
    detector = UnifiedDetector("d3-check", model_name="unified_model_20251017_143052")

    # 只检测特定类别
    results = detector.detect("screenshot.png", target_class="progress_bar")

Usage as CLI:
    # 基本检测
    python -m pycore.pyutils.unified_detector d3-check screenshot.png

    # 查看帮助
    python -m pycore.pyutils.unified_detector d3-check --help

    # 列出可用类别
    python -m pycore.pyutils.unified_detector d3-check --list-classes
"""

import os
import sys
import cv2
import numpy as np
import yaml
from pathlib import Path
from typing import List, Dict, Any, Optional, Union
from dataclasses import dataclass
import argparse
import json


@dataclass
class DetectionResult:
    """检测结果数据类"""
    class_name: str          # 类别名称
    confidence: float        # 置信度
    bbox: Dict[str, int]     # 边界框 {x, y, w, h}
    model_type: str          # 模型类型 (classification/detection)
    model_name: str          # 模型名称

    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            'class': self.class_name,
            'confidence': self.confidence,
            'bbox': self.bbox,
            'model_type': self.model_type,
            'model_name': self.model_name
        }

    def __repr__(self) -> str:
        return f"Detection({self.class_name}, conf={self.confidence:.2f}, bbox={self.bbox})"


class UnifiedDetector:
    """
    通用目标检测器

    支持自动加载分类和检测模型，提供简单的检测接口
    """

    def __init__(
        self,
        project_name: str,
        model_name: Optional[str] = None,
        model_type: Optional[str] = None,  # 'classification', 'detection', or None (auto)
        confidence_threshold: float = 0.25,
        device: str = 'auto'
    ):
        """
        初始化检测器

        Args:
            project_name: 项目名称（apps 下的目录名，如 'd3-check'）
            model_name: 模型名称（可选，默认使用最新模型）
            model_type: 模型类型（可选，'classification'/'detection'/None=自动检测）
            confidence_threshold: 置信度阈值
            device: 设备 ('auto', 'cpu', 'cuda', 'mps')
        """
        self.project_name = project_name
        self.confidence_threshold = confidence_threshold
        self.device = self._detect_device(device)

        # 定位项目目录
        self.project_root = self._find_project_root(project_name)
        if not self.project_root:
            raise ValueError(f"Project '{project_name}' not found in apps directory")

        # 模型目录
        self.cache_dir = self.project_root / ".cache" / "training_data"
        self.classification_dir = self.cache_dir / "3_models" / "classification"
        self.detection_dir = self.cache_dir / "3_models" / "detection"

        # 加载模型
        self.classification_model = None
        self.detection_model = None
        self.classification_info = None
        self.detection_info = None

        self._load_models(model_name, model_type)

    def _find_project_root(self, project_name: str) -> Optional[Path]:
        """查找项目根目录"""
        # 从当前文件向上查找 core_node
        current = Path(__file__).resolve()
        while current.parent != current:
            if current.name == 'core_node':
                apps_dir = current / 'apps' / project_name
                if apps_dir.exists():
                    return apps_dir
                break
            current = current.parent
        return None

    def _detect_device(self, device: str) -> str:
        """检测可用设备"""
        if device != 'auto':
            return device

        try:
            import torch
            if torch.cuda.is_available():
                return 'cuda'
            elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                return 'mps'
        except ImportError:
            pass
        return 'cpu'

    def _load_models(self, model_name: Optional[str], model_type: Optional[str]):
        """加载模型"""
        from ultralytics import YOLO
        import time

        # 如果指定了模型类型，只加载该类型
        load_cls = model_type in [None, 'classification']
        load_det = model_type in [None, 'detection']

        # 加载分类模型
        if load_cls and self.classification_dir.exists():
            models = self._scan_models(self.classification_dir)
            if models:
                if model_name and model_name in models:
                    selected = models[model_name]
                else:
                    # 使用最新模型
                    selected = sorted(models.items(), key=lambda x: x[1]['mtime'], reverse=True)[0][1]

                self.classification_model = YOLO(str(selected['path']))
                self.classification_info = selected

        # 加载检测模型
        if load_det and self.detection_dir.exists():
            models = self._scan_models(self.detection_dir)
            if models:
                if model_name and model_name in models:
                    selected = models[model_name]
                else:
                    # 使用最新模型
                    selected = sorted(models.items(), key=lambda x: x[1]['mtime'], reverse=True)[0][1]

                self.detection_model = YOLO(str(selected['path']))
                self.detection_info = selected

                # 加载类别信息
                data_yaml = self.cache_dir / "2_datasets" / "detection" / "unified_model" / "data.yaml"
                if data_yaml.exists():
                    with open(data_yaml, 'r', encoding='utf-8') as f:
                        data = yaml.safe_load(f)
                        if 'names' in data:
                            self.detection_info['classes'] = data['names']

        if not self.classification_model and not self.detection_model:
            raise ValueError(f"No models found for project '{self.project_name}'")

    def _scan_models(self, model_dir: Path) -> Dict[str, Dict]:
        """扫描模型目录"""
        import time
        models = {}

        for subdir in model_dir.iterdir():
            if not subdir.is_dir():
                continue

            best_pt = subdir / "weights" / "best.pt"
            if best_pt.exists():
                mtime = best_pt.stat().st_mtime
                models[subdir.name] = {
                    'name': subdir.name,
                    'path': best_pt,
                    'mtime': mtime,
                    'mtime_str': time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(mtime))
                }

        return models

    def get_available_classes(self) -> List[str]:
        """获取可用的检测类别"""
        classes = []

        if self.classification_model:
            classes.extend(['yes', 'no'])  # 分类模型的类别

        if self.detection_model and self.detection_info:
            classes.extend(self.detection_info.get('classes', []))

        return list(set(classes))

    def get_model_info(self) -> Dict[str, Any]:
        """获取模型信息"""
        info = {
            'project': self.project_name,
            'device': self.device,
            'confidence_threshold': self.confidence_threshold
        }

        if self.classification_model:
            info['classification'] = {
                'name': self.classification_info['name'],
                'created': self.classification_info['mtime_str'],
                'classes': ['yes', 'no']
            }

        if self.detection_model:
            info['detection'] = {
                'name': self.detection_info['name'],
                'created': self.detection_info['mtime_str'],
                'classes': self.detection_info.get('classes', [])
            }

        return info

    def detect(
        self,
        image: Union[str, Path, np.ndarray],
        target_class: Optional[str] = None,
        confidence_threshold: Optional[float] = None,
        use_640: bool = True
    ) -> List[DetectionResult]:
        """
        检测图片中的目标

        Args:
            image: 图片路径或 numpy 数组
            target_class: 目标类别（可选，只返回指定类别的检测结果）
            confidence_threshold: 置信度阈值（可选，覆盖初始化时的值）
            use_640: 是否使用 640x640 优化（仅检测模型）

        Returns:
            检测结果列表
        """
        # 加载图片
        if isinstance(image, (str, Path)):
            img = cv2.imread(str(image))
            if img is None:
                raise ValueError(f"Failed to load image: {image}")
        else:
            img = image

        conf_thresh = confidence_threshold if confidence_threshold is not None else self.confidence_threshold
        results = []

        # 分类模型检测
        if self.classification_model:
            cls_results = self._detect_classification(img, conf_thresh)
            results.extend(cls_results)

        # 检测模型检测
        if self.detection_model:
            det_results = self._detect_detection(img, conf_thresh, use_640)
            results.extend(det_results)

        # 过滤目标类别
        if target_class:
            results = [r for r in results if r.class_name == target_class]

        return results

    def _detect_classification(
        self,
        image: np.ndarray,
        confidence_threshold: float,
        window_size: int = 76,
        stride: Optional[int] = None
    ) -> List[DetectionResult]:
        """分类模型检测（滑动窗口）"""
        img_h, img_w = image.shape[:2]

        if stride is None:
            stride = window_size // 2

        results = []

        for y in range(0, img_h - window_size + 1, stride):
            for x in range(0, img_w - window_size + 1, stride):
                window = image[y:y+window_size, x:x+window_size]

                # 预测
                preds = self.classification_model(window, verbose=False)

                for pred in preds:
                    if hasattr(pred, 'probs'):
                        probs = pred.probs
                        class_id = int(probs.top1)
                        confidence = float(probs.top1conf)

                        # class_id=1 表示 "yes"
                        if class_id == 1 and confidence >= confidence_threshold:
                            results.append(DetectionResult(
                                class_name='yes',
                                confidence=confidence,
                                bbox={'x': x, 'y': y, 'w': window_size, 'h': window_size},
                                model_type='classification',
                                model_name=self.classification_info['name']
                            ))

        return results

    def _detect_detection(
        self,
        image: np.ndarray,
        confidence_threshold: float,
        use_640: bool = True,
        iou_threshold: float = 0.45
    ) -> List[DetectionResult]:
        """检测模型检测"""
        orig_h, orig_w = image.shape[:2]
        classes = self.detection_info.get('classes', [])

        if use_640 and (orig_w > 640 or orig_h > 640):
            # 640x640 优化
            target_size = 640
            scale = min(target_size / orig_w, target_size / orig_h)
            new_w = int(orig_w * scale)
            new_h = int(orig_h * scale)

            # 缩放并添加 padding
            resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
            canvas = np.zeros((target_size, target_size, 3), dtype=np.uint8)
            pad_x = (target_size - new_w) // 2
            pad_y = (target_size - new_h) // 2
            canvas[pad_y:pad_y+new_h, pad_x:pad_x+new_w] = resized

            # 检测
            preds = self.detection_model(
                canvas,
                conf=confidence_threshold,
                iou=iou_threshold,
                verbose=False
            )
        else:
            # 原始尺寸检测
            scale = 1.0
            pad_x = pad_y = 0
            preds = self.detection_model(
                image,
                conf=confidence_threshold,
                iou=iou_threshold,
                verbose=False
            )

        results = []

        for pred in preds:
            boxes = pred.boxes
            for box in boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                confidence = float(box.conf[0])
                class_id = int(box.cls[0])

                # 转换坐标回原始尺寸
                if use_640 and scale != 1.0:
                    x1 = (x1 - pad_x) / scale
                    y1 = (y1 - pad_y) / scale
                    x2 = (x2 - pad_x) / scale
                    y2 = (y2 - pad_y) / scale

                # 裁剪到边界
                x1 = max(0, min(x1, orig_w))
                y1 = max(0, min(y1, orig_h))
                x2 = max(0, min(x2, orig_w))
                y2 = max(0, min(y2, orig_h))

                class_name = classes[class_id] if class_id < len(classes) else f"class_{class_id}"

                results.append(DetectionResult(
                    class_name=class_name,
                    confidence=confidence,
                    bbox={
                        'x': int(x1),
                        'y': int(y1),
                        'w': int(x2 - x1),
                        'h': int(y2 - y1)
                    },
                    model_type='detection',
                    model_name=self.detection_info['name']
                ))

        return results

    def detect_and_draw(
        self,
        image: Union[str, Path, np.ndarray],
        output_path: Optional[Union[str, Path]] = None,
        target_class: Optional[str] = None,
        **kwargs
    ) -> tuple[List[DetectionResult], np.ndarray]:
        """
        检测并绘制结果

        Args:
            image: 输入图片
            output_path: 输出路径（可选）
            target_class: 目标类别（可选）
            **kwargs: 传递给 detect() 的其他参数

        Returns:
            (检测结果, 绘制后的图片)
        """
        # 加载图片
        if isinstance(image, (str, Path)):
            img = cv2.imread(str(image))
            if img is None:
                raise ValueError(f"Failed to load image: {image}")
        else:
            img = image.copy()

        # 检测
        results = self.detect(img, target_class=target_class, **kwargs)

        # 绘制
        output = img.copy()
        colors = {
            'classification': (0, 255, 0),  # 绿色
            'detection': (0, 0, 255),       # 红色
        }

        for result in results:
            color = colors.get(result.model_type, (255, 0, 0))
            bbox = result.bbox
            x, y, w, h = bbox['x'], bbox['y'], bbox['w'], bbox['h']

            # 绘制框
            cv2.rectangle(output, (x, y), (x+w, y+h), color, 2)

            # 绘制标签
            label = f"{result.class_name}: {result.confidence:.2f}"
            cv2.putText(
                output,
                label,
                (x, y - 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                color,
                2
            )

        # 保存
        if output_path:
            cv2.imwrite(str(output_path), output)

        return results, output


def main():
    """命令行入口"""
    parser = argparse.ArgumentParser(
        description="Unified Object Detector - 通用目标检测器",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 基本检测
  python -m pycore.pyutils.unified_detector d3-check screenshot.png

  # 查看帮助信息
  python -m pycore.pyutils.unified_detector d3-check --help

  # 列出可用类别
  python -m pycore.pyutils.unified_detector d3-check --list-classes

  # 只检测特定类别
  python -m pycore.pyutils.unified_detector d3-check screenshot.png --target progress_bar

  # 指定模型
  python -m pycore.pyutils.unified_detector d3-check screenshot.png --model unified_model_20251017_143052

  # 保存结果
  python -m pycore.pyutils.unified_detector d3-check screenshot.png --output result.png

  # JSON 输出
  python -m pycore.pyutils.unified_detector d3-check screenshot.png --json
        """
    )

    parser.add_argument(
        "project",
        type=str,
        help="项目名称（apps 目录下的项目，如 'd3-check'）"
    )

    parser.add_argument(
        "image",
        type=str,
        nargs='?',
        help="输入图片路径"
    )

    parser.add_argument(
        "--model",
        "-m",
        type=str,
        default=None,
        help="模型名称（默认使用最新模型）"
    )

    parser.add_argument(
        "--type",
        "-t",
        type=str,
        choices=['classification', 'detection'],
        default=None,
        help="模型类型（默认自动检测）"
    )

    parser.add_argument(
        "--conf",
        "--confidence",
        type=float,
        default=0.25,
        dest="confidence",
        help="置信度阈值（默认: 0.25）"
    )

    parser.add_argument(
        "--target",
        type=str,
        default=None,
        help="目标类别（只返回指定类别）"
    )

    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default=None,
        help="输出图片路径"
    )

    parser.add_argument(
        "--list-classes",
        action="store_true",
        help="列出可用的检测类别"
    )

    parser.add_argument(
        "--info",
        action="store_true",
        help="显示模型信息"
    )

    parser.add_argument(
        "--json",
        action="store_true",
        help="以 JSON 格式输出结果"
    )

    parser.add_argument(
        "--no-640",
        action="store_true",
        help="禁用 640x640 优化"
    )

    args = parser.parse_args()

    try:
        # 创建检测器
        detector = UnifiedDetector(
            project_name=args.project,
            model_name=args.model,
            model_type=args.type,
            confidence_threshold=args.confidence
        )

        # 列出类别
        if args.list_classes:
            classes = detector.get_available_classes()
            print("\n可用的检测类别:")
            for cls in classes:
                print(f"  - {cls}")
            return 0

        # 显示模型信息
        if args.info:
            info = detector.get_model_info()
            print("\n模型信息:")
            print(json.dumps(info, indent=2, ensure_ascii=False))
            return 0

        # 检测图片
        if not args.image:
            parser.error("需要提供图片路径，或使用 --list-classes / --info 查看信息")

        # 执行检测
        results = detector.detect(
            args.image,
            target_class=args.target,
            use_640=not args.no_640
        )

        # 输出结果
        if args.json:
            # JSON 格式
            output = {
                'image': args.image,
                'detections': [r.to_dict() for r in results],
                'count': len(results)
            }
            print(json.dumps(output, indent=2, ensure_ascii=False))
        else:
            # 文本格式
            print(f"\n检测结果: {args.image}")
            print(f"找到 {len(results)} 个目标:")

            for i, result in enumerate(results, 1):
                print(f"\n[{i}] {result.class_name}")
                print(f"    置信度: {result.confidence:.3f}")
                print(f"    位置: x={result.bbox['x']}, y={result.bbox['y']}, "
                      f"w={result.bbox['w']}, h={result.bbox['h']}")
                print(f"    模型: {result.model_name} ({result.model_type})")

        # 保存绘制结果
        if args.output:
            _, output_img = detector.detect_and_draw(
                args.image,
                output_path=args.output,
                target_class=args.target,
                use_640=not args.no_640
            )
            print(f"\n已保存结果到: {args.output}")

        return 0

    except Exception as e:
        print(f"\n错误: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
