# Classification Training Guide

## Overview

This training system provides a complete pipeline for binary classification (yes/no) training using YOLO classification models. It includes:

- Automatic data preprocessing with augmentation
- Negative sample generation from source images
- GPU/CPU environment detection
- One-line training execution
- Model validation and export

## Quick Start

```bash
# 1. Check environment
python train.py --check-env

# 2. Setup training structure
python train.py --setup --categories progress_bar avatar health_orb

# 3. Add your training data (see Data Structure below)

# 4. Preprocess data
python train.py --preprocess

# 5. Train model
python train.py --train --device cuda --epochs 100

# 6. Validate model
python train.py --validate

# 7. Export model
python train.py --export --format onnx
```

## Data Structure

After running `--setup`, your training data should be organized as follows:

```
.cache/training_data/
├── source/                          # Raw training data
│   ├── progress_bar/                # Category 1
│   │   ├── images/                  # Source images
│   │   │   ├── screenshot1.png
│   │   │   └── screenshot2.png
│   │   ├── yes_images/              # [Optional] Positive samples
│   │   │   ├── bar1.png
│   │   │   └── bar2.png
│   │   └── coordinates.json         # [Optional] Annotation file
│   ├── avatar/                      # Category 2
│   │   ├── images/
│   │   ├── yes_images/
│   │   └── coordinates.json
│   └── health_orb/                  # Category 3
│       └── ...
├── processed/                       # Processed training data (auto-generated)
│   ├── train/
│   │   ├── yes/
│   │   └── no/
│   ├── val/
│   │   ├── yes/
│   │   └── no/
│   └── data.yaml
├── models/                          # Trained models (auto-generated)
│   └── best_model.pt
└── configs/                         # Configuration files
    └── coordinates_example.json
```

## Coordinates Format

The `coordinates.json` file maps image filenames to bounding boxes of positive regions:

```json
{
  "screenshot1.png": [
    {"x": 100, "y": 200, "w": 50, "h": 30},
    {"x": 300, "y": 400, "w": 50, "h": 30}
  ],
  "screenshot2.png": [
    {"x": 150, "y": 250, "w": 50, "h": 30}
  ]
}
```

## Training Data Options

You have two main options for providing positive (yes) samples:

### Option 1: Use coordinates.json (Recommended)
- Place full screenshots in `images/`
- Create `coordinates.json` with bounding boxes
- System will extract positive regions and generate negative samples automatically

### Option 2: Use yes_images directory
- Place full screenshots in `images/` (for negative sample generation)
- Place pre-cropped positive samples in `yes_images/`
- System will augment positive samples and generate negative samples

### Option 3: Hybrid approach
- Use both coordinates.json AND yes_images
- System will use both sources for positive samples

## Data Preprocessing

The preprocessing pipeline:

1. **Positive Sample Generation**:
   - Extracts regions from coordinates
   - Or loads from yes_images/
   - Applies augmentation (rotation, scaling, translation, color jittering)
   - Generates multiple augmented versions (default: 10 per sample)

2. **Negative Sample Generation**:
   - Randomly crops regions from source images
   - Avoids overlapping with positive regions (if coordinates provided)
   - Generates many negative samples (default: 50 per image)

3. **Train/Val Split**:
   - Automatically splits data into train/val sets (default: 80/20)
   - Balances classes

## Commands

### Check Environment
```bash
python train.py --check-env
```
Checks for:
- Python version
- OpenCV, NumPy, Ultralytics
- CUDA availability
- GPU information

### Setup Training Structure
```bash
python train.py --setup --categories progress_bar avatar
```
Creates directory structure for specified categories.

### View Summary
```bash
python train.py --summary
```
Shows current training setup, data counts, and trained models.

### Preprocess Data
```bash
# Basic preprocessing
python train.py --preprocess

# Custom augmentation settings
python train.py --preprocess --augment 20 --negatives 100 --imgsize 128 128
```

Options:
- `--augment N`: Number of augmentations per positive sample (default: 10)
- `--negatives N`: Number of negative samples per image (default: 50)
- `--imgsize W H`: Target image size (default: 64 64)
- `--categories`: Process only specific categories

### Train Model
```bash
# Basic training
python train.py --train

# Custom training settings
python train.py --train --model yolov8s-cls.pt --epochs 200 --batch 32 --device cuda

# Resume training
python train.py --train --resume
```

Options:
- `--model`: Model architecture (yolov8n-cls.pt, yolov8s-cls.pt, yolov8m-cls.pt, etc.)
- `--epochs`: Number of training epochs (default: 100)
- `--batch`: Batch size (default: 16)
- `--device`: Device (cpu, cuda, auto, 0, 0,1) (default: auto)
- `--resume`: Resume from last checkpoint

