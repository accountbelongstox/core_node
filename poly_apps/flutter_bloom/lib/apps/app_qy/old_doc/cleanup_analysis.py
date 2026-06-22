#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
代码清理分析脚本
分析重复文件和备份文件，生成清理建议
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime

# 设置输出编码为 UTF-8
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

class CodeCleanupAnalyzer:
    def __init__(self, base_path):
        self.base_path = Path(base_path)
        self.refactored_files = []
        self.backup_files = []
        self.original_files = []
        self.cleanup_report = {
            "timestamp": datetime.now().isoformat(),
            "refactored_files": [],
            "backup_files": [],
            "recommendations": []
        }

    def find_refactored_files(self):
        """查找所有 refactored 文件"""
        print("🔍 扫描 refactored 文件...")
        for file in self.base_path.rglob("*_refactored_app_qy.dart"):
            self.refactored_files.append(file)

            # 检查是否存在对应的原始文件
            original_name = str(file).replace("_refactored_app_qy.dart", "_app_qy.dart")
            original_path = Path(original_name)

            exists = original_path.exists()
            self.cleanup_report["refactored_files"].append({
                "refactored": str(file.relative_to(self.base_path)),
                "original": str(original_path.relative_to(self.base_path)) if exists else None,
                "has_original": exists,
                "size_kb": round(file.stat().st_size / 1024, 2)
            })

        print(f"✅ 找到 {len(self.refactored_files)} 个 refactored 文件")

    def find_backup_files(self):
        """查找所有备份文件"""
        print("🔍 扫描备份文件...")

        # 在多个目录中查找备份文件
        search_paths = [
            self.base_path,
            self.base_path.parent.parent.parent / "assets" / "apps" / "app_qy",
            self.base_path.parent.parent.parent / "assets" / "common"
        ]

        for search_path in search_paths:
            if not search_path.exists():
                continue

            for file in search_path.rglob("*.backup.*"):
                self.backup_files.append(file)

                # 检查是否存在对应的原始文件
                original_name = str(file).replace(".backup.", ".")
                original_path = Path(original_name)

                exists = original_path.exists()
                self.cleanup_report["backup_files"].append({
                    "backup": str(file.relative_to(search_path.parent)),
                    "original": str(original_path.relative_to(search_path.parent)) if exists else None,
                    "has_original": exists,
                    "size_kb": round(file.stat().st_size / 1024, 2)
                })

        print(f"✅ 找到 {len(self.backup_files)} 个备份文件")

    def generate_recommendations(self):
        """生成清理建议"""
        print("\n📊 生成清理建议...")

        # 策略 1: Refactored 文件处理
        refactored_with_original = [f for f in self.cleanup_report["refactored_files"] if f["has_original"]]
        refactored_without_original = [f for f in self.cleanup_report["refactored_files"] if not f["has_original"]]

        if refactored_with_original:
            self.cleanup_report["recommendations"].append({
                "type": "refactored_with_original",
                "count": len(refactored_with_original),
                "action": "删除旧的原始文件，将 refactored 版本重命名为原始名称",
                "reason": "refactored 版本是新的改进版本，应该替代旧版本",
                "files": refactored_with_original
            })

        if refactored_without_original:
            self.cleanup_report["recommendations"].append({
                "type": "refactored_without_original",
                "count": len(refactored_without_original),
                "action": "将 refactored 文件重命名为标准名称（移除 _refactored 后缀）",
                "reason": "这些文件没有对应的旧版本，可以直接使用标准命名",
                "files": refactored_without_original
            })

        # 策略 2: 备份文件处理
        backup_with_original = [f for f in self.cleanup_report["backup_files"] if f["has_original"]]
        backup_without_original = [f for f in self.cleanup_report["backup_files"] if not f["has_original"]]

        if backup_with_original:
            self.cleanup_report["recommendations"].append({
                "type": "backup_with_original",
                "count": len(backup_with_original),
                "action": "删除备份文件（原始文件存在）",
                "reason": "原始文件已存在，备份文件可以安全删除",
                "files": backup_with_original
            })

        if backup_without_original:
            self.cleanup_report["recommendations"].append({
                "type": "backup_without_original",
                "count": len(backup_without_original),
                "action": "警告：这些备份文件没有对应的原始文件，需要手动检查",
                "reason": "可能原始文件已被删除或重命名",
                "files": backup_without_original
            })

        # 统计信息
        total_refactored = len(self.cleanup_report["refactored_files"])
        total_backup = len(self.cleanup_report["backup_files"])

        print(f"\n📈 统计信息:")
        print(f"   - Refactored 文件: {total_refactored} 个")
        print(f"     • 有对应原始文件: {len(refactored_with_original)} 个")
        print(f"     • 无对应原始文件: {len(refactored_without_original)} 个")
        print(f"   - 备份文件: {total_backup} 个")
        print(f"     • 有对应原始文件: {len(backup_with_original)} 个")
        print(f"     • 无对应原始文件: {len(backup_without_original)} 个")

    def save_report(self):
        """保存报告"""
        report_path = self.base_path / "CLEANUP_REPORT.json"
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(self.cleanup_report, f, indent=2, ensure_ascii=False)

        print(f"\n💾 报告已保存到: {report_path}")
        return report_path

    def print_summary(self):
        """打印摘要"""
        print("\n" + "="*80)
        print("📋 清理建议摘要")
        print("="*80)

        for rec in self.cleanup_report["recommendations"]:
            print(f"\n【{rec['type']}】")
            print(f"  数量: {rec['count']} 个")
            print(f"  操作: {rec['action']}")
            print(f"  原因: {rec['reason']}")

        print("\n" + "="*80)

def main():
    base_path = Path(__file__).parent
    analyzer = CodeCleanupAnalyzer(base_path)

    print("🚀 开始分析代码清理需求...\n")

    analyzer.find_refactored_files()
    analyzer.find_backup_files()
    analyzer.generate_recommendations()
    analyzer.save_report()
    analyzer.print_summary()

    print("\n✅ 分析完成！")

if __name__ == "__main__":
    main()
