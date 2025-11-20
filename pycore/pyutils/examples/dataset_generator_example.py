"""
Dataset Generator Usage Examples
========================================

Demonstrates how to use DatasetGenerator to automatically generate training datasets
"""

import sys
from pathlib import Path

# Add project path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from dataset_generator import generate_dataset, DatasetConfig, DatasetGenerator


def example_1_quick_generate():
    """Example 1: Quick Dataset Generation"""
    print("\n" + "=" * 80)
    print("Example 1: Quick Dataset Generation")
    print("=" * 80)

    result = generate_dataset(
        screen_image_path="D:/screenshots/game_screen.png",
        template_image_path="D:/icons/yes_button.png",
        output_dir="D:/datasets/yes_button_dataset",
        class_name="yes_button"
    )

    print(f"\nGeneration complete! Total samples: {result.get('total_samples', 0)}")


def example_2_custom_config():
    """Example 2: Custom Configuration"""
    print("\n" + "=" * 80)
    print("Example 2: Custom Configuration Parameters")
    print("=" * 80)

    result = generate_dataset(
        screen_image_path="D:/screenshots/game_screen.png",
        template_image_path="D:/icons/close_button.png",
        output_dir="D:/datasets/close_button_dataset",
        class_name="close_button",
        # Custom generation counts
        base_positive_count=200,
        base_negative_count=200,
        blur_augment_count=150,
        stretch_augment_count=150,
        # Custom augmentation parameters
        blur_kernel_sizes=[5, 7, 9, 11, 13],
        stretch_ratio_range=(0.6, 1.8)
    )

    print(f"\nGeneration complete! Total samples: {result.get('total_samples', 0)}")


def example_3_append_to_existing():
    """Example 3: Append to Existing Dataset"""
    print("\n" + "=" * 80)
    print("Example 3: Append to Existing Dataset")
    print("=" * 80)

    config = DatasetConfig(
        screen_image_path="D:/screenshots/game_screen_2.png",
        template_image_path="D:/icons/yes_button.png",
        output_dir="D:/datasets/yes_button_dataset",
        class_name="yes_button",
        # Specify existing metadata path, new samples will be appended to existing data
        metadata_path="D:/datasets/yes_button_dataset/metadata.json"
    )

    generator = DatasetGenerator(config)
    result = generator.generate()

    print(f"\nAppend complete! Total samples: {result.get('total_samples', 0)}")


def example_4_batch_generate():
    """Example 4: Batch Generate Multiple Classes"""
    print("\n" + "=" * 80)
    print("Example 4: Batch Generate Multiple Classes")
    print("=" * 80)

    # Define multiple icons
    icons = [
        ("yes_button", "D:/icons/yes_button.png"),
        ("no_button", "D:/icons/no_button.png"),
        ("close_button", "D:/icons/close_button.png"),
        ("menu_button", "D:/icons/menu_button.png"),
    ]

    screen_image = "D:/screenshots/game_screen.png"
    base_output_dir = "D:/datasets/game_ui_dataset"

    for class_name, template_path in icons:
        print(f"\nProcessing class: {class_name}")
        print("-" * 40)

        result = generate_dataset(
            screen_image_path=screen_image,
            template_image_path=template_path,
            output_dir=f"{base_output_dir}/{class_name}",
            class_name=class_name
        )

        print(f"✅ {class_name}: {result.get('total_samples', 0)} samples")


def example_5_different_screens():
    """Example 5: Use Multiple Different Screenshots"""
    print("\n" + "=" * 80)
    print("Example 5: Use Multiple Screenshots to Increase Data Diversity")
    print("=" * 80)

    template_path = "D:/icons/yes_button.png"
    output_dir = "D:/datasets/yes_button_multi_screen"
    class_name = "yes_button"

    # Multiple screenshots from different scenarios
    screen_images = [
        "D:/screenshots/main_menu.png",
        "D:/screenshots/game_playing.png",
        "D:/screenshots/settings_page.png",
        "D:/screenshots/inventory_page.png",
    ]

    for i, screen_path in enumerate(screen_images, 1):
        print(f"\nProcessing screen {i}/{len(screen_images)}: {Path(screen_path).name}")
        print("-" * 40)

        # First generation, subsequent appends
        metadata_path = None if i == 1 else f"{output_dir}/metadata.json"

        config = DatasetConfig(
            screen_image_path=screen_path,
            template_image_path=template_path,
            output_dir=output_dir,
            class_name=class_name,
            metadata_path=metadata_path,
            # Generate small number of samples per screen, accumulate for diversity
            base_positive_count=50,
            base_negative_count=50,
            blur_augment_count=50,
            stretch_augment_count=50
        )

        generator = DatasetGenerator(config)
        result = generator.generate()

        print(f"✅ Cumulative samples: {result.get('total_samples', 0)}")


def example_6_integration_with_training():
    """Example 6: Integration with Training Pipeline"""
    print("\n" + "=" * 80)
    print("Example 6: Generate Dataset and Train Directly")
    print("=" * 80)

    # Step 1: Generate dataset
    print("\n📊 Step 1: Generate Dataset")
    print("-" * 40)

    dataset_result = generate_dataset(
        screen_image_path="D:/screenshots/game_screen.png",
        template_image_path="D:/icons/yes_button.png",
        output_dir="D:/datasets/yes_button_dataset",
        class_name="yes_button"
    )

    if dataset_result.get('total_samples', 0) == 0:
        print("❌ Dataset generation failed")
        return

    print(f"✅ Dataset generation successful: {dataset_result['total_samples']} samples")

    # Step 2: Train model
    print("\n🎯 Step 2: Train Model")
    print("-" * 40)

    try:
        from ultralytics_trainer import train_from_config

        training_config = {
            "data": f"{dataset_result['output_dir']}/data.yaml",
            "model": "yolov8n.pt",
            "epochs": 50,
            "batch": 16,
            "imgsz": 640,
            "device": "cpu",
            "project": "runs/detect",
            "name": "yes_button_detector"
        }

        print("Starting training...")
        trainer = train_from_config(training_config)

        if trainer:
            print("\n✅ Training complete!")
            print(f"Model saved to: runs/detect/yes_button_detector/weights/best.pt")
    except ImportError:
        print("⚠️  ultralytics_trainer module not found, skipping training step")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Dataset Generator Examples")
    parser.add_argument("--example", type=int, default=1, choices=[1, 2, 3, 4, 5, 6],
                        help="Select example number (1-6)")

    args = parser.parse_args()

    examples = {
        1: example_1_quick_generate,
        2: example_2_custom_config,
        3: example_3_append_to_existing,
        4: example_4_batch_generate,
        5: example_5_different_screens,
        6: example_6_integration_with_training,
    }

    examples[args.example]()
