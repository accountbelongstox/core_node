# D4 Modules - Trained Models Directory

This directory contains trained classification models for D4 game object detection.

## Directory Structure

```
d4_modules/
├── README.md                    # This file
├── model_registry.json          # Registry of all trained models
├── <model_name>_detector.pt     # Trained model files
└── <model_name>_detector.json   # Individual model metadata
```

## Model Registry

The `model_registry.json` file contains information about all trained models:

```json
{
  "registry_version": "1.0",
  "created_at": "2025-10-16T...",
  "models": [
    {
      "model_name": "progress_bar_detector",
      "model_file": "progress_bar_detector.pt",
      "category": "progress_bar",
      "type": "binary_classification",
      "classes": ["no", "yes"],
      "img_size": {
        "width": 64,
        "height": 64
      },
      "samples": {
        "positive": 150,
        "negative": 300,
        "total": 450
      },
      "training_info": {
        "epochs": 100,
        "batch_size": 16,
        "device": "cuda",
        "base_model": "yolov8n-cls.pt"
      },
      "trained_at": "2025-10-16T..."
    }
  ]
}
```

## Training Workflow

### 1. Prepare Training Data

Place your training images in `.cache/training_data/source/`:

```
.cache/training_data/source/
└── progress_bar/
    ├── yes/    # Positive samples
    │   ├── sample1.png
    │   ├── sample2.png
    │   └── ...
    └── no/     # Negative samples
        ├── neg1.png
        ├── neg2.png
        └── ...
```

### 2. Train Models

#### Train All Projects
```bash
python train_all.py
```

This will:
- Scan all projects in `.cache/training_data/source/`
- Train models for each project
- Save models to `d4_modules/`
- Generate `model_registry.json`

#### Train Single Project (Progress Bar)
```bash
python train_progressbar.py
```

### 3. Validate Models

After training, validate your models on a large screenshot:

```bash
python validate_models.py --image screenshot.png
```

Options:
- `--image`: Path to input image (required)
- `--stride`: Sliding window stride (default: half of window size)
- `--confidence`: Confidence threshold (default: 0.5)
- `--output`: Output filename (auto-generated if not specified)

Example with custom parameters:
```bash
python validate_models.py \
  --image D:\screenshots\game.png \
  --stride 32 \
  --confidence 0.7 \
  --output validation_result.png
```

## Validation Output

Validation results are saved to:
```
C:\Users\<username>\.core_node\pytools\tmp\model_validation\
```

The output image will show:
- Bounding boxes for detected objects
- Confidence scores
- Color-coded by model type
- Legend showing detection counts

## Model Information

Each trained model includes:
- **Model File**: PyTorch model weights (.pt)
- **Metadata File**: JSON with training details
- **Category**: Object type (e.g., progress_bar, health_orb)
- **Image Size**: Expected input dimensions
- **Classes**: Binary classification (no/yes)

## Using Models in Code

```python
from ultralytics import YOLO
import json
from pathlib import Path

# Load registry
registry_file = Path("d4_modules/model_registry.json")
with open(registry_file) as f:
    registry = json.load(f)

# Load a specific model
model_info = registry['models'][0]  # First model
model = YOLO(f"d4_modules/{model_info['model_file']}")

# Make predictions
results = model("test_image.png")

# Check if detection is positive
for result in results:
    probs = result.probs
    class_id = int(probs.top1)
    confidence = float(probs.top1conf)

    if class_id == 1:  # "yes" class
        print(f"Detected with confidence: {confidence:.2f}")
```

## Notes

- All models are binary classifiers (no/yes)
- Models use YOLOv8 classification architecture
- Training uses 80/20 train/validation split
- Models are optimized for GPU (CUDA) when available
- Output images are annotated with all detections from all models
