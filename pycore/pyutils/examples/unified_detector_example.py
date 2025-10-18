#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UnifiedDetector 使用示例
展示如何使用通用目标检测器
"""

from pycore.pyutils.unified_detector import UnifiedDetector
from pathlib import Path


def example_basic_detection():
    """示例 1: 基本检测"""
    print("=" * 80)
    print("示例 1: 基本检测")
    print("=" * 80)

    # 创建检测器（自动使用最新模型）
    detector = UnifiedDetector("d3-check")

    # 检测图片
    results = detector.detect("screenshot.png")

    # 打印结果
    print(f"\n检测到 {len(results)} 个目标:")
    for i, result in enumerate(results, 1):
        print(f"\n[{i}] {result.class_name}")
        print(f"    置信度: {result.confidence:.3f}")
        print(f"    位置: x={result.bbox['x']}, y={result.bbox['y']}, "
              f"w={result.bbox['w']}, h={result.bbox['h']}")
        print(f"    模型: {result.model_name}")


def example_target_class():
    """示例 2: 检测特定类别"""
    print("\n" + "=" * 80)
    print("示例 2: 检测特定类别")
    print("=" * 80)

    detector = UnifiedDetector("d3-check")

    # 查看可用类别
    classes = detector.get_available_classes()
    print(f"\n可用类别: {classes}")

    # 只检测进度条
    results = detector.detect(
        "screenshot.png",
        target_class="progress_bar"
    )

    if results:
        print(f"\n找到 {len(results)} 个进度条:")
        for result in results:
            print(f"  位置: {result.bbox}")
            print(f"  置信度: {result.confidence:.3f}")
    else:
        print("\n未找到进度条")


def example_specify_model():
    """示例 3: 指定模型"""
    print("\n" + "=" * 80)
    print("示例 3: 指定模型")
    print("=" * 80)

    # 指定特定模型
    detector = UnifiedDetector(
        "d3-check",
        model_name="unified_model_20251017_143052"
    )

    # 获取模型信息
    info = detector.get_model_info()
    print(f"\n模型信息:")
    print(f"  项目: {info['project']}")
    print(f"  设备: {info['device']}")
    if 'detection' in info:
        print(f"  检测模型: {info['detection']['name']}")
        print(f"  创建时间: {info['detection']['created']}")
        print(f"  类别: {info['detection']['classes']}")


def example_detect_and_draw():
    """示例 4: 检测并绘制"""
    print("\n" + "=" * 80)
    print("示例 4: 检测并绘制")
    print("=" * 80)

    detector = UnifiedDetector("d3-check")

    # 检测并绘制结果
    results, output_img = detector.detect_and_draw(
        "screenshot.png",
        output_path="result.png"
    )

    print(f"\n检测到 {len(results)} 个目标")
    print(f"已保存结果到: result.png")


def example_batch_detection():
    """示例 5: 批量检测"""
    print("\n" + "=" * 80)
    print("示例 5: 批量检测")
    print("=" * 80)

    detector = UnifiedDetector("d3-check")

    # 批量处理图片
    image_dir = Path("screenshots")
    if image_dir.exists():
        for img_path in image_dir.glob("*.png"):
            results = detector.detect(str(img_path))
            print(f"{img_path.name}: 检测到 {len(results)} 个目标")
    else:
        print(f"目录不存在: {image_dir}")


def example_custom_confidence():
    """示例 6: 自定义置信度"""
    print("\n" + "=" * 80)
    print("示例 6: 自定义置信度")
    print("=" * 80)

    detector = UnifiedDetector("d3-check")

    # 使用不同的置信度阈值
    for conf in [0.1, 0.25, 0.5, 0.8]:
        results = detector.detect(
            "screenshot.png",
            confidence_threshold=conf
        )
        print(f"置信度 {conf}: 检测到 {len(results)} 个目标")


def example_filter_high_confidence():
    """示例 7: 过滤高置信度结果"""
    print("\n" + "=" * 80)
    print("示例 7: 过滤高置信度结果")
    print("=" * 80)

    detector = UnifiedDetector("d3-check")

    # 检测
    results = detector.detect("screenshot.png")

    # 按置信度排序
    results_sorted = sorted(results, key=lambda x: x.confidence, reverse=True)

    # 只处理高置信度的结果
    print(f"\n高置信度检测 (>0.8):")
    for result in results_sorted:
        if result.confidence > 0.8:
            print(f"  {result.class_name}: {result.confidence:.3f}")


def example_json_output():
    """示例 8: JSON 格式输出"""
    print("\n" + "=" * 80)
    print("示例 8: JSON 格式输出")
    print("=" * 80)

    import json

    detector = UnifiedDetector("d3-check")

    # 检测
    results = detector.detect("screenshot.png")

    # 转换为 JSON
    output = {
        'image': 'screenshot.png',
        'detections': [r.to_dict() for r in results],
        'count': len(results)
    }

    print(f"\nJSON 输出:")
    print(json.dumps(output, indent=2, ensure_ascii=False))


def example_error_handling():
    """示例 9: 错误处理"""
    print("\n" + "=" * 80)
    print("示例 9: 错误处理")
    print("=" * 80)

    try:
        # 尝试使用不存在的项目
        detector = UnifiedDetector("non-existent-project")
    except ValueError as e:
        print(f"\n配置错误: {e}")

    try:
        detector = UnifiedDetector("d3-check")
        # 尝试检测不存在的图片
        results = detector.detect("non-existent.png")
    except Exception as e:
        print(f"检测失败: {e}")


def example_find_specific_object():
    """示例 10: 查找特定目标"""
    print("\n" + "=" * 80)
    print("示例 10: 查找特定目标")
    print("=" * 80)

    detector = UnifiedDetector("d3-check")

    # 查找确认按钮
    results = detector.detect(
        "screenshot.png",
        target_class="confirm_button"
    )

    if results:
        button = results[0]  # 取第一个结果
        print(f"\n找到确认按钮:")
        print(f"  位置: x={button.bbox['x']}, y={button.bbox['y']}")
        print(f"  大小: w={button.bbox['w']}, h={button.bbox['h']}")
        print(f"  置信度: {button.confidence:.3f}")

        # 计算中心点
        center_x = button.bbox['x'] + button.bbox['w'] // 2
        center_y = button.bbox['y'] + button.bbox['h'] // 2
        print(f"  中心点: ({center_x}, {center_y})")
    else:
        print("\n未找到确认按钮")


if __name__ == "__main__":
    # 运行所有示例
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
    print("UnifiedDetector 使用示例")
    print("=" * 80)

    for example in examples:
        try:
            example()
        except Exception as e:
            print(f"\n示例运行出错: {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "=" * 80)
    print("所有示例运行完成")
    print("=" * 80)
