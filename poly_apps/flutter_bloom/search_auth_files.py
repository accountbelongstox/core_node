#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Flutter Bloom 权限配置文件搜索工具
=====================================

功能:
1. 根据文件名搜索权限配置文件
2. 显示文件内容和权限信息
3. 分析权限配置

使用方法:
python search_auth_files.py [文件名关键词]

示例:
python search_auth_files.py AndroidManifest
python search_auth_files.py Info.plist
python search_auth_files.py build.gradle
"""

import os
import sys
import re
from pathlib import Path
from typing import List, Dict, Tuple

class AuthFileSearcher:
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.auth_files = {
            # Android权限配置文件
            'android': {
                'AndroidManifest.xml': [
                    'android/app/src/main/AndroidManifest.xml',
                    'android/app/src/debug/AndroidManifest.xml',
                    'android/app/src/profile/AndroidManifest.xml'
                ],
                'build.gradle': [
                    'android/app/build.gradle',
                    'android/build.gradle'
                ],
                'gradle.properties': ['android/gradle.properties'],
                'proguard-rules.pro': ['android/app/proguard-rules.pro']
            },
            # iOS权限配置文件
            'ios': {
                'Info.plist': ['ios/Runner/Info.plist'],
                'Podfile': ['ios/Podfile'],
                'project.pbxproj': ['ios/Runner.xcodeproj/project.pbxproj']
            },
            # Web权限配置文件
            'web': {
                'manifest.json': ['web/manifest.json'],
                'index.html': ['web/index.html']
            },
            # 项目配置文件
            'project': {
                'pubspec.yaml': ['pubspec.yaml'],
                'flutter_native_splash.yaml': ['flutter_native_splash.yaml']
            }
        }
    
    def search_files(self, keyword: str = '') -> List[Tuple[str, str, str]]:
        """
        搜索权限配置文件
        
        Args:
            keyword: 搜索关键词，为空则返回所有文件
            
        Returns:
            List of (platform, filename, filepath) tuples
        """
        results = []
        
        for platform, files in self.auth_files.items():
            for filename, filepaths in files.items():
                if not keyword or keyword.lower() in filename.lower():
                    for filepath in filepaths:
                        full_path = self.project_root / filepath
                        if full_path.exists():
                            results.append((platform, filename, str(full_path)))
        
        return results
    
    def analyze_android_permissions(self, filepath: str) -> List[str]:
        """分析Android权限"""
        permissions = []
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                # 查找uses-permission
                permission_pattern = r'<uses-permission\s+android:name="([^"]+)"'
                permissions.extend(re.findall(permission_pattern, content))
                
                # 查找uses-feature
                feature_pattern = r'<uses-feature\s+android:name="([^"]+)"'
                features = re.findall(feature_pattern, content)
                permissions.extend([f"FEATURE: {f}" for f in features])
                
        except Exception as e:
            print(f"读取文件失败: {e}")
        
        return permissions
    
    def analyze_ios_permissions(self, filepath: str) -> List[str]:
        """分析iOS权限"""
        permissions = []
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                # 查找权限描述键
                permission_keys = [
                    'NSCameraUsageDescription',
                    'NSMicrophoneUsageDescription',
                    'NSLocationWhenInUseUsageDescription',
                    'NSLocationAlwaysAndWhenInUseUsageDescription',
                    'NSLocationAlwaysUsageDescription',
                    'NSPhotoLibraryUsageDescription',
                    'NSPhotoLibraryAddUsageDescription',
                    'NSContactsUsageDescription',
                    'NSDocumentsFolderUsageDescription',
                    'NSDownloadsFolderUsageDescription',
                    'NSDesktopFolderUsageDescription',
                    'NSUserTrackingUsageDescription',
                    'NSAppleMusicUsageDescription'
                ]
                
                for key in permission_keys:
                    if key in content:
                        permissions.append(key)
                
                # 查找后台模式
                if 'UIBackgroundModes' in content:
                    bg_modes = re.findall(r'<string>([^<]+)</string>', content)
                    for mode in bg_modes:
                        if mode in ['location', 'audio', 'fetch', 'remote-notification']:
                            permissions.append(f"BACKGROUND_MODE: {mode}")
                            
        except Exception as e:
            print(f"读取文件失败: {e}")
        
        return permissions
    
    def print_file_content(self, filepath: str, max_lines: int = 50):
        """打印文件内容"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                print(f"\n文件内容 (前{min(max_lines, len(lines))}行):")
                print("-" * 50)
                for i, line in enumerate(lines[:max_lines], 1):
                    print(f"{i:3d}: {line.rstrip()}")
                
                if len(lines) > max_lines:
                    print(f"... (还有 {len(lines) - max_lines} 行)")
                    
        except Exception as e:
            print(f"读取文件失败: {e}")
    
    def search_and_display(self, keyword: str = '', show_content: bool = False):
        """搜索并显示结果"""
        results = self.search_files(keyword)
        
        if not results:
            print(f"未找到包含关键词 '{keyword}' 的权限配置文件")
            return
        
        print(f"找到 {len(results)} 个权限配置文件:")
        print("=" * 60)
        
        for platform, filename, filepath in results:
            print(f"\n平台: {platform.upper()}")
            print(f"文件名: {filename}")
            print(f"路径: {filepath}")
            
            # 分析权限
            if 'AndroidManifest.xml' in filename:
                permissions = self.analyze_android_permissions(filepath)
                if permissions:
                    print("权限列表:")
                    for perm in permissions:
                        print(f"  - {perm}")
            
            elif 'Info.plist' in filename:
                permissions = self.analyze_ios_permissions(filepath)
                if permissions:
                    print("权限列表:")
                    for perm in permissions:
                        print(f"  - {perm}")
            
            # 显示文件内容
            if show_content:
                self.print_file_content(filepath)
            
            print("-" * 60)

    def generate_summary_report(self):
        """生成权限配置摘要报告"""
        print("\n" + "=" * 60)
        print("权限配置摘要报告")
        print("=" * 60)

        # 统计Android权限
        android_manifest = self.project_root / 'android/app/src/main/AndroidManifest.xml'
        if android_manifest.exists():
            android_perms = self.analyze_android_permissions(str(android_manifest))
            print(f"\nAndroid权限 ({len(android_perms)}个):")
            for perm in android_perms:
                print(f"  ✓ {perm}")

        # 统计iOS权限
        ios_plist = self.project_root / 'ios/Runner/Info.plist'
        if ios_plist.exists():
            ios_perms = self.analyze_ios_permissions(str(ios_plist))
            print(f"\niOS权限 ({len(ios_perms)}个):")
            for perm in ios_perms:
                print(f"  ✓ {perm}")

        # 统计文件数量
        all_files = self.search_files()
        platforms = {}
        for platform, filename, filepath in all_files:
            if platform not in platforms:
                platforms[platform] = 0
            platforms[platform] += 1

        print(f"\n配置文件统计:")
        total = 0
        for platform, count in platforms.items():
            print(f"  {platform.upper()}: {count}个文件")
            total += count
        print(f"  总计: {total}个文件")

