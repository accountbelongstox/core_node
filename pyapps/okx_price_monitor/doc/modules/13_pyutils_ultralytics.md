# pyutils.ultralytics - YOLO Training Utilities

## Overview

The `ultralytics` module provides generic YOLO training utilities for classification and detection tasks. It includes dataset generation, training configuration, and model management.

## Module Location

```
pycore/pyutils/ultralytics/
├── __init__.py
├── classification_trainer.py   # ClassificationTrainer
├── detection_trainer.py        # DetectionTrainer
├── dataset_generator_yolo.py   # Dataset generators
├── base_trainer.py             # Base trainer class
└── utils.py                    # Utility functions
```

## Core Components

### ClassificationTrainer

Image classification training:

```python
from pycore.pyutils.ultralytics import ClassificationTrainer

trainer = ClassificationTrainer(
    model_name="yolov8n-cls",
    data_path="/path/to/dataset",
    output_dir="/path/to/output"
)

# Configure training
trainer.configure(
    epochs=100,
    batch_size=32,
    imgsz=224,
    patience=10,
    lr0=0.01,
    optimizer="AdamW",
    augment=True
)

# Train model
results = trainer.train()

# Evaluate
metrics = trainer.evaluate()
print(f"Accuracy: {metrics['accuracy']}")

# Export model
trainer.export(format="onnx")
```

**Configuration Options:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| epochs | 100 | Training epochs |
| batch_size | 32 | Batch size |
| imgsz | 224 | Image size |
| patience | 10 | Early stopping patience |
| lr0 | 0.01 | Initial learning rate |
| optimizer | AdamW | Optimizer type |
| augment | True | Enable augmentation |
| pretrained | True | Use pretrained weights |
| device | auto | Training device (cuda/cpu) |
| workers | 8 | Data loader workers |
| project | runs/classify | Project directory |
| name | train | Experiment name |

### DetectionTrainer

Object detection training:

```python
from pycore.pyutils.ultralytics import DetectionTrainer

trainer = DetectionTrainer(
    model_name="yolov8n",
    data_yaml="/path/to/data.yaml",
    output_dir="/path/to/output"
)

# Configure training
trainer.configure(
    epochs=100,
    batch_size=16,
    imgsz=640,
    patience=20,
    lr0=0.01,
    box=7.5,
    cls=0.5,
    dfl=1.5,
    mosaic=1.0,
    mixup=0.0
)

# Train model
results = trainer.train()

# Evaluate
metrics = trainer.evaluate()
print(f"mAP50: {metrics['mAP50']}")
print(f"mAP50-95: {metrics['mAP50-95']}")

# Export
trainer.export(format="onnx")
```

**Detection-Specific Parameters:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| box | 7.5 | Box loss weight |
| cls | 0.5 | Classification loss weight |
| dfl | 1.5 | DFL loss weight |
| mosaic | 1.0 | Mosaic augmentation |
| mixup | 0.0 | Mixup augmentation |
| copy_paste | 0.0 | Copy-paste augmentation |
| hsv_h | 0.015 | HSV-Hue augmentation |
| hsv_s | 0.7 | HSV-Saturation augmentation |
| hsv_v | 0.4 | HSV-Value augmentation |
| degrees | 0.0 | Rotation degrees |
| translate | 0.1 | Translation |
| scale | 0.5 | Scale |
| shear | 0.0 | Shear |
| flipud | 0.0 | Flip up-down probability |
| fliplr | 0.5 | Flip left-right probability |

### YOLODatasetGenerator

Base dataset generator:

```python
from pycore.pyutils.ultralytics import YOLODatasetGenerator

generator = YOLODatasetGenerator(
    source_dir="/path/to/images",
    output_dir="/path/to/dataset",
    train_ratio=0.8,
    val_ratio=0.1,
    test_ratio=0.1
)

# Generate dataset structure
generator.generate()

# Get dataset info
info = generator.get_info()
print(f"Total images: {info['total']}")
print(f"Train: {info['train']}")
print(f"Val: {info['val']}")
print(f"Test: {info['test']}")
```

### ClassificationDatasetGenerator

Classification dataset:

```python
from pycore.pyutils.ultralytics import ClassificationDatasetGenerator

generator = ClassificationDatasetGenerator(
    source_dir="/path/to/labeled_images",
    output_dir="/path/to/dataset"
)

# Source structure:
# labeled_images/
#   ├── cat/
#   │   ├── img1.jpg
#   │   └── img2.jpg
#   └── dog/
#       ├── img3.jpg
#       └── img4.jpg

generator.generate()

# Output structure:
# dataset/
#   ├── train/
#   │   ├── cat/
#   │   └── dog/
#   ├── val/
#   │   ├── cat/
#   │   └── dog/
#   └── test/
#       ├── cat/
#       └── dog/
```

### DetectionDatasetGenerator

Detection dataset with YOLO format:

```python
from pycore.pyutils.ultralytics import DetectionDatasetGenerator

generator = DetectionDatasetGenerator(
    source_images="/path/to/images",
    source_labels="/path/to/labels",
    output_dir="/path/to/dataset",
    classes=["person", "car", "bike"]
)

# Source structure:
# images/
#   ├── img1.jpg
#   └── img2.jpg
# labels/
#   ├── img1.txt  (YOLO format: class x_center y_center width height)
#   └── img2.txt

generator.generate()

# Output structure:
# dataset/
#   ├── images/
#   │   ├── train/
#   │   ├── val/
#   │   └── test/
#   ├── labels/
#   │   ├── train/
#   │   ├── val/
#   │   └── test/
#   └── data.yaml

# data.yaml content:
# train: /path/to/dataset/images/train
# val: /path/to/dataset/images/val
# test: /path/to/dataset/images/test
# nc: 3
# names: ['person', 'car', 'bike']
```

