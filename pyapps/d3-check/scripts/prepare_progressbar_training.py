#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Progress Bar Training Data Preparation Script
Specialized preprocessing for progress bar detection with specific constraints
"""

import os
import sys
import json
from pathlib import Path

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
d3_check_dir = Path(current_dir).parent
sys.path.insert(0, str(d3_check_dir))
from share.project_path import get_project_root
sys.path.insert(0, str(get_project_root().parent.parent))

from pycore.pyfoundations.third_party import get_third_package_cv2, get_third_package_numpy
from pycore.pyfoundations.color_print import ColorPrint

cv2 = get_third_package_cv2()
np = get_third_package_numpy()


class ProgressBarDataPreparator:
    """
    Specialized data preparator for progress bars
    Handles constraints: no stretching, random shortening allowed
    """

    def __init__(self, source_image: Path, output_dir: Path):
        """
        Initialize preparator

        Args:
            source_image: Path to source screenshot
            output_dir: Output directory for training data
        """
        self.source_image = source_image
        self.output_dir = output_dir
        self.img = None
        self.img_with_holes = None  # Image with extracted regions blanked out

    def prepare_data(
        self,
        coordinates: list,
        augmentation_count: int = 20,
        shorten_ratios: list = None,
        negative_samples: int = 100
    ):
        """
        Prepare training data for progress bars

        Args:
            coordinates: List of coordinate dictionaries [{'x1': int, 'y1': int, 'x2': int, 'y2': int}, ...]
            augmentation_count: Number of augmented samples per bar
            shorten_ratios: List of ratios for random shortening (e.g., [0.3, 0.5, 0.7, 0.9, 1.0])
            negative_samples: Number of negative samples to generate
        """
        ColorPrint.blue("\n" + "=" * 80)
        ColorPrint.blue("🎯 Progress Bar Training Data Preparation")
        ColorPrint.blue("=" * 80)

        # Load image
        self.img = cv2.imread(str(self.source_image))
        if self.img is None:
            ColorPrint.red(f"❌ Failed to load image: {self.source_image}")
            return

        ColorPrint.green(f"✓ Loaded image: {self.source_image.name}")
        ColorPrint.green(f"  Image size: {self.img.shape[1]}x{self.img.shape[0]}")

        # Create a copy for blanking out extracted regions
        self.img_with_holes = self.img.copy()

        # Default shorten ratios
        if shorten_ratios is None:
            shorten_ratios = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]

        # Create output directories
        yes_dir = self.output_dir / "yes"
        no_dir = self.output_dir / "no"
        yes_dir.mkdir(parents=True, exist_ok=True)
        no_dir.mkdir(parents=True, exist_ok=True)

        ColorPrint.blue(f"\n📦 Processing {len(coordinates)} progress bar regions")

        # Extract and augment positive samples
        positive_count = 0
        for idx, coord in enumerate(coordinates):
            x1, y1, x2, y2 = coord['x1'], coord['y1'], coord['x2'], coord['y2']

            ColorPrint.green(f"\n  Region {idx+1}: ({x1},{y1}) -> ({x2},{y2})")

            # Extract full bar
            full_bar = self.img[y1:y2, x1:x2].copy()

            if full_bar.size == 0:
                ColorPrint.yellow(f"  ⚠ Empty region, skipping")
                continue

            # Save full bar
            bar_name = f"bar_{idx}_full.png"
            cv2.imwrite(str(yes_dir / bar_name), full_bar)
            positive_count += 1

            # Blank out this region in the image (for negative sampling)
            # Fill with average color of surrounding pixels
            self._blank_region(x1, y1, x2, y2)

            # Generate shortened versions
            bar_width = x2 - x1
            bar_height = y2 - y1

            for aug_idx in range(augmentation_count):
                # Random shorten ratio
                ratio = np.random.choice(shorten_ratios)

                # Calculate shortened width
                short_width = int(bar_width * ratio)
                if short_width < 10:  # Minimum width
                    continue

                # Random start position within the bar
                if ratio < 1.0:
                    max_offset = bar_width - short_width
                    if max_offset > 0:
                        start_offset = np.random.randint(0, max_offset + 1)
                    else:
                        start_offset = 0
                else:
                    start_offset = 0

                # Extract shortened bar
                short_bar = full_bar[:, start_offset:start_offset+short_width]

                # Random vertical offset (small)
                if np.random.random() > 0.5 and bar_height > 5:
                    v_offset = np.random.randint(-2, 3)
                    if 0 <= y1 + v_offset < y2 + v_offset <= self.img.shape[0]:
                        short_bar = self.img[y1+v_offset:y2+v_offset, x1+start_offset:x1+start_offset+short_width]

                # Apply slight color jittering
                short_bar = self._color_jitter(short_bar)

                # Save
                aug_name = f"bar_{idx}_aug{aug_idx}_r{ratio:.2f}.png"
                cv2.imwrite(str(yes_dir / aug_name), short_bar)
                positive_count += 1

            ColorPrint.green(f"  ✓ Generated {augmentation_count + 1} positive samples")

        ColorPrint.blue(f"\n📊 Total positive samples: {positive_count}")

        # Generate negative samples from blanked image
        ColorPrint.blue(f"\n🔲 Generating {negative_samples} negative samples")

        # Get typical bar dimensions for negative sampling
        typical_widths = []
        typical_heights = []
        for coord in coordinates:
            typical_widths.append(coord['x2'] - coord['x1'])
            typical_heights.append(coord['y2'] - coord['y1'])

        avg_width = int(np.mean(typical_widths))
        avg_height = int(np.mean(typical_heights))

        negative_count = 0
        attempts = 0
        max_attempts = negative_samples * 20

        while negative_count < negative_samples and attempts < max_attempts:
            attempts += 1

            # Random size (around typical size)
            width = int(avg_width * np.random.uniform(0.5, 1.5))
            height = int(avg_height * np.random.uniform(0.8, 1.2))

            # Random position
            x = np.random.randint(0, max(1, self.img_with_holes.shape[1] - width))
            y = np.random.randint(0, max(1, self.img_with_holes.shape[0] - height))

            # Extract crop
            crop = self.img_with_holes[y:y+height, x:x+width]

            if crop.shape[:2] != (height, width):
                continue

            # Check if crop contains blanked regions (all zeros or very dark)
            if self._is_blank_region(crop):
                continue

            # Save negative sample
            neg_name = f"negative_{negative_count}.png"
            cv2.imwrite(str(no_dir / neg_name), crop)
            negative_count += 1

            if negative_count % 20 == 0:
                ColorPrint.green(f"  Generated {negative_count}/{negative_samples} negative samples")

        ColorPrint.blue(f"\n📊 Total negative samples: {negative_count}")

        # Summary
        ColorPrint.blue(f"\n{'='*80}")
        ColorPrint.green("✅ Data preparation completed!")
        ColorPrint.blue(f"{'='*80}")
        ColorPrint.green(f"📦 Output directory: {self.output_dir}")
        ColorPrint.green(f"   Positive samples: {positive_count}")
        ColorPrint.green(f"   Negative samples: {negative_count}")
        ColorPrint.green(f"   Total samples: {positive_count + negative_count}")

        # Save metadata
        metadata = {
            'source_image': str(self.source_image),
            'coordinates': coordinates,
            'positive_samples': positive_count,
            'negative_samples': negative_count,
            'augmentation_count': augmentation_count,
            'shorten_ratios': shorten_ratios
        }

        metadata_file = self.output_dir / "metadata.json"
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

        ColorPrint.green(f"\n✓ Metadata saved: {metadata_file.name}")

    def _blank_region(self, x1: int, y1: int, x2: int, y2: int, margin: int = 10):
        """
        Blank out a region by filling with surrounding average color

        Args:
            x1, y1, x2, y2: Region coordinates
            margin: Margin around region to sample surrounding color
        """
        h, w = self.img_with_holes.shape[:2]

        # Get surrounding region
        sx1 = max(0, x1 - margin)
        sy1 = max(0, y1 - margin)
        sx2 = min(w, x2 + margin)
        sy2 = min(h, y2 + margin)

        # Create mask for surrounding region (excluding the center)
        surrounding = self.img_with_holes[sy1:sy2, sx1:sx2].copy()
        mask = np.ones(surrounding.shape[:2], dtype=bool)

        # Mask out the center region
        cx1 = x1 - sx1
        cy1 = y1 - sy1
        cx2 = x2 - sx1
        cy2 = y2 - sy1
        mask[cy1:cy2, cx1:cx2] = False

        # Calculate average color from surrounding pixels
        if mask.sum() > 0:
            avg_color = surrounding[mask].mean(axis=0)
        else:
            avg_color = [0, 0, 0]

        # Fill the region with average color + noise
        noise = np.random.randint(-10, 11, (y2-y1, x2-x1, 3), dtype=np.int16)
        fill_color = np.clip(avg_color + noise, 0, 255).astype(np.uint8)

        self.img_with_holes[y1:y2, x1:x2] = fill_color

    def _is_blank_region(self, crop: np.ndarray, threshold: int = 20) -> bool:
        """
        Check if a crop contains mostly blank (dark or uniform) regions

        Args:
            crop: Image crop
            threshold: Variance threshold

        Returns:
            True if blank, False otherwise
        """
        # Check variance
        if crop.var() < threshold:
            return True

        # Check if very dark
        if crop.mean() < 10:
            return True

        return False

    def _color_jitter(self, img: np.ndarray) -> np.ndarray:
        """
        Apply slight color jittering

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


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Prepare progress bar training data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Example:
  python prepare_progressbar_training.py \\
    --image path/to/screenshot.png \\
    --coords "1452,352,1708,375" "1457,355,1703,371" \\
    --output .cache/training_data/source/progress_bar \\
    --augment 20 \\
    --negatives 100
        """
    )

    parser.add_argument("--image", type=str, required=True,
                        help="Path to source screenshot")
    parser.add_argument("--coords", nargs="+", required=True,
                        help="Coordinates in format 'x1,y1,x2,y2' (can specify multiple)")
    parser.add_argument("--output", type=str, required=True,
                        help="Output directory")
    parser.add_argument("--augment", type=int, default=20,
                        help="Augmentation count per bar (default: 20)")
    parser.add_argument("--negatives", type=int, default=100,
                        help="Number of negative samples (default: 100)")
    parser.add_argument("--ratios", type=float, nargs="+",
                        default=[0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
                        help="Shorten ratios (default: 0.3 to 1.0)")

    args = parser.parse_args()

    # Parse coordinates
    coordinates = []
    for coord_str in args.coords:
        parts = coord_str.split(',')
        if len(parts) != 4:
            ColorPrint.red(f"❌ Invalid coordinate format: {coord_str}")
            ColorPrint.yellow("   Expected format: x1,y1,x2,y2")
            return 1

        try:
            x1, y1, x2, y2 = map(int, parts)
            coordinates.append({'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2})
        except ValueError:
            ColorPrint.red(f"❌ Invalid coordinate values: {coord_str}")
            return 1

    # Prepare data
    preparator = ProgressBarDataPreparator(
        source_image=Path(args.image),
        output_dir=Path(args.output)
    )

    preparator.prepare_data(
        coordinates=coordinates,
        augmentation_count=args.augment,
        shorten_ratios=args.ratios,
        negative_samples=args.negatives
    )

    return 0


if __name__ == "__main__":
    sys.exit(main())
