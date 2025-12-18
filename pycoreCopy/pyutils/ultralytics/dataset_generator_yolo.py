#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
YOLO Dataset Generator - Generic Data Preparation Library
Provides base classes for generating YOLO classification and detection datasets

Supports two modes:
1. Coordinate-based: Extract patches from large images using coordinates
2. Direct patch: Use small images directly (coordinates empty/None)
"""

import os
import json
import glob
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Callable, Union
from abc import ABC, abstractmethod

from pycore.pyfoundations.third_party import get_third_package_cv2, get_third_package_numpy

cv2 = get_third_package_cv2()
numpy = get_third_package_numpy()

# Import enhancer utilities (used in direct patch mode)
try:
    from pycore.pyutils.image_enhancer import ImageEnhancer, create_enhancement_from_config
    ENHANCER_AVAILABLE = True
except ImportError:
    try:
        from pycore.pyutils.image_enhancer import ImageEnhancer, create_enhancement_from_config
        ENHANCER_AVAILABLE = True
    except ImportError:
        ENHANCER_AVAILABLE = False
        ImageEnhancer = None
        create_enhancement_from_config = None


class YOLODatasetGenerator(ABC):
    """
    Abstract base class for YOLO dataset generation
    Subclasses implement specific data preparation logic
    """

    def __init__(self, output_dir: Path):
        """
        Initialize generator

        Args:
            output_dir: Output directory for generated dataset
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    @abstractmethod
    def generate(self, **kwargs) -> bool:
        """
        Generate dataset

        Returns:
            True if successful, False otherwise
        """
        pass

    def _blank_region(
        self,
        img: np.ndarray,
        x1: int,
        y1: int,
        x2: int,
        y2: int,
        margin: int = 10
    ):
        """
        Blank out a region by filling with surrounding average color

        Args:
            img: Image array (modified in-place)
            x1, y1, x2, y2: Region coordinates
            margin: Margin around region to sample surrounding color
        """
        h, w = img.shape[:2]

        # Get surrounding region
        sx1 = max(0, x1 - margin)
        sy1 = max(0, y1 - margin)
        sx2 = min(w, x2 + margin)
        sy2 = min(h, y2 + margin)

        # Create mask for surrounding region (excluding the center)
        surrounding = img[sy1:sy2, sx1:sx2].copy()
        mask = np.ones(surrounding.shape[:2], dtype=bool)

        # Mask out the center region
        cx1 = x1 - sx1
        cy1 = y1 - sy1
        cx2 = x2 - sx1
        cy2 = y2 - sy1
        mask[cy1:cy2, cx1:cx2] = False

        # Calculate average color
        if mask.sum() > 0:
            avg_color = surrounding[mask].mean(axis=0)
        else:
            avg_color = [0, 0, 0]

        # Fill with average color + noise
        noise = np.random.randint(-10, 11, (y2-y1, x2-x1, 3), dtype=np.int16)
        fill_color = np.clip(avg_color + noise, 0, 255).astype(np.uint8)

        img[y1:y2, x1:x2] = fill_color

    def _is_blank_region(self, crop: np.ndarray, threshold: int = 20) -> bool:
        """
        Check if a crop contains mostly blank regions

        Args:
            crop: Image crop
            threshold: Variance threshold

        Returns:
            True if blank, False otherwise
        """
        if crop.var() < threshold:
            return True
        if crop.mean() < 10:
            return True
        return False

    def _color_jitter(self, img: np.ndarray) -> np.ndarray:
        """
        Apply color jittering

        Args:
            img: Input image

        Returns:
            Jittered image
        """
        if np.random.random() > 0.5:
            # Brightness
            factor = np.random.uniform(0.9, 1.1)
            img = np.clip(img * factor, 0, 255).astype(np.uint8)

        if np.random.random() > 0.5:
            # Contrast
            factor = np.random.uniform(0.9, 1.1)
            mean = img.mean()
            img = np.clip((img - mean) * factor + mean, 0, 255).astype(np.uint8)

        return img

    def save_metadata(self, metadata: Dict, filename: str = "metadata.json"):
        """
        Save metadata to JSON file

        Args:
            metadata: Metadata dictionary
            filename: Output filename
        """
        metadata_file = self.output_dir / filename
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)