## Usage Examples

### Complete Classification Workflow

```python
from pycore.pyutils.ultralytics import (
    ClassificationDatasetGenerator,
    ClassificationTrainer
)

# 1. Generate dataset
generator = ClassificationDatasetGenerator(
    source_dir="/data/raw_images",
    output_dir="/data/classification_dataset",
    train_ratio=0.8,
    val_ratio=0.15,
    test_ratio=0.05
)
generator.generate()

# 2. Train model
trainer = ClassificationTrainer(
    model_name="yolov8s-cls",
    data_path="/data/classification_dataset",
    output_dir="/models/classifier"
)

trainer.configure(
    epochs=50,
    batch_size=64,
    imgsz=224,
    patience=10
)

results = trainer.train()

# 3. Evaluate
metrics = trainer.evaluate()
print(f"Top-1 Accuracy: {metrics['top1']}")
print(f"Top-5 Accuracy: {metrics['top5']}")

# 4. Export
trainer.export(format="onnx")
print(f"Model exported to: {trainer.export_path}")
```

### Complete Detection Workflow

```python
from pycore.pyutils.ultralytics import (
    DetectionDatasetGenerator,
    DetectionTrainer
)

# 1. Generate dataset
generator = DetectionDatasetGenerator(
    source_images="/data/raw_images",
    source_labels="/data/annotations",
    output_dir="/data/detection_dataset",
    classes=["car", "truck", "bus", "motorcycle"]
)
generator.generate()

# 2. Train model
trainer = DetectionTrainer(
    model_name="yolov8m",
    data_yaml="/data/detection_dataset/data.yaml",
    output_dir="/models/detector"
)

trainer.configure(
    epochs=100,
    batch_size=16,
    imgsz=640,
    mosaic=1.0,
    mixup=0.1
)

results = trainer.train()

# 3. Evaluate
metrics = trainer.evaluate()
print(f"mAP50: {metrics['mAP50']:.4f}")
print(f"mAP50-95: {metrics['mAP50-95']:.4f}")
print(f"Precision: {metrics['precision']:.4f}")
print(f"Recall: {metrics['recall']:.4f}")

# 4. Export
trainer.export(format="onnx")
```

### Resume Training

```python
trainer = DetectionTrainer(
    model_name="yolov8n",
    data_yaml="/data/data.yaml"
)

# Resume from checkpoint
trainer.resume("/models/runs/train5/weights/last.pt")
results = trainer.train(epochs=50)  # Continue for 50 more epochs
```

### Model Inference

```python
from ultralytics import YOLO

# Load trained model
model = YOLO("/models/best.pt")

# Inference on image
results = model("/path/to/image.jpg")

# Inference on video
results = model("/path/to/video.mp4", stream=True)
for result in results:
    boxes = result.boxes
    for box in boxes:
        print(f"Class: {box.cls}, Confidence: {box.conf}")
```

## Data.yaml Format

```yaml
# Detection dataset configuration
train: /path/to/train/images
val: /path/to/val/images
test: /path/to/test/images  # optional

# Number of classes
nc: 4

# Class names
names:
  0: car
  1: truck
  2: bus
  3: motorcycle
```

## Available Models

### Classification

| Model | Size | Params | Accuracy |
|-------|------|--------|----------|
| yolov8n-cls | Nano | 2.7M | 69.0% |
| yolov8s-cls | Small | 6.4M | 73.8% |
| yolov8m-cls | Medium | 17.0M | 76.8% |
| yolov8l-cls | Large | 37.5M | 78.3% |
| yolov8x-cls | XLarge | 57.4M | 79.0% |

### Detection

| Model | Size | Params | mAP50-95 |
|-------|------|--------|----------|
| yolov8n | Nano | 3.2M | 37.3 |
| yolov8s | Small | 11.2M | 44.9 |
| yolov8m | Medium | 25.9M | 50.2 |
| yolov8l | Large | 43.7M | 52.9 |
| yolov8x | XLarge | 68.2M | 53.9 |

## Export Formats

| Format | Argument | File |
|--------|----------|------|
| PyTorch | pytorch | model.pt |
| TorchScript | torchscript | model.torchscript |
| ONNX | onnx | model.onnx |
| OpenVINO | openvino | model_openvino/ |
| TensorRT | engine | model.engine |
| CoreML | coreml | model.mlpackage |
| TF SavedModel | saved_model | model_saved_model/ |
| TF Lite | tflite | model.tflite |

## Best Practices

1. **Start Small**: Begin with yolov8n, scale up as needed

2. **Use Augmentation**: Enable mosaic and mixup for detection

3. **Monitor Training**: Use TensorBoard for visualization

4. **Early Stopping**: Set patience to prevent overfitting

5. **Validate Frequently**: Use val_period for regular validation

## Related Modules

- `pycore.pyutils.image_tools` - Image preprocessing
- `pycore.pyutils.ocr` - OCR for text detection
- `pycore.pyutils.unified_detector` - Multi-model detection

## Exports

```python
__all__ = [
    'ClassificationTrainer',
    'DetectionTrainer',
    'YOLODatasetGenerator',
    'ClassificationDatasetGenerator',
    'DetectionDatasetGenerator',
]
```















