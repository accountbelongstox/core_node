"""
Dataset Generator - Automatic Training Dataset Generator
==========================================================

Automatically generate positive and negative sample datasets with various data augmentation methods.

Features:
1. Base sample generation (100 positive + 100 negative samples)
2. Blur augmentation (100 positive + 100 negative)
3. Non-uniform stretch augmentation (100 positive + 100 negative)
4. Metadata append support for incremental dataset building
5. YOLO format label generation
6. Full compatibility with ultralytics_trainer.py

Author: AI Assistant
Date: 2025-10-03
"""

import os
import json
import random
from pathlib import Path
from typing import Optional, Dict, List, Tuple
from dataclasses import dataclass, asdict

from pycore.pyfoundations.third_party import get_third_package_cv2, get_third_package_numpy

cv2 = get_third_package_cv2()
numpy = get_third_package_numpy()


@dataclass
class DatasetConfig:
    """Dataset configuration"""
    # Basic configuration
    screen_image_path: str  # Screenshot image path
    template_image_path: str  # Template image path (target to find)
    output_dir: str  # Output directory
    class_name: str  # Class name (e.g., "yes_icon")

    # Generation count configuration
    base_positive_count: int = 100  # Base positive sample count
    base_negative_count: int = 100  # Base negative sample count
    blur_augment_count: int = 100   # Blur augmentation count (per class)
    stretch_augment_count: int = 100  # Stretch augmentation count (per class)

    # Augmentation parameters
    blur_kernel_sizes: List[int] = None  # Blur kernel size range
    stretch_ratio_range: Tuple[float, float] = (0.7, 1.5)  # Stretch ratio range

    # Dataset split ratios
    train_ratio: float = 0.7  # Training set ratio
    val_ratio: float = 0.2    # Validation set ratio
    test_ratio: float = 0.1   # Test set ratio

    # Metadata
    metadata_path: Optional[str] = None  # Existing metadata path (for append mode)

    def __post_init__(self):
        if self.blur_kernel_sizes is None:
            self.blur_kernel_sizes = [3, 5, 7, 9, 11]

        # Validate split ratios
        total_ratio = self.train_ratio + self.val_ratio + self.test_ratio
        if abs(total_ratio - 1.0) > 0.01:
            raise ValueError(f"Split ratios must sum to 1.0, got {total_ratio}")


@dataclass
class SampleMetadata:
    """Sample metadata"""
    sample_id: str  # Sample ID
    image_path: str  # Image path (relative to output_dir)
    label_path: str  # Label path (relative to output_dir)
    is_positive: bool  # Whether this is a positive sample
    bbox: Optional[Tuple[int, int, int, int]]  # Bounding box (x, y, w, h)
    augmentation: str  # Augmentation type: base/blur/stretch
    split: str  # Dataset split: train/val/test
    source_id: Optional[str] = None  # Source sample ID (for augmented samples)