def main():
    """主函数"""
    # 获取项目根目录
    script_dir = Path(__file__).parent
    project_root = script_dir

    # 解析命令行参数
    keyword = ''
    show_content = False
    show_summary = False

    args = sys.argv[1:]
    for arg in args:
        if arg.lower() in ['--content', '-c']:
            show_content = True
        elif arg.lower() in ['--summary', '-s']:
            show_summary = True
        elif not arg.startswith('-'):
            keyword = arg

    # 创建搜索器
    searcher = AuthFileSearcher(str(project_root))

    print("Flutter Bloom 权限配置文件搜索工具")
    print("=" * 60)

    if show_summary:
        searcher.generate_summary_report()
    else:
        if keyword:
            print(f"搜索关键词: {keyword}")
        else:
            print("显示所有权限配置文件")

        # 执行搜索
        searcher.search_and_display(keyword, show_content)

    print("\n使用说明:")
    print("python search_auth_files.py [关键词] [选项]")
    print("  关键词: 文件名搜索关键词 (可选)")
    print("  选项:")
    print("    --content, -c: 显示文件内容")
    print("    --summary, -s: 显示权限摘要报告")
    print("\n示例:")
    print("  python search_auth_files.py AndroidManifest")
    print("  python search_auth_files.py Info.plist --content")
    print("  python search_auth_files.py build.gradle")
    print("  python search_auth_files.py --summary")

if __name__ == '__main__':
    main()
