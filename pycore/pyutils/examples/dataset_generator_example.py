"""
数据集生成器使用示例
========================================

演示如何使用 DatasetGenerator 自动生成训练数据集
"""

import sys
from pathlib import Path

# 添加项目路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from dataset_generator import generate_dataset, DatasetConfig, DatasetGenerator


def example_1_quick_generate():
    """示例1: 快速生成数据集"""
    print("\n" + "=" * 80)
    print("示例1: 快速生成数据集")
    print("=" * 80)

    result = generate_dataset(
        screen_image_path="D:/screenshots/game_screen.png",
        template_image_path="D:/icons/yes_button.png",
        output_dir="D:/datasets/yes_button_dataset",
        class_name="yes_button"
    )

    print(f"\n生成完成! 总样本数: {result.get('total_samples', 0)}")


def example_2_custom_config():
    """示例2: 自定义配置"""
    print("\n" + "=" * 80)
    print("示例2: 自定义配置参数")
    print("=" * 80)

    result = generate_dataset(
        screen_image_path="D:/screenshots/game_screen.png",
        template_image_path="D:/icons/close_button.png",
        output_dir="D:/datasets/close_button_dataset",
        class_name="close_button",
        # 自定义生成数量
        base_positive_count=200,
        base_negative_count=200,
        blur_augment_count=150,
        stretch_augment_count=150,
        # 自定义增强参数
        blur_kernel_sizes=[5, 7, 9, 11, 13],
        stretch_ratio_range=(0.6, 1.8)
    )

    print(f"\n生成完成! 总样本数: {result.get('total_samples', 0)}")


def example_3_append_to_existing():
    """示例3: 追加到现有数据集"""
    print("\n" + "=" * 80)
    print("示例3: 追加到现有数据集")
    print("=" * 80)

    config = DatasetConfig(
        screen_image_path="D:/screenshots/game_screen_2.png",
        template_image_path="D:/icons/yes_button.png",
        output_dir="D:/datasets/yes_button_dataset",
        class_name="yes_button",
        # 指定已有元数据路径，新样本会追加到已有数据中
        metadata_path="D:/datasets/yes_button_dataset/metadata.json"
    )

    generator = DatasetGenerator(config)
    result = generator.generate()

    print(f"\n追加完成! 总样本数: {result.get('total_samples', 0)}")


def example_4_batch_generate():
    """示例4: 批量生成多个类别"""
    print("\n" + "=" * 80)
    print("示例4: 批量生成多个类别")
    print("=" * 80)

    # 定义多个图标
    icons = [
        ("yes_button", "D:/icons/yes_button.png"),
        ("no_button", "D:/icons/no_button.png"),
        ("close_button", "D:/icons/close_button.png"),
        ("menu_button", "D:/icons/menu_button.png"),
    ]

    screen_image = "D:/screenshots/game_screen.png"
    base_output_dir = "D:/datasets/game_ui_dataset"

    for class_name, template_path in icons:
        print(f"\n处理类别: {class_name}")
        print("-" * 40)

        result = generate_dataset(
            screen_image_path=screen_image,
            template_image_path=template_path,
            output_dir=f"{base_output_dir}/{class_name}",
            class_name=class_name
        )

        print(f"✅ {class_name}: {result.get('total_samples', 0)} 个样本")


def example_5_different_screens():
    """示例5: 使用多个不同的屏幕截图"""
    print("\n" + "=" * 80)
    print("示例5: 使用多个屏幕截图增加数据多样性")
    print("=" * 80)

    template_path = "D:/icons/yes_button.png"
    output_dir = "D:/datasets/yes_button_multi_screen"
    class_name = "yes_button"

    # 多个不同场景的屏幕截图
    screen_images = [
        "D:/screenshots/main_menu.png",
        "D:/screenshots/game_playing.png",
        "D:/screenshots/settings_page.png",
        "D:/screenshots/inventory_page.png",
    ]

    for i, screen_path in enumerate(screen_images, 1):
        print(f"\n处理屏幕 {i}/{len(screen_images)}: {Path(screen_path).name}")
        print("-" * 40)

        # 第一次生成，后续追加
        metadata_path = None if i == 1 else f"{output_dir}/metadata.json"

        config = DatasetConfig(
            screen_image_path=screen_path,
            template_image_path=template_path,
            output_dir=output_dir,
            class_name=class_name,
            metadata_path=metadata_path,
            # 每个屏幕生成少量样本，累积起来达到多样性
            base_positive_count=50,
            base_negative_count=50,
            blur_augment_count=50,
            stretch_augment_count=50
        )

        generator = DatasetGenerator(config)
        result = generator.generate()

        print(f"✅ 累计样本数: {result.get('total_samples', 0)}")


def example_6_integration_with_training():
    """示例6: 集成到训练流程"""
    print("\n" + "=" * 80)
    print("示例6: 生成数据集并直接训练")
    print("=" * 80)

    # Step 1: 生成数据集
    print("\n📊 Step 1: 生成数据集")
    print("-" * 40)

    dataset_result = generate_dataset(
        screen_image_path="D:/screenshots/game_screen.png",
        template_image_path="D:/icons/yes_button.png",
        output_dir="D:/datasets/yes_button_dataset",
        class_name="yes_button"
    )

    if dataset_result.get('total_samples', 0) == 0:
        print("❌ 数据集生成失败")
        return

    print(f"✅ 数据集生成成功: {dataset_result['total_samples']} 个样本")

    # Step 2: 训练模型
    print("\n🎯 Step 2: 训练模型")
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

        print("开始训练...")
        trainer = train_from_config(training_config)

        if trainer:
            print("\n✅ 训练完成!")
            print(f"模型保存在: runs/detect/yes_button_detector/weights/best.pt")
    except ImportError:
        print("⚠️  未找到 ultralytics_trainer 模块，跳过训练步骤")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="数据集生成器示例")
    parser.add_argument("--example", type=int, default=1, choices=[1, 2, 3, 4, 5, 6],
                        help="选择示例编号 (1-6)")

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
