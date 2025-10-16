# Progress Bar Training Guide

## Quick Start

### Step 1: Prepare Training Data

```bash
python scripts/prepare_progressbar_training.py \
  --image .cache/d4_exp_farming_20251016_031749_166.png \
  --coords "1452,352,1708,375" "1457,355,1703,371" \
  --output .cache/training_data/source/progress_bar \
  --augment 30 \
  --negatives 150
```

Parameters:
- `--image`: Path to source screenshot containing progress bars
- `--coords`: Coordinates of progress bar regions in format "x1,y1,x2,y2" (can specify multiple)
- `--output`: Output directory for training data
- `--augment`: Number of augmented samples per progress bar (default: 20)
- `--negatives`: Number of negative samples to generate (default: 100)

### Step 2: Train Model

```bash
python train_progressbar.py
```

This script will automatically:
1. Check environment (GPU, dependencies)
2. Create train/validation split (80/20)
3. Train YOLO classification model
4. Validate the model
5. Save the best model to `.cache/training_data/models/progress_bar_detector.pt`

## Features

### Specialized Progress Bar Handling

The preprocessing script handles progress bars with special constraints:

1. **No Stretching**: Progress bars are never stretched or elongated
2. **Random Shortening**: Bars are randomly shortened to simulate different progress levels
3. **Region Blanking**: Extracted regions are blanked out to avoid conflicts with negative samples
4. **Smart Negative Sampling**: Negative samples avoid blanked regions

### Augmentation

For each progress bar region, the system generates:
- Full-length bar
- Multiple shortened versions (using configurable ratios)
- Random vertical offsets
- Color jittering for robustness

Default shorten ratios: 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0

### Training Configuration

Default training settings:
- Model: YOLOv8n-cls (nano, fastest)
- Epochs: 100
- Batch size: 16 (GPU) or 8 (CPU)
- Device: Auto-detected (CUDA if available)
- Image size: Auto-detected from samples
- Patience: 20 epochs (early stopping)

## Adding More Training Data

To add more screenshots to training:

```bash
# Prepare data from new screenshot
python scripts/prepare_progressbar_training.py \
  --image path/to/new_screenshot.png \
  --coords "x1,y1,x2,y2" \
  --output .cache/training_data/source/progress_bar \
  --augment 30 \
  --negatives 150
```

Then retrain:
```bash
python train_progressbar.py
```

The script will automatically include all samples in the output directory.

## Using the Trained Model

After training, use the model for inference:

```python
from ultralytics import YOLO
import cv2

# Load model
model = YOLO('.cache/training_data/models/progress_bar_detector.pt')

# Load image
img = cv2.imread('screenshot.png')

# Extract region to test (e.g., suspected progress bar area)
region = img[y1:y2, x1:x2]

# Predict
results = model.predict(region)

# Get result
for result in results:
    probs = result.probs
    class_id = probs.top1  # 0=no, 1=yes
    confidence = probs.top1conf

    if class_id == 1:  # yes = progress bar detected
        print(f"Progress bar detected! Confidence: {confidence:.2f}")
    else:
        print(f"Not a progress bar. Confidence: {confidence:.2f}")
```

## File Structure

```
.cache/training_data/
├── source/
│   └── progress_bar/
│       ├── yes/                    # Positive samples
│       │   ├── bar_0_full.png
│       │   ├── bar_0_aug0_r0.30.png
│       │   └── ...
│       ├── no/                     # Negative samples
│       │   ├── negative_0.png
│       │   └── ...
│       └── metadata.json           # Training metadata
├── processed/
│   └── progress_bar/
│       ├── train/
│       │   ├── yes/
│       │   └── no/
│       ├── val/
│       │   ├── yes/
│       │   └── no/
│       └── data.yaml
├── models/
│   └── progress_bar_detector.pt   # Trained model
└── runs/
    └── progress_bar/
        └── train/
            ├── weights/
            │   ├── best.pt
            │   └── last.pt
            └── results.csv
```

## Troubleshooting

### "No training data found"
Run `prepare_progressbar_training.py` first to generate training samples.

### Low accuracy
- Add more training data from different screenshots
- Increase augmentation count (`--augment 50`)
- Increase training epochs (modify `train_progressbar.py`)
- Use a larger model (yolov8s-cls.pt, yolov8m-cls.pt)

### GPU out of memory
- Reduce batch size in `train_progressbar.py`
- Use CPU training (automatic fallback)

## Advanced Usage

### Custom Shorten Ratios

```bash
python scripts/prepare_progressbar_training.py \
  --image screenshot.png \
  --coords "x1,y1,x2,y2" \
  --output .cache/training_data/source/progress_bar \
  --ratios 0.2 0.4 0.6 0.8 1.0
```

### Multiple Screenshots

Process multiple screenshots:

```bash
for img in screenshots/*.png; do
    python scripts/prepare_progressbar_training.py \
      --image "$img" \
      --coords "1452,352,1708,375" \
      --output .cache/training_data/source/progress_bar
done
```

## Next Steps

After training the progress bar detector, you can:

1. Integrate it into the D3/D4 game automation system
2. Use it to detect progress completion in dungeons
3. Combine with OCR to read progress percentages
4. Train additional detectors for other UI elements (health orbs, skill cooldowns, etc.)