class ClassificationDatasetGenerator(YOLODatasetGenerator):
    """
    Classification dataset generator
    Generates yes/no folders with cropped patches and augmentation
    Supports multiple source images

    Two modes:
    1. Coordinate mode: coordinates not empty -> extract patches from large images
    2. Direct patch mode: coordinates empty -> use small images directly as patches
    """

    def __init__(
        self,
        background_image_paths: Optional[List[Path]] = None,
        patch_image_paths: Optional[List[Path]] = None,
        coordinates: Optional[List[Dict]] = None,
        output_dir: Path = None,
        aug_config: Optional[Dict] = None,
        enhancements: Optional[List[Dict]] = None,
        # Backwards compatibility
        image_paths: Optional[List[Path]] = None
    ):
        """
        Initialize classification dataset generator

        Supports three modes:
        1. Coordinate mode: background_image_paths + coordinates
        2. Direct patch mode: patch_image_paths (no coordinates)
        3. Mixed mode: BOTH background_image_paths + coordinates AND patch_image_paths

        Args:
            background_image_paths: Large background images for coordinate extraction
            patch_image_paths: Small patch images to use directly
            coordinates: List of coordinate dicts (for coordinate mode)
            output_dir: Output directory
            aug_config: Augmentation configuration
            enhancements: List of enhancement configs (for direct patch mode)
            image_paths: DEPRECATED - for backwards compatibility only
        """
        super().__init__(output_dir)

        # Backwards compatibility: if image_paths provided, auto-detect mode
        if image_paths is not None:
            self.image_paths = [Path(p) for p in (image_paths if isinstance(image_paths, list) else [image_paths])]
            # Auto-detect: if coordinates exist, treat as background images, else as patches
            if coordinates:
                background_image_paths = self.image_paths
                patch_image_paths = patch_image_paths or []
            else:
                background_image_paths = background_image_paths or []
                patch_image_paths = self.image_paths

        # Process background images
        self.background_image_paths = []
        if background_image_paths:
            if isinstance(background_image_paths, (str, Path)):
                self.background_image_paths = [Path(background_image_paths)]
            else:
                self.background_image_paths = [Path(p) for p in background_image_paths]

        # Process patch images
        self.patch_image_paths = []
        if patch_image_paths:
            if isinstance(patch_image_paths, (str, Path)):
                self.patch_image_paths = [Path(patch_image_paths)]
            else:
                self.patch_image_paths = [Path(p) for p in patch_image_paths]

        self.coordinates = coordinates if coordinates else []
        self.aug_config = aug_config or {}
        self.enhancements = enhancements or []

        # Determine modes
        self.has_coordinates = bool(self.coordinates and self.background_image_paths)
        self.has_patches = bool(self.patch_image_paths)

        self.background_images = []  # Loaded large images
        self.images_with_holes = []  # Background images with holes (for negative samples)
        self.patch_images = []  # Loaded small target images

    def generate(
        self,
        augmentation_count: int = 30,
        negative_samples: int = 150
    ) -> bool:
        """
        Generate classification dataset

        Supports mixed mode: can generate from BOTH coordinates AND patch_images

        Args:
            augmentation_count: Number of augmented samples per region/patch
            negative_samples: Number of negative samples

        Returns:
            True if successful
        """
        # Determine mode
        if self.has_coordinates and self.has_patches:
            print(f"Mode: Mixed (coordinates + patch_images)")
            print(f"  - Background images for coordinates: {len(self.background_image_paths)}")
            print(f"  - Direct patch images: {len(self.patch_image_paths)}")
        elif self.has_coordinates:
            print(f"Mode: Coordinate-based")
            print(f"  - Background images: {len(self.background_image_paths)}")
        elif self.has_patches:
            print(f"Mode: Direct Patch")
            print(f"  - Patch images: {len(self.patch_image_paths)}")
        else:
            print("\033[91mERROR: No images to process\033[0m")
            return False

        # Create output directories
        yes_dir = self.output_dir / "yes"
        no_dir = self.output_dir / "no"
        yes_dir.mkdir(parents=True, exist_ok=True)
        no_dir.mkdir(parents=True, exist_ok=True)

        positive_count = 0

        # Generate from coordinates if available
        if self.has_coordinates:
            print(f"Generating positive samples from coordinates...")
            positive_count += self._generate_coordinate_mode_positive(yes_dir, augmentation_count)

        # Generate from patch images if available
        if self.has_patches:
            print(f"Generating positive samples from patch images...")
            positive_count += self._generate_direct_patch_mode_positive(yes_dir, augmentation_count)

        # Load background images for negative sampling
        self._load_background_images_for_negatives()

        # Generate negative samples
        print(f"Generating negative samples...")
        negative_count = self._generate_negative_samples(no_dir, negative_samples)

        # Save metadata
        metadata = {
            'mode': 'mixed' if (self.has_coordinates and self.has_patches) else ('coordinate' if self.has_coordinates else 'direct_patch'),
            'background_images': [str(p) for p in self.background_image_paths],
            'patch_images': [str(p) for p in self.patch_image_paths],
            'coordinates': self.coordinates,
            'positive_samples': positive_count,
            'negative_samples': negative_count,
            'augmentation_count': augmentation_count,
            'augmentation_config': self.aug_config,
            'enhancements': self.enhancements
        }
        self.save_metadata(metadata)

        print(f"\nSUCCESS: Generated {positive_count} positive + {negative_count} negative samples")
        return True

    def _generate_coordinate_mode_positive(
        self,
        output_dir: Path,
        augmentation_count: int
    ) -> int:
        """Generate positive samples using coordinate-based extraction"""
        # Load all background images (large screenshots)
        for img_path in self.background_image_paths:
            img = cv2.imread(str(img_path))
            if img is None:
                print(f"WARNING: Failed to load image: {img_path}")
                continue
            self.background_images.append(img)
            self.images_with_holes.append(img.copy())
            print(f"  Loaded background: {img_path.name} ({img.shape[1]}x{img.shape[0]})")

        if not self.background_images:
            print("ERROR: No valid background images loaded")
            return 0

        # Generate positive samples
        positive_count = self._generate_positive_samples(output_dir, augmentation_count)
        return positive_count

    def _generate_direct_patch_mode_positive(
        self,
        output_dir: Path,
        augmentation_count: int
    ) -> int:
        """Generate positive samples using direct patch images"""
        # Load patch images (small target images to recognize)
        for img_path in self.patch_image_paths:
            if img_path.is_file() and img_path.suffix.lower() in ['.png', '.jpg', '.jpeg']:
                patch = cv2.imread(str(img_path))
                if patch is not None:
                    self.patch_images.append(patch)
                    print(f"  Loaded patch: {img_path.name} ({patch.shape[1]}x{patch.shape[0]})")
                else:
                    print(f"  WARNING: Failed to load {img_path.name}")

        if not self.patch_images:
            print("ERROR: No patch images found")
            return 0

        # Generate positive samples with enhancements
        positive_count = self._generate_positive_samples_direct(output_dir, augmentation_count)
        return positive_count

    def _load_background_images_for_negatives(self):
        """Load background images for negative sampling"""
        # If we already have background images with holes from coordinate mode, use them
        if self.images_with_holes:
            print(f"Using existing background images with holes: {len(self.images_with_holes)}")
            return

        # Try to find public directory from any available image path
        all_paths = list(self.background_image_paths) + list(self.patch_image_paths)
        for img_path in all_paths:
            public_dir = img_path.parent.parent / "public"
            if public_dir.exists():
                print(f"Loading background images from: {public_dir}")
                for bg_file in public_dir.glob("*.png"):
                    bg_img = cv2.imread(str(bg_file))
                    if bg_img is not None:
                        self.images_with_holes.append(bg_img)
                        print(f"  Loaded background: {bg_file.name}")
                break

    def _generate_positive_samples_direct(
        self,
        output_dir: Path,
        augmentation_count: int
    ) -> int:
        """Generate positive samples from direct patches with enhancements"""
        positive_count = 0

        # Create enhancer if enhancements specified
        enhancer = None
        if self.enhancements:
            if not ENHANCER_AVAILABLE:
                print("WARNING: image_enhancer not available, skipping enhancements")
            else:
                enhancer = ImageEnhancer()
                for enh_config in self.enhancements:
                    enhancement = create_enhancement_from_config(enh_config)
                    if enhancement:
                        enhancer.add_enhancement(enhancement)
                print(f"Configured {len(enhancer.enhancements)} enhancement(s)")

        for patch_idx, patch in enumerate(self.patch_images):
            # Save original patch
            cv2.imwrite(str(output_dir / f"patch_{patch_idx}_original.png"), patch)
            positive_count += 1

            # Generate augmented versions
            for aug_idx in range(augmentation_count):
                augmented = patch.copy()

                # Apply enhancements if configured
                if enhancer:
                    augmented = enhancer.apply(augmented)

                # Apply augmentation (scale, jitter, etc.)
                augmented = self._apply_augmentation_direct(augmented)

                if augmented is not None:
                    cv2.imwrite(str(output_dir / f"patch_{patch_idx}_aug{aug_idx}.png"), augmented)
                    positive_count += 1

        return positive_count

    def _apply_augmentation_direct(self, patch: np.ndarray) -> Optional[np.ndarray]:
        """Apply augmentation to direct patch"""
        # Color jittering
        if self.aug_config.get('color_jitter', True):
            patch = self._color_jitter(patch)

        # Scale (resize)
        if self.aug_config.get('allow_scale', True):
            scale_range = self.aug_config.get('scale_range', [0.9, 1.1])
            scale = np.random.uniform(scale_range[0], scale_range[1])
            if scale != 1.0:
                new_w = int(patch.shape[1] * scale)
                new_h = int(patch.shape[0] * scale)
                if new_w > 5 and new_h > 5:
                    patch = cv2.resize(patch, (new_w, new_h))

        return patch

    def _generate_positive_samples(self, output_dir: Path, augmentation_count: int) -> int:
        """Generate positive samples with augmentation (from first source image)"""
        positive_count = 0
        scale_range = self.aug_config.get('scale_range', [0.3, 1.0])

        # Use first background image for positive samples
        background_img = self.background_images[0]
        img_with_holes = self.images_with_holes[0]

        for idx, coord in enumerate(self.coordinates):
            x1, y1, x2, y2 = coord['x1'], coord['y1'], coord['x2'], coord['y2']

            # Extract full region
            full_region = background_img[y1:y2, x1:x2].copy()
            if full_region.size == 0:
                continue

            # Save full region
            cv2.imwrite(str(output_dir / f"region_{idx}_full.png"), full_region)
            positive_count += 1

            # Blank out this region on first image
            self._blank_region(img_with_holes, x1, y1, x2, y2)

            # Generate augmented versions
            region_width = x2 - x1
            region_height = y2 - y1

            for aug_idx in range(augmentation_count):
                augmented = self._augment_region(
                    full_region, region_width, region_height, x1, y1, scale_range
                )

                if augmented is not None:
                    cv2.imwrite(str(output_dir / f"region_{idx}_aug{aug_idx}.png"), augmented)
                    positive_count += 1

        return positive_count

    def _augment_region(
        self,
        region: np.ndarray,
        width: int,
        height: int,
        x1: int,
        y1: int,
        scale_range: List[float]
    ) -> Optional[np.ndarray]:
        """Apply augmentation to a region"""
        # Random scale
        if self.aug_config.get('allow_scale', True):
            scale = np.random.uniform(scale_range[0], scale_range[1])
        else:
            scale = 1.0

        scaled_width = int(width * scale)
        if scaled_width < 10:
            return None

        # Random start position
        if scale < 1.0:
            max_offset = width - scaled_width
            start_offset = np.random.randint(0, max_offset + 1) if max_offset > 0 else 0
        else:
            start_offset = 0

        # Extract scaled region
        augmented = region[:, start_offset:start_offset+scaled_width].copy()

        # Color jittering
        if self.aug_config.get('color_jitter', True):
            augmented = self._color_jitter(augmented)

        return augmented

    def _generate_negative_samples(self, output_dir: Path, negative_samples: int) -> int:
        """Generate negative samples from all images with holes"""
        # Get typical dimensions
        typical_widths = [coord['x2'] - coord['x1'] for coord in self.coordinates]
        typical_heights = [coord['y2'] - coord['y1'] for coord in self.coordinates]
        avg_width = int(np.mean(typical_widths))
        avg_height = int(np.mean(typical_heights))

        negative_count = 0
        attempts = 0
        max_attempts = negative_samples * 20

        while negative_count < negative_samples and attempts < max_attempts:
            attempts += 1

            # Random size
            width = int(avg_width * np.random.uniform(0.5, 1.5))
            height = int(avg_height * np.random.uniform(0.8, 1.2))

            # Randomly select one of the images with holes
            img_with_holes = self.images_with_holes[np.random.randint(0, len(self.images_with_holes))]

            # Random position
            x = np.random.randint(0, max(1, img_with_holes.shape[1] - width))
            y = np.random.randint(0, max(1, img_with_holes.shape[0] - height))

            # Extract crop
            crop = img_with_holes[y:y+height, x:x+width]

            if crop.shape[:2] != (height, width):
                continue

            if self._is_blank_region(crop):
                continue

            # Save negative sample
            cv2.imwrite(str(output_dir / f"negative_{negative_count}.png"), crop)
            negative_count += 1

        return negative_count