class DatasetGenerator:
    """Dataset Generator for YOLO format training data"""

    def __init__(self, config: DatasetConfig):
        self.config = config
        self.screen_image = None
        self.template_image = None
        self.metadata: List[SampleMetadata] = []
        self.class_id = 0  # YOLO class ID (single class = 0)

        # Create output directory structure
        self.output_dir = Path(config.output_dir)
        self._create_directory_structure()

        # Load existing metadata if append mode
        if config.metadata_path and os.path.exists(config.metadata_path):
            self._load_metadata()

    def _create_directory_structure(self):
        """Create YOLO dataset directory structure"""
        # Create split directories
        for split in ['train', 'val', 'test']:
            images_dir = self.output_dir / 'images' / split
            labels_dir = self.output_dir / 'labels' / split
            images_dir.mkdir(parents=True, exist_ok=True)
            labels_dir.mkdir(parents=True, exist_ok=True)

        print(f"[DatasetGenerator] Created directory structure at: {self.output_dir}")

    def _load_metadata(self):
        """Load existing metadata for append mode"""
        try:
            with open(self.config.metadata_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for item in data:
                    self.metadata.append(SampleMetadata(**item))
            print(f"[DatasetGenerator] Loaded existing metadata: {len(self.metadata)} samples")
        except Exception as e:
            print(f"[DatasetGenerator] Warning: Failed to load metadata: {e}")

    def _save_metadata(self):
        """Save metadata to JSON file"""
        metadata_path = self.output_dir / "metadata.json"
        try:
            with open(metadata_path, 'w', encoding='utf-8') as f:
                json.dump([asdict(m) for m in self.metadata], f, indent=2, ensure_ascii=False)
            print(f"[DatasetGenerator] Saved metadata: {metadata_path}")
        except Exception as e:
            print(f"[DatasetGenerator] Error: Failed to save metadata: {e}")
            raise

    def _load_images(self):
        """Load screenshot and template images"""
        # Load screenshot
        self.screen_image = cv2.imread(self.config.screen_image_path)
        if self.screen_image is None:
            raise ValueError(f"Cannot load screen image: {self.config.screen_image_path}")

        # Load template
        self.template_image = cv2.imread(self.config.template_image_path)
        if self.template_image is None:
            raise ValueError(f"Cannot load template image: {self.config.template_image_path}")

        print(f"[DatasetGenerator] Loaded images:")
        print(f"  Screen: {self.screen_image.shape}")
        print(f"  Template: {self.template_image.shape}")

    def _assign_split(self) -> str:
        """Randomly assign sample to train/val/test split"""
        rand = random.random()
        if rand < self.config.train_ratio:
            return 'train'
        elif rand < self.config.train_ratio + self.config.val_ratio:
            return 'val'
        else:
            return 'test'

    def _generate_sample_id(self, prefix: str) -> str:
        """Generate unique sample ID"""
        existing_ids = {m.sample_id for m in self.metadata}
        counter = len(existing_ids) + 1
        while True:
            sample_id = f"{prefix}_{counter:06d}"
            if sample_id not in existing_ids:
                return sample_id
            counter += 1

    def _save_sample(self, image: np.ndarray, bbox: Optional[Tuple[int, int, int, int]],
                     is_positive: bool, augmentation: str, source_id: Optional[str] = None) -> SampleMetadata:
        """Save sample (image + YOLO label)"""
        # Generate sample ID and assign split
        prefix = "pos" if is_positive else "neg"
        sample_id = self._generate_sample_id(prefix)
        split = self._assign_split()

        # Save image
        image_filename = f"{sample_id}.jpg"
        images_dir = self.output_dir / 'images' / split
        image_path = images_dir / image_filename

        # Ensure image quality
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 95]
        cv2.imwrite(str(image_path), image, encode_param)

        # Save YOLO format label
        label_filename = f"{sample_id}.txt"
        labels_dir = self.output_dir / 'labels' / split
        label_path = labels_dir / label_filename

        if is_positive and bbox:
            # YOLO format: class_id center_x center_y width height (normalized)
            x, y, w, h = bbox
            img_h, img_w = image.shape[:2]

            # Validate bbox
            if w <= 0 or h <= 0 or img_w <= 0 or img_h <= 0:
                raise ValueError(f"Invalid bbox or image dimensions: bbox={bbox}, img_shape={image.shape}")

            center_x = (x + w / 2) / img_w
            center_y = (y + h / 2) / img_h
            norm_w = w / img_w
            norm_h = h / img_h

            # Ensure values are in valid range [0, 1]
            center_x = max(0.0, min(1.0, center_x))
            center_y = max(0.0, min(1.0, center_y))
            norm_w = max(0.0, min(1.0, norm_w))
            norm_h = max(0.0, min(1.0, norm_h))

            with open(label_path, 'w') as f:
                f.write(f"{self.class_id} {center_x:.6f} {center_y:.6f} {norm_w:.6f} {norm_h:.6f}\n")
        else:
            # Negative sample: empty label file
            label_path.write_text("")

        # Create metadata
        metadata = SampleMetadata(
            sample_id=sample_id,
            image_path=str(Path('images') / split / image_filename),
            label_path=str(Path('labels') / split / label_filename),
            is_positive=is_positive,
            bbox=bbox,
            augmentation=augmentation,
            split=split,
            source_id=source_id
        )

        self.metadata.append(metadata)
        return metadata

    def _generate_base_positive_samples(self) -> List[SampleMetadata]:
        """Generate base positive samples: randomly place template on screenshot"""
        print(f"\n[DatasetGenerator] Generating base positive samples ({self.config.base_positive_count})...")

        samples = []
        screen_h, screen_w = self.screen_image.shape[:2]
        template_h, template_w = self.template_image.shape[:2]

        # Validate dimensions
        if template_w >= screen_w or template_h >= screen_h:
            raise ValueError(f"Template ({template_w}x{template_h}) is larger than screen ({screen_w}x{screen_h})")

        for i in range(self.config.base_positive_count):
            # Random position
            max_x = screen_w - template_w
            max_y = screen_h - template_h

            x = random.randint(0, max_x)
            y = random.randint(0, max_y)

            # Copy screenshot and paste template
            result_image = self.screen_image.copy()
            result_image[y:y+template_h, x:x+template_w] = self.template_image

            # Save sample
            bbox = (x, y, template_w, template_h)
            metadata = self._save_sample(result_image, bbox, is_positive=True, augmentation="base")
            samples.append(metadata)

            if (i + 1) % 20 == 0:
                print(f"  Progress: {i + 1}/{self.config.base_positive_count}")

        print(f"[DatasetGenerator] Completed: {len(samples)} base positive samples")
        return samples

    def _generate_base_negative_samples(self) -> List[SampleMetadata]:
        """Generate base negative samples: extract regions from original screenshot"""
        print(f"\n[DatasetGenerator] Generating base negative samples ({self.config.base_negative_count})...")

        samples = []
        screen_h, screen_w = self.screen_image.shape[:2]
        template_h, template_w = self.template_image.shape[:2]

        for i in range(self.config.base_negative_count):
            # Random position
            max_x = screen_w - template_w
            max_y = screen_h - template_h

            if max_x <= 0 or max_y <= 0:
                break

            x = random.randint(0, max_x)
            y = random.randint(0, max_y)

            # Extract region from original screenshot
            cropped_image = self.screen_image[y:y+template_h, x:x+template_w].copy()

            # Save sample (negative, no bbox)
            metadata = self._save_sample(cropped_image, bbox=None, is_positive=False, augmentation="base")
            samples.append(metadata)

            if (i + 1) % 20 == 0:
                print(f"  Progress: {i + 1}/{self.config.base_negative_count}")

        print(f"[DatasetGenerator] Completed: {len(samples)} base negative samples")
        return samples

    def _apply_blur_augmentation(self, base_samples: List[SampleMetadata]) -> List[SampleMetadata]:
        """Apply blur augmentation"""
        print(f"\n[DatasetGenerator] Applying blur augmentation ({len(base_samples)} samples)...")

        augmented_samples = []
        for i, base_sample in enumerate(base_samples):
            # Read original image
            image_path = self.output_dir / base_sample.image_path
            image = cv2.imread(str(image_path))
            if image is None:
                print(f"  Warning: Cannot read image: {image_path}")
                continue

            # Random blur kernel size
            kernel_size = random.choice(self.config.blur_kernel_sizes)
            blurred_image = cv2.GaussianBlur(image, (kernel_size, kernel_size), 0)

            # Save augmented sample
            metadata = self._save_sample(
                blurred_image,
                bbox=base_sample.bbox,
                is_positive=base_sample.is_positive,
                augmentation="blur",
                source_id=base_sample.sample_id
            )
            augmented_samples.append(metadata)

            if (i + 1) % 20 == 0:
                print(f"  Progress: {i + 1}/{len(base_samples)}")

        print(f"[DatasetGenerator] Completed: {len(augmented_samples)} blur augmented samples")
        return augmented_samples

    def _apply_stretch_augmentation(self, base_samples: List[SampleMetadata]) -> List[SampleMetadata]:
        """Apply non-uniform stretch augmentation"""
        print(f"\n[DatasetGenerator] Applying stretch augmentation ({len(base_samples)} samples)...")

        augmented_samples = []
        for i, base_sample in enumerate(base_samples):
            # Read original image
            image_path = self.output_dir / base_sample.image_path
            image = cv2.imread(str(image_path))
            if image is None:
                print(f"  Warning: Cannot read image: {image_path}")
                continue

            h, w = image.shape[:2]

            # Random stretch ratios (non-uniform)
            ratio_x = random.uniform(*self.config.stretch_ratio_range)
            ratio_y = random.uniform(*self.config.stretch_ratio_range)
            new_w = max(1, int(w * ratio_x))
            new_h = max(1, int(h * ratio_y))

            # Apply stretch
            stretched_image = cv2.resize(image, (new_w, new_h))

            # Adjust bbox
            bbox = None
            if base_sample.bbox:
                x, y, bw, bh = base_sample.bbox
                bbox = (int(x * ratio_x), int(y * ratio_y), int(bw * ratio_x), int(bh * ratio_y))

            # Save augmented sample
            metadata = self._save_sample(
                stretched_image,
                bbox=bbox,
                is_positive=base_sample.is_positive,
                augmentation="stretch",
                source_id=base_sample.sample_id
            )
            augmented_samples.append(metadata)

            if (i + 1) % 20 == 0:
                print(f"  Progress: {i + 1}/{len(base_samples)}")

        print(f"[DatasetGenerator] Completed: {len(augmented_samples)} stretch augmented samples")
        return augmented_samples

    def generate(self) -> Dict:
        """Generate complete dataset"""
        print("\n" + "=" * 80)
        print("Dataset Generator - YOLO Format")
        print("=" * 80)
        print(f"Class: {self.config.class_name}")
        print(f"Output: {self.output_dir}")
        print("=" * 80)

        try:
            # 1. Load images
            self._load_images()

            # 2. Generate base samples
            base_positive = self._generate_base_positive_samples()
            base_negative = self._generate_base_negative_samples()

            # 3. Select samples for augmentation
            positive_for_augment = random.sample(
                base_positive,
                min(self.config.blur_augment_count, len(base_positive))
            )
            negative_for_augment = random.sample(
                base_negative,
                min(self.config.blur_augment_count, len(base_negative))
            )

            # 4. Blur augmentation
            blur_positive = self._apply_blur_augmentation(positive_for_augment)
            blur_negative = self._apply_blur_augmentation(negative_for_augment)

            # 5. Stretch augmentation
            stretch_samples = (
                positive_for_augment[:self.config.stretch_augment_count] +
                negative_for_augment[:self.config.stretch_augment_count]
            )
            stretch_augmented = self._apply_stretch_augmentation(stretch_samples)

            # 6. Save metadata
            self._save_metadata()

            # 7. Generate YOLO dataset config
            self._generate_dataset_yaml()

            # 8. Validate dataset
            validation_result = self._validate_dataset()

            # 9. Statistics
            total_positive = sum(1 for m in self.metadata if m.is_positive)
            total_negative = sum(1 for m in self.metadata if not m.is_positive)

            split_stats = {}
            for split in ['train', 'val', 'test']:
                split_count = sum(1 for m in self.metadata if m.split == split)
                split_stats[split] = split_count

            result = {
                "total_samples": len(self.metadata),
                "positive_samples": total_positive,
                "negative_samples": total_negative,
                "base_samples": len(base_positive) + len(base_negative),
                "blur_augmented": len(blur_positive) + len(blur_negative),
                "stretch_augmented": len(stretch_augmented),
                "split_stats": split_stats,
                "output_dir": str(self.output_dir),
                "validation": validation_result
            }

            print("\n" + "=" * 80)
            print("Dataset Generation Completed")
            print("=" * 80)
            print(f"Total samples: {result['total_samples']}")
            print(f"  Positive: {result['positive_samples']}")
            print(f"  Negative: {result['negative_samples']}")
            print(f"\nSplit distribution:")
            print(f"  Train: {split_stats['train']}")
            print(f"  Val: {split_stats['val']}")
            print(f"  Test: {split_stats['test']}")
            print(f"\nAugmentation:")
            print(f"  Base: {result['base_samples']}")
            print(f"  Blur: {result['blur_augmented']}")
            print(f"  Stretch: {result['stretch_augmented']}")
            print(f"\nOutput: {result['output_dir']}")
            print(f"Validation: {'PASSED' if validation_result['valid'] else 'FAILED'}")
            print("=" * 80)

            return result

        except Exception as e:
            print(f"\n[DatasetGenerator] Error: Generation failed: {e}")
            import traceback
            traceback.print_exc()
            return {}

    def _validate_dataset(self) -> Dict:
        """Validate dataset integrity"""
        print("\n[DatasetGenerator] Validating dataset...")

        issues = []
        valid = True

        # Check if all files exist
        for meta in self.metadata:
            img_path = self.output_dir / meta.image_path
            lbl_path = self.output_dir / meta.label_path

            if not img_path.exists():
                issues.append(f"Missing image: {img_path}")
                valid = False

            if not lbl_path.exists():
                issues.append(f"Missing label: {lbl_path}")
                valid = False

        # Check YOLO label format
        for meta in self.metadata:
            if meta.is_positive:
                lbl_path = self.output_dir / meta.label_path
                try:
                    with open(lbl_path, 'r') as f:
                        line = f.readline().strip()
                        if line:
                            parts = line.split()
                            if len(parts) != 5:
                                issues.append(f"Invalid label format: {lbl_path}")
                                valid = False
                except Exception as e:
                    issues.append(f"Cannot read label: {lbl_path}: {e}")
                    valid = False

        result = {
            "valid": valid,
            "issues_count": len(issues),
            "issues": issues[:10]  # First 10 issues only
        }

        if valid:
            print("[DatasetGenerator] Validation PASSED")
        else:
            print(f"[DatasetGenerator] Validation FAILED: {len(issues)} issues found")
            for issue in issues[:5]:
                print(f"  - {issue}")

        return result

    def _generate_dataset_yaml(self):
        """Generate YOLO dataset configuration file"""
        yaml_path = self.output_dir / "data.yaml"
        yaml_content = f"""# YOLO Dataset Configuration
# Compatible with Ultralytics YOLO
path: {self.output_dir.absolute()}
train: images/train
val: images/val
test: images/test

# Classes
nc: 1  # number of classes
names: ['{self.config.class_name}']  # class names

# Dataset info
generated_by: dataset_generator.py
class_id: {self.class_id}
"""
        yaml_path.write_text(yaml_content)
        print(f"[DatasetGenerator] Generated dataset config: {yaml_path}")


