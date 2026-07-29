#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Large Image Detection Training Data Preparation
Pastes small images back onto large images with random transformations
Generates YOLO format annotations for object detection training
"""

import os
import sys
import argparse
import random
import json
from pathlib import Path
from typing import List, Tuple, Dict, Optional

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)
from share.project_path import get_project_root
sys.path.insert(0, str(get_project_root().parent.parent))

from pycore.pyfoundations.third_party.api import get_third_package_cv2, get_third_package_numpy
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

cv2 = get_third_package_cv2()
np = get_third_package_numpy()


class DetectionDataGenerator:
    """
    Generates YOLO detection training data by pasting small images onto large backgrounds
    """

    def __init__(
        self,
        small_images_dir: Path,
        background_images: List[Path],
        output_dir: Path,
        namespace: str = "detection"
    ):
        """
        Initialize detection data generator

        Args:
            small_images_dir: Directory containing yes/no subdirectories with small images
            background_images: List of background images to paste onto
            output_dir: Output directory for generated training data
            namespace: Namespace for this training project (e.g., "detection", "progress_bar_det")
        """
        self.small_images_dir = Path(small_images_dir)
        self.background_images = [Path(bg) for bg in background_images]
        self.output_dir = Path(output_dir)
        self.namespace = namespace

        # Load small images
        self.yes_images = self._load_images(self.small_images_dir / "yes")
        self.no_images = self._load_images(self.small_images_dir / "no")

        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("🎨 Detection Data Generator")
        ColorPrint.blue(f"{'='*80}")
        ColorPrint.green(f"Namespace: {self.namespace}")
        ColorPrint.green(f"Small images: {len(self.yes_images)} yes, {len(self.no_images)} no")
        ColorPrint.green(f"Background images: {len(self.background_images)}")
        ColorPrint.green(f"Output directory: {self.output_dir}")

    def _load_images(self, directory: Path) -> List[np.ndarray]:
        """Load all images from a directory"""
        images = []
        if not directory.exists():
            return images

        for img_file in directory.glob("*.png"):
            img = cv2.imread(str(img_file))
            if img is not None:
                images.append(img)

        return images

    def _apply_transformations(
        self,
        image: np.ndarray,
        allow_rotation: bool = False,
        allow_stretch: bool = False,
        stretch_range: Tuple[float, float] = (0.8, 1.2),
        allow_shrink: bool = False,
        shrink_range: Tuple[float, float] = (0.8, 1.0)
    ) -> np.ndarray:
        """
        Apply random transformations to an image

        Args:
            image: Input image
            allow_rotation: Whether to allow random rotation
            allow_stretch: Whether to allow random stretching (aspect ratio change)
            stretch_range: Range for stretch factor (min, max)
            allow_shrink: Whether to allow random shrinking (uniform scale)
            shrink_range: Range for shrink factor (min, max)

        Returns:
            Transformed image
        """
        h, w = image.shape[:2]
        transformed = image.copy()

        # Apply shrink (uniform scaling)
        if allow_shrink:
            scale = random.uniform(shrink_range[0], shrink_range[1])
            new_w = int(w * scale)
            new_h = int(h * scale)
            transformed = cv2.resize(transformed, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
            h, w = new_h, new_w

        # Apply stretch (non-uniform scaling)
        if allow_stretch:
            scale_x = random.uniform(stretch_range[0], stretch_range[1])
            scale_y = random.uniform(stretch_range[0], stretch_range[1])
            new_w = int(w * scale_x)
            new_h = int(h * scale_y)
            transformed = cv2.resize(transformed, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
            h, w = new_h, new_w

        # Apply rotation
        if allow_rotation:
            angle = random.uniform(-15, 15)  # Random rotation between -15 and 15 degrees
            center = (w // 2, h // 2)
            rotation_matrix = cv2.getRotationMatrix2D(center, angle, 1.0)

            # Calculate new bounding box size
            cos = np.abs(rotation_matrix[0, 0])
            sin = np.abs(rotation_matrix[0, 1])
            new_w = int((h * sin) + (w * cos))
            new_h = int((h * cos) + (w * sin))

            # Adjust rotation matrix
            rotation_matrix[0, 2] += (new_w / 2) - center[0]
            rotation_matrix[1, 2] += (new_h / 2) - center[1]

            transformed = cv2.warpAffine(
                transformed,
                rotation_matrix,
                (new_w, new_h),
                flags=cv2.INTER_LINEAR,
                borderMode=cv2.BORDER_CONSTANT,
                borderValue=(0, 0, 0)
            )

        return transformed

    def _paste_image_on_background(
        self,
        background: np.ndarray,
        small_image: np.ndarray,
        position: Optional[Tuple[int, int]] = None
    ) -> Tuple[np.ndarray, Tuple[int, int, int, int]]:
        """
        Paste a small image onto a background at a random or specified position

        Args:
            background: Background image
            small_image: Small image to paste
            position: Optional (x, y) position for top-left corner

        Returns:
            Tuple of (result image, bbox as (x, y, w, h))
        """
        bg_h, bg_w = background.shape[:2]
        sm_h, sm_w = small_image.shape[:2]

        # Generate random position if not specified
        if position is None:
            max_x = max(0, bg_w - sm_w)
            max_y = max(0, bg_h - sm_h)
            x = random.randint(0, max_x) if max_x > 0 else 0
            y = random.randint(0, max_y) if max_y > 0 else 0
        else:
            x, y = position

        # Ensure image fits
        x = min(x, bg_w - sm_w)
        y = min(y, bg_h - sm_h)
        x = max(0, x)
        y = max(0, y)

        # Create result image
        result = background.copy()

        # Paste with alpha blending if possible, otherwise direct paste
        try:
            # Simple paste
            result[y:y+sm_h, x:x+sm_w] = small_image
        except:
            # If sizes don't match, skip
            pass

        # Return bbox
        bbox = (x, y, sm_w, sm_h)
        return result, bbox

    def generate_training_data(
        self,
        num_images: int = 100,
        objects_per_image: Tuple[int, int] = (1, 5),
        allow_rotation: bool = False,
        allow_stretch: bool = False,
        stretch_range: Tuple[float, float] = (0.8, 1.2),
        allow_shrink: bool = False,
        shrink_range: Tuple[float, float] = (0.8, 1.0),
        train_val_split: float = 0.8
    ) -> Dict[str, any]:
        """
        Generate YOLO detection training data

        Args:
            num_images: Number of training images to generate
            objects_per_image: Range of objects to paste per image (min, max)
            allow_rotation: Whether to allow random rotation
            allow_stretch: Whether to allow random stretching
            stretch_range: Range for stretch factor
            allow_shrink: Whether to allow random shrinking
            shrink_range: Range for shrink factor
            train_val_split: Ratio for train/val split (0.8 = 80% train, 20% val)

        Returns:
            Dictionary with generation statistics
        """
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("🎨 Generating YOLO Detection Training Data")
        ColorPrint.blue(f"{'='*80}")
        ColorPrint.green(f"Target images: {num_images}")
        ColorPrint.green(f"Objects per image: {objects_per_image[0]}-{objects_per_image[1]}")
        ColorPrint.green(f"Transformations:")
        ColorPrint.green(f"  - Rotation: {'Yes' if allow_rotation else 'No'}")
        ColorPrint.green(f"  - Stretch: {'Yes' if allow_stretch else 'No'} {stretch_range if allow_stretch else ''}")
        ColorPrint.green(f"  - Shrink: {'Yes' if allow_shrink else 'No'} {shrink_range if allow_shrink else ''}")

        # Create output directories
        images_dir = self.output_dir / "images"
        labels_dir = self.output_dir / "labels"

        train_images_dir = images_dir / "train"
        val_images_dir = images_dir / "val"
        train_labels_dir = labels_dir / "train"
        val_labels_dir = labels_dir / "val"

        for dir_path in [train_images_dir, val_images_dir, train_labels_dir, val_labels_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)

        # Generate images
        num_train = int(num_images * train_val_split)
        num_val = num_images - num_train

        stats = {
            'total_images': 0,
            'train_images': 0,
            'val_images': 0,
            'total_objects': 0,
            'yes_objects': 0,
            'no_objects': 0
        }

        for i in range(num_images):
            # Determine if train or val
            is_train = i < num_train
            img_dir = train_images_dir if is_train else val_images_dir
            lbl_dir = train_labels_dir if is_train else val_labels_dir

            # Select random background
            background = cv2.imread(str(random.choice(self.background_images)))
            if background is None:
                ColorPrint.yellow(f"Warning: Failed to load background image")
                continue

            bg_h, bg_w = background.shape[:2]

            # Determine number of objects
            num_objects = random.randint(objects_per_image[0], objects_per_image[1])

            # Generate annotations
            annotations = []
            result_image = background.copy()

            for obj_idx in range(num_objects):
                # Randomly choose yes or no
                is_yes = random.random() > 0.5
                source_images = self.yes_images if is_yes else self.no_images

                if not source_images:
                    continue

                # Select random small image
                small_img = random.choice(source_images).copy()

                # Apply transformations
                small_img = self._apply_transformations(
                    small_img,
                    allow_rotation=allow_rotation,
                    allow_stretch=allow_stretch,
                    stretch_range=stretch_range,
                    allow_shrink=allow_shrink,
                    shrink_range=shrink_range
                )

                # Paste onto background
                result_image, bbox = self._paste_image_on_background(result_image, small_img)

                # Convert bbox to YOLO format (normalized center x, center y, width, height)
                x, y, w, h = bbox
                center_x = (x + w / 2) / bg_w
                center_y = (y + h / 2) / bg_h
                norm_w = w / bg_w
                norm_h = h / bg_h

                # Class: 0=no, 1=yes
                class_id = 1 if is_yes else 0

                # Add annotation
                annotations.append(f"{class_id} {center_x:.6f} {center_y:.6f} {norm_w:.6f} {norm_h:.6f}")

                # Update stats
                stats['total_objects'] += 1
                if is_yes:
                    stats['yes_objects'] += 1
                else:
                    stats['no_objects'] += 1

            # Save image and annotations
            img_filename = f"{self.namespace}_{i:05d}.png"
            lbl_filename = f"{self.namespace}_{i:05d}.txt"

            cv2.imwrite(str(img_dir / img_filename), result_image)

            with open(lbl_dir / lbl_filename, 'w') as f:
                f.write('\n'.join(annotations))

            # Update stats
            stats['total_images'] += 1
            if is_train:
                stats['train_images'] += 1
            else:
                stats['val_images'] += 1

            if (i + 1) % 10 == 0:
                ColorPrint.green(f"Generated {i + 1}/{num_images} images...")

        # Create data.yaml
        yaml_content = f"""# YOLO Detection Dataset Configuration