### Validate Model
```bash
# Validate best model
python train.py --validate

# Validate specific model
python train.py --validate --model-path path/to/model.pt
```

### Export Model
```bash
# Export to ONNX
python train.py --export

# Export to other formats
python train.py --export --format torchscript
python train.py --export --format tflite

# Export specific model
python train.py --export --model-path path/to/model.pt --format onnx
```

## Model Architectures

Available YOLO classification models (smallest to largest):

- `yolov8n-cls.pt`: Nano (fastest, least accurate)
- `yolov8s-cls.pt`: Small
- `yolov8m-cls.pt`: Medium
- `yolov8l-cls.pt`: Large
- `yolov8x-cls.pt`: Extra Large (slowest, most accurate)

## Training Tips

### GPU Training
- Use `--device cuda` for GPU training (much faster)
- Increase `--batch` size if you have more GPU memory
- Monitor GPU usage with `nvidia-smi`

### CPU Training
- Use smaller models (yolov8n-cls.pt)
- Reduce `--batch` size (8 or 16)
- Reduce `--epochs` for testing

### Data Augmentation
- More augmentation = better generalization
- Use `--augment 20` or higher for small datasets
- Generate more negative samples for better balance

### Image Size
- Smaller images = faster training but less detail
- Use `--imgsize 64 64` for simple detection (default)
- Use `--imgsize 128 128` or higher for complex patterns

### Dataset Balance
- Aim for roughly equal yes/no samples
- Adjust `--negatives` parameter to balance
- Check balance with `--summary` command

## Advanced Usage

### Programmatic Usage

```python
from controller.training import ClassificationTrainingController

# Create controller
controller = ClassificationTrainingController()

# Check environment
controller.check_environment()

# Setup structure
controller.prepare_training_structure(categories=['progress_bar', 'avatar'])

# Preprocess
stats = controller.preprocess_data(
    categories=['progress_bar'],
    augmentation_count=20,
    negative_samples_per_image=100,
    img_size=(128, 128)
)

# Train
results = controller.train(
    model='yolov8s-cls.pt',
    epochs=200,
    batch=32,
    device='cuda'
)

# Validate
val_results = controller.validate()

# Export
export_path = controller.export_model(format='onnx')
```

### Custom Data Configuration

```python
from providor.common_imports import ClassificationDataConfig, ClassificationTrainer

# Create custom config
data_config = ClassificationDataConfig(
    source_dir='path/to/source',
    output_dir='path/to/output',
    categories=['cat1', 'cat2'],
    augmentation_count=15,
    negative_samples_per_image=75,
    img_size=(96, 96),
    enable_rotation=True,
    rotation_range=20.0,
    enable_scaling=True,
    scale_range=(0.7, 1.3),
    train_val_split=0.85
)

# Create trainer
trainer = ClassificationTrainer(data_config=data_config)

# Preprocess
trainer.preprocess_data()
```

## Troubleshooting

### "No module named 'ultralytics'"
```bash
pip install ultralytics
```

### "No CUDA devices available"
- Check NVIDIA drivers: `nvidia-smi`
- Install CUDA toolkit
- Install PyTorch with CUDA: `pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118`

### "No source data found"
- Run `--setup` first
- Place images in `.cache/training_data/source/<category>/images/`
- Check paths with `--summary`

### "Model not found"
- Run `--train` first to create a model
- Check `.cache/training_data/models/` for trained models

### Low accuracy
- Increase training epochs
- Add more training data
- Increase augmentation count
- Use a larger model
- Check data quality and balance

## Architecture

The training system consists of:

1. **ClassificationTrainer** (`pycore/pyutils/classification_trainer.py`)
   - Extends UltralyticsTrainer
   - Handles preprocessing and training

2. **ClassificationTrainingController** (`apps/d3-check/controller/training/`)
   - High-level workflow management
   - Environment checking
   - Directory management

3. **train.py** (`apps/d3-check/train.py`)
   - Command-line interface
   - Single import line: `from controller.training import ClassificationTrainingController`

## Next Steps

After training, use your model for inference:

```python
from ultralytics import YOLO

# Load model
model = YOLO('.cache/training_data/models/best_model.pt')

# Predict
results = model.predict('image.png')

# Get classification
for result in results:
    probs = result.probs
    class_id = probs.top1  # 0=no, 1=yes
    confidence = probs.top1conf
    print(f"Class: {'yes' if class_id == 1 else 'no'}, Confidence: {confidence:.2f}")
```

## References

- [Ultralytics Documentation](https://docs.ultralytics.com/)
- [YOLO Classification](https://docs.ultralytics.com/tasks/classify/)
- [Training Tips](https://docs.ultralytics.com/guides/hyperparameter-tuning/)
