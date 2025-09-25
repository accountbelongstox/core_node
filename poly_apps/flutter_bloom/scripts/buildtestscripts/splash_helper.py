#!/usr/bin/env python3
"""
Flutter Splash Screen Helper
自动处理启动图转换和配置生成的Python辅助脚本
Author: Claude AI Assistant
Date: 2025-09-24
"""

import argparse
import os
import sys
from pathlib import Path
from PIL import Image
import yaml

def convert_image(input_path, output_path, target_format="png"):
    """
    转换图片格式
    
    Args:
        input_path (str): 输入图片路径
        output_path (str): 输出图片路径
        target_format (str): 目标格式 (png, jpg, webp)
    """
    try:
        print(f"Converting {input_path} to {target_format.upper()} format...")
        
        # 打开图片
        with Image.open(input_path) as img:
            # 如果是RGBA模式且目标格式是JPG，需要转换为RGB
            if img.mode == 'RGBA' and target_format.lower() in ['jpg', 'jpeg']:
                # 创建白色背景
                background = Image.new('RGB', img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[-1])  # 使用alpha通道作为mask
                img = background
            
            # 保存图片
            img.save(output_path, format=target_format.upper())
            print(f"Image converted successfully: {output_path}")
            
            # 输出图片信息
            print(f"Image size: {img.size[0]}x{img.size[1]}")
            print(f"Image mode: {img.mode}")
            
    except Exception as e:
        print(f"Error converting image: {e}", file=sys.stderr)
        sys.exit(1)

def generate_splash_config(app_name, background_image, output_file, logo_image=None, fullscreen_mode=True):
    """
    生成flutter_native_splash配置文件

    Args:
        app_name (str): 应用名称
        background_image (str): 背景图片路径
        output_file (str): 输出配置文件路径
        logo_image (str, optional): Logo图片路径
        fullscreen_mode (bool): 是否使用全屏模式（仅背景图，不显示logo）
    """
    try:
        print(f"Generating splash configuration for app: {app_name}")
        print(f"Fullscreen mode: {fullscreen_mode}")

        # 转换为相对路径（相对于项目根目录）
        project_root = Path(output_file).parent
        bg_relative = os.path.relpath(background_image, project_root).replace('\\', '/')

        # 基础配置 - 全屏背景图模式
        config = {
            'flutter_native_splash': {
                # 使用背景图片实现全屏启动图
                'background_image': bg_relative,

                # 深色模式使用相同的背景图
                'background_image_dark': bg_relative,

                # Android 12+ 配置 - 使用纯色背景和图标
                'android_12': {
                    # 从背景图提取主色调作为Android 12的背景色
                    'color': '#667eea',
                    'icon_background_color': '#667eea',
                    'color_dark': '#121212',
                    'icon_background_color_dark': '#121212'
                },

                # 平台配置
                'android': True,
                'ios': True,
                'web': True,

                # Android图片重力设置，确保全屏显示
                'android_gravity': 'fill'
            }
        }

        # 如果不是全屏模式且有logo图片，添加logo配置
        if not fullscreen_mode and logo_image and os.path.exists(logo_image):
            logo_relative = os.path.relpath(logo_image, project_root).replace('\\', '/')
            config['flutter_native_splash']['image'] = logo_relative
            config['flutter_native_splash']['image_dark'] = logo_relative
            config['flutter_native_splash']['android_12']['image'] = logo_relative
            config['flutter_native_splash']['android_12']['image_dark'] = logo_relative
            print(f"Logo image configured: {logo_relative}")
        elif fullscreen_mode:
            print("Fullscreen mode: No logo will be displayed over the background")

        # 写入配置文件
        with open(output_file, 'w', encoding='utf-8') as f:
            yaml.dump(config, f, default_flow_style=False, allow_unicode=True, indent=2)

        print(f"Configuration generated: {output_file}")
        print(f"Background image: {bg_relative}")

        # 显示配置预览
        print("\nConfiguration preview:")
        print("=" * 50)
        with open(output_file, 'r', encoding='utf-8') as f:
            print(f.read())
        print("=" * 50)

    except Exception as e:
        print(f"Error generating configuration: {e}", file=sys.stderr)
        sys.exit(1)

def optimize_image_for_splash(input_path, output_path, max_size=(1080, 1920)):
    """
    优化图片用于启动屏幕
    
    Args:
        input_path (str): 输入图片路径
        output_path (str): 输出图片路径
        max_size (tuple): 最大尺寸 (width, height)
    """
    try:
        print(f"Optimizing image for splash screen...")
        
        with Image.open(input_path) as img:
            # 获取原始尺寸
            original_size = img.size
            print(f"Original size: {original_size[0]}x{original_size[1]}")
            
            # 如果图片太大，进行缩放
            if img.size[0] > max_size[0] or img.size[1] > max_size[1]:
                img.thumbnail(max_size, Image.Resampling.LANCZOS)
                print(f"Resized to: {img.size[0]}x{img.size[1]}")
            
            # 确保是RGB模式
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # 保存优化后的图片
            img.save(output_path, 'PNG', optimize=True)
            print(f"Optimized image saved: {output_path}")
            
    except Exception as e:
        print(f"Error optimizing image: {e}", file=sys.stderr)
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description='Flutter Splash Screen Helper')
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # 转换命令
    convert_parser = subparsers.add_parser('convert', help='Convert image format')
    convert_parser.add_argument('--input', required=True, help='Input image path')
    convert_parser.add_argument('--output', required=True, help='Output image path')
    convert_parser.add_argument('--format', default='png', choices=['png', 'jpg', 'jpeg', 'webp'], help='Target format')
    
    # 配置生成命令
    config_parser = subparsers.add_parser('config', help='Generate splash configuration')
    config_parser.add_argument('--app-name', required=True, help='App name')
    config_parser.add_argument('--background-image', required=True, help='Background image path')
    config_parser.add_argument('--logo-image', help='Logo image path (optional)')
    config_parser.add_argument('--output', required=True, help='Output configuration file')
    config_parser.add_argument('--fullscreen', action='store_true', default=True, help='Use fullscreen background mode (default: True)')
    config_parser.add_argument('--with-logo', action='store_true', help='Include logo over background image')
    
    # 优化命令
    optimize_parser = subparsers.add_parser('optimize', help='Optimize image for splash screen')
    optimize_parser.add_argument('--input', required=True, help='Input image path')
    optimize_parser.add_argument('--output', required=True, help='Output image path')
    optimize_parser.add_argument('--max-width', type=int, default=1080, help='Maximum width')
    optimize_parser.add_argument('--max-height', type=int, default=1920, help='Maximum height')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    try:
        if args.command == 'convert':
            convert_image(args.input, args.output, args.format)
        elif args.command == 'config':
            fullscreen_mode = args.fullscreen and not args.with_logo
            generate_splash_config(args.app_name, args.background_image, args.output, args.logo_image, fullscreen_mode)
        elif args.command == 'optimize':
            optimize_image_for_splash(args.input, args.output, (args.max_width, args.max_height))
        
        print("Operation completed successfully!")
        
    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