class DetectionDatasetGenerator(YOLODatasetGenerator):
    """
    Detection dataset generator
    Pastes patches back onto backgrounds with random transformations
    Generates YOLO format annotations
    Supports multiple source images as backgrounds
    """

    def __init__(
        self,
        background_image_paths: List[Path],
        coordinates: List[Dict],
        output_dir: Path,
        aug_config: Optional[Dict] = None
    ):
        """
        Initialize detection dataset generator

        Args:
            background_image_paths: List of paths to background images (large screenshots)
            coordinates: List of coordinate dictionaries (patch locations on first image)
            output_dir: Output directory
            aug_config: Augmentation configuration
        """
        super().__init__(output_dir)
        # Support both single path and list of paths for backwards compatibility
        if isinstance(background_image_paths, (str, Path)):
            self.background_image_paths = [Path(background_image_paths)]
        else:
            self.background_image_paths = [Path(p) for p in background_image_paths]

        self.coordinates = coordinates
        self.aug_config = aug_config or {}

        self.background_images = []  # Will store all loaded background images
        self.patches = []  # Extracted patches from first image

    def generate(self, num_images: int = 50) -> bool:
        """
        Generate detection dataset

        Args:
            num_images: Number of training images to generate

        Returns:
            True if successful
        """
        # Load all background images
        print(f"Loading {len(self.background_image_paths)} background image(s)...")
        for img_path in self.background_image_paths:
            img = cv2.imread(str(img_path))
            if img is None:
                print(f"WARNING: Failed to load image: {img_path}")
                continue
            self.background_images.append(img)
            print(f"  Loaded background: {img_path.name} ({img.shape[1]}x{img.shape[0]})")

        if not self.background_images:
            print("ERROR: No valid background images loaded")
            return False

        # Extract patches from first image
        self._extract_patches()

        # Create output directories
        images_dir = self.output_dir / "images"
        labels_dir = self.output_dir / "labels"
        images_dir.mkdir(parents=True, exist_ok=True)
        labels_dir.mkdir(parents=True, exist_ok=True)

        # Generate training images
        for img_idx in range(num_images):
            self._generate_training_image(img_idx, images_dir, labels_dir)

        # Save metadata
        metadata = {
            'background_images': [str(p) for p in self.background_image_paths],
            'num_training_images': num_images,
            'num_patches': len(self.patches),
            'augmentation_config': self.aug_config
        }
        self.save_metadata(metadata)

        # Create data.yaml
        self._create_data_yaml()

        return True

    def _extract_patches(self):
        """Extract patches from first background image"""
        background_img = self.background_images[0]
        for idx, coord in enumerate(self.coordinates):
            x1, y1, x2, y2 = coord['x1'], coord['y1'], coord['x2'], coord['y2']
            patch = background_img[y1:y2, x1:x2].copy()

            if patch.size == 0:
                continue

            self.patches.append({
                'image': patch,
                'width': x2 - x1,
                'height': y2 - y1
            })

    def _generate_training_image(self, img_idx: int, images_dir: Path, labels_dir: Path):
        """
        Generate one training image with annotations
        Paste exactly len(coordinates) patches - one patch per coordinate index
        Each patch is pasted once at a random position in the entire image
        """
        # Create background
        background = self._create_background()
        h, w = background.shape[:2]

        annotations = []

        # Paste len(coordinates) patches - one for each coordinate index
        for patch_idx in range(len(self.coordinates)):
            # Get patch info for this index
            if patch_idx >= len(self.patches):
                continue

            patch_info = self.patches[patch_idx]

            # Apply transformations
            transformed_patch, new_w, new_h = self._transform_patch(patch_info)

            if transformed_patch is None:
                continue

            # Random position anywhere in the entire image
            x = np.random.randint(0, max(1, w - new_w))
            y = np.random.randint(0, max(1, h - new_h))

            # Paste patch (check bounds)
            if y + new_h <= h and x + new_w <= w:
                background[y:y+new_h, x:x+new_w] = transformed_patch
            else:
                print(f"Warning: Patch {patch_idx} out of bounds, skipping")
                continue

            # YOLO annotation (normalized)
            center_x = (x + new_w / 2) / w
            center_y = (y + new_h / 2) / h
            norm_width = new_w / w
            norm_height = new_h / h

            annotations.append(f"0 {center_x:.6f} {center_y:.6f} {norm_width:.6f} {norm_height:.6f}")

        # Save image and annotation
        cv2.imwrite(str(images_dir / f"train_{img_idx:04d}.png"), background)

        with open(labels_dir / f"train_{img_idx:04d}.txt", 'w') as f:
            f.write('\n'.join(annotations))

    def _create_background(self) -> np.ndarray:
        """Create background with extracted regions blanked (randomly select from all backgrounds)"""
        # Randomly select one of the background images
        background_img = self.background_images[np.random.randint(0, len(self.background_images))]
        background = background_img.copy()

        # Blank out patch regions
        for coord in self.coordinates:
            x1, y1, x2, y2 = coord['x1'], coord['y1'], coord['x2'], coord['y2']
            self._blank_region(background, x1, y1, x2, y2)

        return background

    def _transform_patch(self, patch_info: Dict) -> Tuple[Optional[np.ndarray], int, int]:
        """Apply random transformations to patch"""
        patch = patch_info['image'].copy()
        h, w = patch.shape[:2]

        # Scale
        if self.aug_config.get('allow_scale', True):
            scale_range = self.aug_config.get('scale_range', [0.6, 1.4])
            scale = np.random.uniform(scale_range[0], scale_range[1])
            new_w = int(w * scale)
            new_h = int(h * scale)
            if new_w < 10 or new_h < 5:
                return None, 0, 0
            patch = cv2.resize(patch, (new_w, new_h))
        else:
            new_w, new_h = w, h

        # Stretch
        if self.aug_config.get('allow_stretch', True):
            stretch_x_range = self.aug_config.get('stretch_x_range', [0.8, 1.2])
            stretch_y_range = self.aug_config.get('stretch_y_range', [0.9, 1.1])

            stretch_x = np.random.uniform(stretch_x_range[0], stretch_x_range[1])
            stretch_y = np.random.uniform(stretch_y_range[0], stretch_y_range[1])

            new_w = int(new_w * stretch_x)
            new_h = int(new_h * stretch_y)

            if new_w < 10 or new_h < 5:
                return None, 0, 0

            patch = cv2.resize(patch, (new_w, new_h))

        # Rotation - rotate entire image and expand to fit
        if self.aug_config.get('allow_rotation', True):
            rotation_range = self.aug_config.get('rotation_range', [-15, 15])
            angle = np.random.uniform(rotation_range[0], rotation_range[1])

            # Calculate new dimensions after rotation
            abs_cos = abs(np.cos(np.radians(angle)))
            abs_sin = abs(np.sin(np.radians(angle)))
            rotated_w = int(new_h * abs_sin + new_w * abs_cos)
            rotated_h = int(new_h * abs_cos + new_w * abs_sin)

            # Get rotation matrix with adjusted center
            center = (new_w // 2, new_h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)

            # Adjust translation to center the rotated image
            M[0, 2] += (rotated_w - new_w) / 2
            M[1, 2] += (rotated_h - new_h) / 2

            # Apply rotation with expanded canvas
            patch = cv2.warpAffine(patch, M, (rotated_w, rotated_h),
                                   borderMode=cv2.BORDER_CONSTANT,
                                   borderValue=(0, 0, 0))

            new_w, new_h = rotated_w, rotated_h

        return patch, new_w, new_h

    def _create_data_yaml(self):
        """Create data.yaml for YOLO training"""
        data_yaml = {
            'path': str(self.output_dir.absolute()),
            'train': 'images',
            'val': 'images',
            'nc': 1,
            'names': ['object']
        }

        yaml_file = self.output_dir / "data.yaml"
        with open(yaml_file, 'w', encoding='utf-8') as f:
            for key, value in data_yaml.items():
                if isinstance(value, list):
                    f.write(f"{key}: {value}\n")
                else:
                    f.write(f"{key}: {value}\n")