# Namespace: {self.namespace}

path: {self.output_dir.absolute()}
train: images/train
val: images/val

# Classes
nc: 2  # number of classes
names: ['no', 'yes']  # class names
"""

        yaml_path = self.output_dir / "data.yaml"
        with open(yaml_path, 'w', encoding='utf-8') as f:
            f.write(yaml_content)

        # Save metadata
        metadata = {
            'namespace': self.namespace,
            'type': 'detection',
            'model_type': 'yolov8n.pt',
            'num_classes': 2,
            'class_names': ['no', 'yes'],
            'statistics': stats,
            'transformations': {
                'rotation': allow_rotation,
                'stretch': allow_stretch,
                'stretch_range': stretch_range if allow_stretch else None,
                'shrink': allow_shrink,
                'shrink_range': shrink_range if allow_shrink else None
            },
            'generation_params': {
                'num_images': num_images,
                'objects_per_image': objects_per_image,
                'train_val_split': train_val_split
            }
        }

        metadata_path = self.output_dir / "metadata.json"
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

        # Print summary
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.blue("✅ Generation Complete")
        ColorPrint.blue(f"{'='*80}")
        ColorPrint.green(f"Total images: {stats['total_images']}")
        ColorPrint.green(f"  Train: {stats['train_images']}")
        ColorPrint.green(f"  Val: {stats['val_images']}")
        ColorPrint.green(f"Total objects: {stats['total_objects']}")
        ColorPrint.green(f"  Yes: {stats['yes_objects']}")
        ColorPrint.green(f"  No: {stats['no_objects']}")
        ColorPrint.green(f"\nOutput directory: {self.output_dir}")
        ColorPrint.green(f"YAML config: {yaml_path}")
        ColorPrint.green(f"Metadata: {metadata_path}")

        return stats


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Generate YOLO detection training data from small images",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic usage
  python prepare_detection_training.py \\
    --small-images .cache/training_data/source/progress_bar \\
    --backgrounds screenshot1.png screenshot2.png \\
    --output .cache/training_data/detection/progress_bar \\
    --namespace progress_bar_det

  # With transformations
  python prepare_detection_training.py \\
    --small-images .cache/training_data/source/progress_bar \\
    --backgrounds screenshot*.png \\
    --output .cache/training_data/detection/progress_bar \\
    --namespace progress_bar_det \\
    --num-images 200 \\
    --objects-per-image 3 8 \\
    --allow-rotation \\
    --allow-stretch 0.8 1.2 \\
    --allow-shrink 0.7 1.0
        """
    )

    parser.add_argument(
        "--small-images",
        type=str,
        required=True,
        help="Directory containing yes/no subdirectories with small images"
    )

    parser.add_argument(
        "--backgrounds",
        type=str,
        nargs='+',
        required=True,
        help="Background images to paste onto (can use wildcards)"
    )

    parser.add_argument(
        "--output",
        type=str,
        required=True,
        help="Output directory for generated training data"
    )

    parser.add_argument(
        "--namespace",
        type=str,
        default="detection",
        help="Namespace for this training project (default: detection)"
    )

    parser.add_argument(
        "--num-images",
        type=int,
        default=100,
        help="Number of training images to generate (default: 100)"
    )

    parser.add_argument(
        "--objects-per-image",
        type=int,
        nargs=2,
        default=[1, 5],
        metavar=('MIN', 'MAX'),
        help="Range of objects to paste per image (default: 1 5)"
    )

    parser.add_argument(
        "--allow-rotation",
        action="store_true",
        help="Allow random rotation of small images"
    )

    parser.add_argument(
        "--allow-stretch",
        type=float,
        nargs=2,
        metavar=('MIN', 'MAX'),
        help="Allow random stretching (e.g., 0.8 1.2)"
    )

    parser.add_argument(
        "--allow-shrink",
        type=float,
        nargs=2,
        metavar=('MIN', 'MAX'),
        help="Allow random shrinking (e.g., 0.8 1.0)"
    )

    parser.add_argument(
        "--train-val-split",
        type=float,
        default=0.8,
        help="Train/val split ratio (default: 0.8)"
    )

    args = parser.parse_args()

    # Expand wildcards in background images
    from glob import glob
    background_files = []
    for pattern in args.backgrounds:
        matches = glob(pattern)
        if matches:
            background_files.extend(matches)
        else:
            background_files.append(pattern)

    if not background_files:
        ColorPrint.red("❌ No background images found")
        return 1

    # Create generator
    generator = DetectionDataGenerator(
        small_images_dir=args.small_images,
        background_images=background_files,
        output_dir=args.output,
        namespace=args.namespace
    )

    # Generate data
    stretch_range = tuple(args.allow_stretch) if args.allow_stretch else (0.8, 1.2)
    shrink_range = tuple(args.allow_shrink) if args.allow_shrink else (0.8, 1.0)

    generator.generate_training_data(
        num_images=args.num_images,
        objects_per_image=tuple(args.objects_per_image),
        allow_rotation=args.allow_rotation,
        allow_stretch=bool(args.allow_stretch),
        stretch_range=stretch_range,
        allow_shrink=bool(args.allow_shrink),
        shrink_range=shrink_range,
        train_val_split=args.train_val_split
    )

    return 0


if __name__ == "__main__":
    sys.exit(main())
