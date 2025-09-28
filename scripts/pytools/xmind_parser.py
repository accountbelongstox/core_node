#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
XMind 解析工具
用于解析 XMind 文件并输出为 JSON 或 XML 格式

功能：
1. 自动检测并安装 xmindparser 包
2. 解析 XMind 文件（支持 XmindZen 和 XmindPro）
3. 输出为 JSON 或 XML 格式
4. 支持命令行参数

使用方法：
python xmind_parser.py <xmind_file_path> [--format json|xml] [--output output_file]
"""

import os
import sys
import json
import argparse
import logging
from pathlib import Path

# 添加项目根目录到 Python 路径
current_dir = Path(__file__).parent
project_root = current_dir.parent.parent
sys.path.insert(0, str(project_root))

def install_package(package_name):
    """自动安装 Python 包"""
    try:
        import subprocess
        import importlib
        
        # 尝试导入包
        importlib.import_module(package_name)
        print(f"[OK] {package_name} 已安装")
        return True
    except ImportError:
        print(f"[WARN] {package_name} 未安装，正在自动安装...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", package_name])
            print(f"[OK] {package_name} 安装成功")
            return True
        except subprocess.CalledProcessError as e:
            print(f"[ERROR] {package_name} 安装失败: {e}")
            return False

def test_xmindparser_import():
    """测试 xmindparser 包导入"""
    print("正在测试 xmindparser 包...")
    
    # 尝试导入 xmindparser
    try:
        import xmindparser
        print("[OK] xmindparser 导入成功")
        print(f"  版本信息: {getattr(xmindparser, '__version__', '未知')}")
        return True
    except ImportError:
        print("[ERROR] xmindparser 导入失败")
        return False

def parse_xmind_file(file_path, output_format='json', output_file=None, show_topic_id=False, hide_empty_value=True):
    """
    解析 XMind 文件
    
    Args:
        file_path (str): XMind 文件路径
        output_format (str): 输出格式 ('json' 或 'xml')
        output_file (str): 输出文件路径（可选）
        show_topic_id (bool): 是否显示主题ID
        hide_empty_value (bool): 是否隐藏空值
    
    Returns:
        dict: 解析后的数据
    """
    try:
        from xmindparser import xmind_to_dict, config
        
        # 配置日志
        config['logName'] = 'xmind_parser'
        config['logLevel'] = logging.INFO
        config['logFormat'] = '%(asctime)s %(levelname)-8s: %(message)s'
        config['showTopicId'] = show_topic_id
        config['hideEmptyValue'] = hide_empty_value
        
        print(f"正在解析 XMind 文件: {file_path}")
        
        # 解析文件
        data = xmind_to_dict(file_path)
        
        if output_format.lower() == 'json':
            output_data = json.dumps(data, ensure_ascii=False, indent=2)
        elif output_format.lower() == 'xml':
            try:
                from dicttoxml import dicttoxml
                xml_data = dicttoxml(data, custom_root='xmind_data', attr_type=False)
                output_data = xml_data.decode('utf-8')
            except ImportError:
                print("⚠ dicttoxml 包未安装，无法输出 XML 格式")
                print("  请运行: pip install dicttoxml")
                output_format = 'json'
                output_data = json.dumps(data, ensure_ascii=False, indent=2)
        else:
            raise ValueError(f"不支持的输出格式: {output_format}")
        
        # 输出结果
        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(output_data)
            print(f"[OK] 解析结果已保存到: {output_file}")
        else:
            print(f"\n=== XMind 解析结果 ({output_format.upper()}) ===")
            print(output_data)
        
        return data
        
    except Exception as e:
        print(f"[ERROR] 解析 XMind 文件失败: {e}")
        return None

def get_xmind_zen_json(file_path):
    """获取 XMindZen 文件的原始 JSON 内容"""
    try:
        from xmindparser import get_xmind_zen_builtin_json
        return get_xmind_zen_builtin_json(file_path)
    except Exception as e:
        print(f"[ERROR] 获取 XMindZen JSON 失败: {e}")
        return None

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='XMind 文件解析工具')
    parser.add_argument('file_path', help='XMind 文件路径')
    parser.add_argument('--format', '-f', choices=['json', 'xml'], default='json', 
                       help='输出格式 (默认: json)')
    parser.add_argument('--output', '-o', help='输出文件路径')
    parser.add_argument('--show-topic-id', action='store_true', 
                       help='显示主题ID')
    parser.add_argument('--show-empty', action='store_true', 
                       help='显示空值')
    parser.add_argument('--zen-json', action='store_true', 
                       help='仅显示 XMindZen 原始 JSON（如果适用）')
    parser.add_argument('--test-only', action='store_true', 
                       help='仅测试包导入，不解析文件')
    
    args = parser.parse_args()
    
    print("=== XMind 解析工具 ===")
    print(f"Python 版本: {sys.version}")
    print(f"工作目录: {os.getcwd()}")
    print()
    
    # 测试包导入
    if not test_xmindparser_import():
        print("正在尝试安装 xmindparser...")
        if not install_package('xmindparser'):
            print("[ERROR] 无法安装 xmindparser，请手动安装: pip install xmindparser")
            return 1
    
    # 仅测试模式
    if args.test_only:
        print("[OK] 包导入测试完成")
        return 0
    
    # 检查文件是否存在
    if not os.path.exists(args.file_path):
        print(f"[ERROR] 文件不存在: {args.file_path}")
        return 1
    
    print(f"[OK] 文件存在: {args.file_path}")
    print(f"  文件大小: {os.path.getsize(args.file_path)} 字节")
    print()
    
    # 如果是 XMindZen 且请求原始 JSON
    if args.zen_json:
        print("获取 XMindZen 原始 JSON...")
        zen_data = get_xmind_zen_json(args.file_path)
        if zen_data:
            if args.output:
                with open(args.output, 'w', encoding='utf-8') as f:
                    json.dump(zen_data, f, ensure_ascii=False, indent=2)
                print(f"[OK] XMindZen JSON 已保存到: {args.output}")
            else:
                print("\n=== XMindZen 原始 JSON ===")
                print(json.dumps(zen_data, ensure_ascii=False, indent=2))
        return 0
    
    # 解析文件
    data = parse_xmind_file(
        args.file_path, 
        args.format, 
        args.output,
        args.show_topic_id,
        not args.show_empty
    )
    
    if data:
        print("[OK] 解析完成")
        return 0
    else:
        print("[ERROR] 解析失败")
        return 1

if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\n用户中断操作")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] 程序执行出错: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
