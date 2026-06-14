#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UnifiedDetector Usage Examples
Demonstrates how to use the unified object detector
"""

from pycore.pyutils.window.unified_detector import UnifiedDetector
from pathlib import Path


def example_basic_detection():
    """Example 1: Basic Detection"""
    print("=" * 80)
    print("Example 1: Basic Detection")
    print("=" * 80)

    # Create detector (automatically uses latest model)
    detector = UnifiedDetector("d3-check")

    # Detect image
    results = detector.detect("screenshot.png")

    # Print results
    print(f"\nDetected {len(results)} objects:")
    for i, result in enumerate(results, 1):
        print(f"\n[{i}] {result.class_name}")
        print(f"    Confidence: {result.confidence:.3f}")
        print(f"    Position: x={result.bbox['x']}, y={result.bbox['y']}, "
              f"w={result.bbox['w']}, h={result.bbox['h']}")
        print(f"    Model: {result.model_name}")


def example_target_class():
    """Example 2: Detect Specific Class"""
    print("\n" + "=" * 80)
    print("Example 2: Detect Specific Class")
    print("=" * 80)

    detector = UnifiedDetector("d3-check")

    # View available classes
    classes = detector.get_available_classes()
    print(f"\nAvailable classes: {classes}")

    # Only detect progress bars
    results = detector.detect(
        "screenshot.png",
        target_class="progress_bar"
    )

    if results:
        print(f"\nFound {len(results)} progress bars:")
        for result in results:
            print(f"  Position: {result.bbox}")
            print(f"  Confidence: {result.confidence:.3f}")
    else:
        print("\nNo progress bars found")


def example_specify_model():
    """Example 3: Specify Model"""
    print("\n" + "=" * 80)
    print("Example 3: Specify Model")
    print("=" * 80)

    # Specify particular model
    detector = UnifiedDetector(
        "d3-check",
        model_name="unified_model_20251017_143052"
    )

    # Get model information
    info = detector.get_model_info()
    print(f"\nModel Information:")
    print(f"  Project: {info['project']}")
    print(f"  Device: {info['device']}")
    if 'detection' in info:
        print(f"  Detection Model: {info['detection']['name']}")
        print(f"  Created: {info['detection']['created']}")
        print(f"  Classes: {info['detection']['classes']}")


def example_detect_and_draw():
    """Example 4: Detect and Draw"""
    print("\n" + "=" * 80)
    print("Example 4: Detect and Draw")
    print("=" * 80)

    detector = UnifiedDetector("d3-check")

    # Detect and draw results
    results, output_img = detector.detect_and_draw(
        "screenshot.png",
        output_path="result.png"
    )

    print(f"\nDetected {len(results)} objects")
    print(f"Results saved to: result.png")


def example_batch_detection():
    """Example 5: Batch Detection"""
    print("\n" + "=" * 80)
    print("Example 5: Batch Detection")
    print("=" * 80)

    detector = UnifiedDetector("d3-check")

    # Batch process images
    image_dir = Path("screenshots")
    if image_dir.exists():
        for img_path in image_dir.glob("*.png"):
            results = detector.detect(str(img_path))
            print(f"{img_path.name}: Detected {len(results)} objects")
    else:
        print(f"Directory does not exist: {image_dir}")


def example_custom_confidence():
    """Example 6: Custom Confidence"""
    print("\n" + "=" * 80)
    print("Example 6: Custom Confidence")
    print("=" * 80)

    detector = UnifiedDetector("d3-check")

    # Use different confidence thresholds
    for conf in [0.1, 0.25, 0.5, 0.8]:
        results = detector.detect(
            "screenshot.png",
            confidence_threshold=conf
        )
        print(f"Confidence {conf}: Detected {len(results)} objects")


def example_filter_high_confidence():
    """Example 7: Filter High Confidence Results"""
    print("\n" + "=" * 80)
    print("Example 7: Filter High Confidence Results")
    print("=" * 80)

    detector = UnifiedDetector("d3-check")

    # Detect
    results = detector.detect("screenshot.png")

    # Sort by confidence
    results_sorted = sorted(results, key=lambda x: x.confidence, reverse=True)

    # Only process high confidence results
    print(f"\nHigh confidence detections (>0.8):")
    for result in results_sorted:
        if result.confidence > 0.8:
            print(f"  {result.class_name}: {result.confidence:.3f}")


def example_json_output():
    """Example 8: JSON Format Output"""
    print("\n" + "=" * 80)
    print("Example 8: JSON Format Output")
    print("=" * 80)

    import json

    detector = UnifiedDetector("d3-check")

    # Detect
    results = detector.detect("screenshot.png")

    # Convert to JSON
    output = {
        'image': 'screenshot.png',
        'detections': [r.to_dict() for r in results],
        'count': len(results)
    }

    print(f"\nJSON Output:")
    print(json.dumps(output, indent=2, ensure_ascii=False))


def example_error_handling():
    """Example 9: Error Handling"""
    print("\n" + "=" * 80)
    print("Example 9: Error Handling")
    print("=" * 80)

    try:
        # Try to use non-existent project
        detector = UnifiedDetector("non-existent-project")
    except ValueError as e:
        print(f"\nConfiguration error: {e}")

    try:
        detector = UnifiedDetector("d3-check")
        # Try to detect non-existent image
        results = detector.detect("non-existent.png")
    except Exception as e:
        print(f"Detection failed: {e}")


def example_find_specific_object():
    """Example 10: Find Specific Object"""
    print("\n" + "=" * 80)
    print("Example 10: Find Specific Object")
    print("=" * 80)

    detector = UnifiedDetector("d3-check")

    # Find confirm button
    results = detector.detect(
        "screenshot.png",
        target_class="confirm_button"
    )

    if results:
        button = results[0]  # Take first result
        print(f"\nFound confirm button:")
        print(f"  Position: x={button.bbox['x']}, y={button.bbox['y']}")
        print(f"  Size: w={button.bbox['w']}, h={button.bbox['h']}")
        print(f"  Confidence: {button.confidence:.3f}")

        # Calculate center point
        center_x = button.bbox['x'] + button.bbox['w'] // 2
        center_y = button.bbox['y'] + button.bbox['h'] // 2
        print(f"  Center point: ({center_x}, {center_y})")
    else:
        print("\nConfirm button not found")


if __name__ == "__main__":
    # Run all examples
    examples = [
        example_basic_detection,
        example_target_class,
        example_specify_model,
        example_detect_and_draw,
        example_batch_detection,
        example_custom_confidence,
        example_filter_high_confidence,
        example_json_output,
        example_error_handling,
        example_find_specific_object,
    ]

    print("\n" + "=" * 80)
    print("UnifiedDetector Usage Examples")
    print("=" * 80)

    for example in examples:
        try:
            example()
        except Exception as e:
            print(f"\nExample execution error: {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "=" * 80)
    print("All examples completed")
    print("=" * 80)
