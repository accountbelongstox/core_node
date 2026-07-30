"""Concrete Ultralytics classification and detection trainers."""

import shutil
from pathlib import Path
from typing import Any, Dict, Optional, Sequence

from pycore.pyfoundations.third_party.api import get_third_package_ultralytics


class ClassificationTrainer:
    """Train an Ultralytics classification model from a prepared directory."""

    def __init__(self, source_dir: str, model: str = "yolov8n-cls.pt", project_name: Optional[str] = None):
        self.source_dir = Path(source_dir).resolve()
        self.model_name = model
        self.project_name = project_name or self.source_dir.name
        self.data_path: Optional[Path] = None

    def prepare_data(self) -> str:
        if not self.source_dir.is_dir():
            raise ValueError(f"Classification source directory not found: {self.source_dir}")
        class_dirs = [path for path in self.source_dir.iterdir() if path.is_dir()]
        if not class_dirs:
            raise ValueError(f"Classification source has no class directories: {self.source_dir}")
        self.data_path = self.source_dir
        return str(self.data_path)

    def train(self, **kwargs: Any) -> Any:
        data_path = self.data_path or Path(self.prepare_data())
        return _train_model(self.model_name, data_path, self.project_name, kwargs)


class DetectionTrainer:
    """Train an Ultralytics detection model from a data.yaml file."""

    def __init__(self, source_dir: str, model: str = "yolov8n.pt", project_name: Optional[str] = None):
        self.source_dir = Path(source_dir).resolve()
        self.model_name = model
        self.project_name = project_name or self.source_dir.name
        self.data_path: Optional[Path] = None

    def prepare_data(self) -> str:
        candidates = [self.source_dir / "data.yaml", self.source_dir / "dataset.yaml"]
        self.data_path = next((path for path in candidates if path.is_file()), None)
        if self.data_path is None:
            raise ValueError(f"Detection dataset YAML not found in: {self.source_dir}")
        return str(self.data_path)

    def train(self, **kwargs: Any) -> Any:
        data_path = self.data_path or Path(self.prepare_data())
        return _train_model(self.model_name, data_path, self.project_name, kwargs)


class UnifiedClassificationTrainer(ClassificationTrainer):
    """Train classification against multiple prepared source roots."""

    def __init__(self, source_dirs: Sequence[str], project_name: str = "unified_model", model: str = "yolov8n-cls.pt"):
        self.source_dirs = [Path(path).resolve() for path in source_dirs]
        common_parent = self.source_dirs[0].parent if self.source_dirs else Path.cwd()
        super().__init__(str(common_parent), model=model, project_name=project_name)

    def prepare_data(self) -> str:
        valid_sources = [path for path in self.source_dirs if path.is_dir()]
        if not valid_sources:
            raise ValueError("No valid classification source directories")
        output_root = valid_sources[0].parent / "_unified" / self.project_name / "classification"
        image_extensions = {".bmp", ".jpeg", ".jpg", ".png", ".webp"}
        copied = 0
        for source_dir in valid_sources:
            for class_name in ("yes", "no"):
                class_dir = source_dir / class_name
                if not class_dir.is_dir():
                    continue
                images = [
                    path
                    for path in sorted(class_dir.rglob("*"))
                    if path.is_file() and path.suffix.lower() in image_extensions
                ]
                for index, image_path in enumerate(images):
                    split = "val" if index % 5 == 0 else "train"
                    target_dir = output_root / split / class_name
                    target_dir.mkdir(parents=True, exist_ok=True)
                    target_name = f"{source_dir.name}_{image_path.stem}{image_path.suffix.lower()}"
                    shutil.copy2(image_path, target_dir / target_name)
                    copied += 1
        if copied == 0:
            raise ValueError("Unified classification sources contain no yes/no images")
        self.data_path = output_root
        return str(self.data_path)


class UnifiedDetectionTrainer(DetectionTrainer):
    """Train detection against one pre-combined dataset selected from source roots."""

    def __init__(self, source_dirs: Sequence[str], project_name: str = "unified_model", model: str = "yolov8n.pt"):
        self.source_dirs = [Path(path).resolve() for path in source_dirs]
        common_parent = self.source_dirs[0].parent if self.source_dirs else Path.cwd()
        super().__init__(str(common_parent), model=model, project_name=project_name)

    def prepare_data(self) -> str:
        valid_sources = [path for path in self.source_dirs if path.is_dir()]
        if not valid_sources:
            raise ValueError("No valid detection source directories")
        output_root = valid_sources[0].parent / "_unified" / self.project_name / "detection"
        image_extensions = {".bmp", ".jpeg", ".jpg", ".png", ".webp"}
        copied = 0
        class_names = []
        for class_id, source_dir in enumerate(valid_sources):
            class_names.append(source_dir.name)
            for split in ("train", "val"):
                images_dir = source_dir / "images" / split
                labels_dir = source_dir / "labels" / split
                if not images_dir.is_dir():
                    continue
                target_images = output_root / "images" / split
                target_labels = output_root / "labels" / split
                target_images.mkdir(parents=True, exist_ok=True)
                target_labels.mkdir(parents=True, exist_ok=True)
                for image_path in sorted(images_dir.iterdir()):
                    if not image_path.is_file() or image_path.suffix.lower() not in image_extensions:
                        continue
                    target_stem = f"{source_dir.name}_{image_path.stem}"
                    shutil.copy2(image_path, target_images / f"{target_stem}{image_path.suffix.lower()}")
                    source_label = labels_dir / f"{image_path.stem}.txt"
                    target_label = target_labels / f"{target_stem}.txt"
                    label_lines = []
                    if source_label.is_file():
                        for line in source_label.read_text(encoding="utf-8").splitlines():
                            fields = line.split()
                            if len(fields) >= 5:
                                fields[0] = str(class_id)
                                label_lines.append(" ".join(fields))
                    target_label.write_text("\n".join(label_lines), encoding="utf-8")
                    copied += 1
        if copied == 0:
            raise ValueError("Unified detection sources contain no split images")
        data_yaml = output_root / "data.yaml"
        yaml_lines = [
            f"path: {output_root.as_posix()}",
            "train: images/train",
            "val: images/val",
            f"nc: {len(class_names)}",
            "names:",
        ]
        yaml_lines.extend(
            f"  {index}: '{name.replace(chr(39), chr(39) * 2)}'"
            for index, name in enumerate(class_names)
        )
        data_yaml.parent.mkdir(parents=True, exist_ok=True)
        data_yaml.write_text("\n".join(yaml_lines) + "\n", encoding="utf-8")
        self.data_path = data_yaml
        return str(self.data_path)


def _train_model(model_name: str, data_path: Path, project_name: str, kwargs: Dict[str, Any]) -> Any:
    ultralytics = get_third_package_ultralytics()
    if ultralytics is None:
        raise RuntimeError("ultralytics is unavailable")
    train_options = dict(kwargs)
    train_options.setdefault("name", project_name)
    model = ultralytics.YOLO(model_name)
    return model.train(data=str(data_path), **train_options)


__all__ = [
    "ClassificationTrainer",
    "DetectionTrainer",
    "UnifiedClassificationTrainer",
    "UnifiedDetectionTrainer",
]