def generate_dataset_from_config(config_path: str) -> Dict:
    """Generate dataset from config file"""
    with open(config_path, 'r', encoding='utf-8') as f:
        config_dict = json.load(f)

    config = DatasetConfig(**config_dict)
    generator = DatasetGenerator(config)
    return generator.generate()


def generate_dataset(
    screen_image_path: str,
    template_image_path: str,
    output_dir: str,
    class_name: str,
    **kwargs
) -> Dict:
    """Quick generate dataset

    Args:
        screen_image_path: Path to screenshot image
        template_image_path: Path to template image (target to find)
        output_dir: Output directory
        class_name: Class name for YOLO training
        **kwargs: Additional configuration parameters

    Returns:
        Dictionary with generation results and statistics
    """
    config = DatasetConfig(
        screen_image_path=screen_image_path,
        template_image_path=template_image_path,
        output_dir=output_dir,
        class_name=class_name,
        **kwargs
    )
    generator = DatasetGenerator(config)
    return generator.generate()


if __name__ == "__main__":
    # Example usage
    result = generate_dataset(
        screen_image_path="screenshot.png",
        template_image_path="yes_icon.png",
        output_dir="./datasets/yes_icon_dataset",
        class_name="yes_icon"
    )
    print(f"\nGeneration result: {result}")
