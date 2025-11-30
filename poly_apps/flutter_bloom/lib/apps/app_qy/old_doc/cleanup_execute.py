#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
代码清理执行脚本
根据分析报告执行文件清理操作
"""

import os
import sys
import json
import shutil
from pathlib import Path
from datetime import datetime

# 设置输出编码为 UTF-8
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

class CodeCleanupExecutor:
    def __init__(self, base_path, report_path, dry_run=True):
        self.base_path = Path(base_path)
        self.report_path = Path(report_path)
        self.dry_run = dry_run
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "dry_run": dry_run,
            "actions": [],
            "summary": {
                "refactored_renamed": 0,
                "originals_deleted": 0,
                "backups_deleted": 0,
                "errors": 0
            }
        }

        # 加载分析报告
        with open(self.report_path, 'r', encoding='utf-8') as f:
            self.report = json.load(f)

    def cleanup_refactored_files(self):
        """清理 refactored 文件"""
        print("\n" + "="*80)
        print("处理 Refactored 文件")
        print("="*80 + "\n")

        for rec in self.report["recommendations"]:
            if rec["type"] == "refactored_with_original":
                print(f"[步骤 1] 处理有对应原始文件的 refactored 文件 ({rec['count']} 个)")
                for file_info in rec["files"]:
                    self._process_refactored_with_original(file_info)

            elif rec["type"] == "refactored_without_original":
                print(f"\n[步骤 2] 处理没有对应原始文件的 refactored 文件 ({rec['count']} 个)")
                for file_info in rec["files"]:
                    self._process_refactored_without_original(file_info)

    def _process_refactored_with_original(self, file_info):
        """处理有对应原始文件的 refactored 文件"""
        refactored_path = self.base_path / file_info["refactored"]
        original_path = self.base_path / file_info["original"]

        try:
            action = {
                "type": "refactored_with_original",
                "refactored": str(refactored_path),
                "original": str(original_path),
                "steps": []
            }

            # 步骤 1: 删除原始文件
            if original_path.exists():
                if self.dry_run:
                    print(f"  [DRY-RUN] 将删除: {original_path.name}")
                    action["steps"].append(f"删除原始文件: {original_path.name}")
                else:
                    original_path.unlink()
                    print(f"  ✓ 已删除: {original_path.name}")
                    action["steps"].append(f"已删除原始文件: {original_path.name}")
                    self.results["summary"]["originals_deleted"] += 1

            # 步骤 2: 重命名 refactored 文件
            new_name = str(refactored_path).replace("_refactored_app_qy.dart", "_app_qy.dart")
            new_path = Path(new_name)

            if self.dry_run:
                print(f"  [DRY-RUN] 将重命名: {refactored_path.name} -> {new_path.name}")
                action["steps"].append(f"重命名: {refactored_path.name} -> {new_path.name}")
            else:
                refactored_path.rename(new_path)
                print(f"  ✓ 已重命名: {new_path.name}")
                action["steps"].append(f"已重命名: {new_path.name}")
                self.results["summary"]["refactored_renamed"] += 1

            action["status"] = "success" if not self.dry_run else "dry_run"
            self.results["actions"].append(action)

        except Exception as e:
            print(f"  ✗ 错误: {str(e)}")
            action["status"] = "error"
            action["error"] = str(e)
            self.results["actions"].append(action)
            self.results["summary"]["errors"] += 1

    def _process_refactored_without_original(self, file_info):
        """处理没有对应原始文件的 refactored 文件"""
        refactored_path = self.base_path / file_info["refactored"]

        try:
            action = {
                "type": "refactored_without_original",
                "refactored": str(refactored_path),
                "steps": []
            }

            # 重命名文件（移除 _refactored 后缀）
            new_name = str(refactored_path).replace("_refactored_app_qy.dart", "_app_qy.dart")
            new_path = Path(new_name)

            if self.dry_run:
                print(f"  [DRY-RUN] 将重命名: {refactored_path.name} -> {new_path.name}")
                action["steps"].append(f"重命名: {refactored_path.name} -> {new_path.name}")
            else:
                refactored_path.rename(new_path)
                print(f"  ✓ 已重命名: {new_path.name}")
                action["steps"].append(f"已重命名: {new_path.name}")
                self.results["summary"]["refactored_renamed"] += 1

            action["status"] = "success" if not self.dry_run else "dry_run"
            self.results["actions"].append(action)

        except Exception as e:
            print(f"  ✗ 错误: {str(e)}")
            action["status"] = "error"
            action["error"] = str(e)
            self.results["actions"].append(action)
            self.results["summary"]["errors"] += 1

    def cleanup_backup_files(self):
        """清理备份文件"""
        print("\n" + "="*80)
        print("处理备份文件")
        print("="*80 + "\n")

        for rec in self.report["recommendations"]:
            if rec["type"] == "backup_with_original":
                print(f"[步骤 3] 删除备份文件 ({rec['count']} 个)")
                for file_info in rec["files"]:
                    self._process_backup_file(file_info)

    def _process_backup_file(self, file_info):
        """处理备份文件"""
        # 需要找到备份文件的绝对路径
        backup_relative = file_info["backup"]

        # 尝试在不同的基础路径中查找
        possible_bases = [
            self.base_path.parent.parent.parent / "assets" / "apps",
            self.base_path.parent.parent.parent / "assets" / "common",
            self.base_path.parent.parent.parent / "assets",
            self.base_path
        ]

        backup_path = None
        for base in possible_bases:
            potential_path = base / backup_relative
            if potential_path.exists():
                backup_path = potential_path
                break

        if not backup_path:
            # 尝试直接使用相对路径
            try:
                direct_path = Path(backup_relative)
                if direct_path.exists():
                    backup_path = direct_path
            except:
                pass

        if not backup_path:
            print(f"  ⚠ 跳过（未找到）: {backup_relative}")
            return

        try:
            action = {
                "type": "backup_file",
                "backup": str(backup_path),
                "steps": []
            }

            if self.dry_run:
                print(f"  [DRY-RUN] 将删除: {backup_path.name}")
                action["steps"].append(f"删除备份: {backup_path.name}")
            else:
                backup_path.unlink()
                print(f"  ✓ 已删除: {backup_path.name}")
                action["steps"].append(f"已删除备份: {backup_path.name}")
                self.results["summary"]["backups_deleted"] += 1

            action["status"] = "success" if not self.dry_run else "dry_run"
            self.results["actions"].append(action)

        except Exception as e:
            print(f"  ✗ 错误: {str(e)}")
            action["status"] = "error"
            action["error"] = str(e)
            self.results["actions"].append(action)
            self.results["summary"]["errors"] += 1

    def save_results(self):
        """保存执行结果"""
        mode = "DRY_RUN" if self.dry_run else "ACTUAL"
        result_path = self.base_path / f"CLEANUP_RESULTS_{mode}.json"

        with open(result_path, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)

        print(f"\n💾 执行结果已保存到: {result_path}")
        return result_path

    def print_summary(self):
        """打印摘要"""
        mode = "[模拟运行]" if self.dry_run else "[实际执行]"
        print("\n" + "="*80)
        print(f"清理摘要 {mode}")
        print("="*80)
        print(f"  • Refactored 文件重命名: {self.results['summary']['refactored_renamed']} 个")
        print(f"  • 原始文件删除: {self.results['summary']['originals_deleted']} 个")
        print(f"  • 备份文件删除: {self.results['summary']['backups_deleted']} 个")
        print(f"  • 错误: {self.results['summary']['errors']} 个")
        print("="*80 + "\n")

    def execute(self):
        """执行清理"""
        mode = "模拟运行" if self.dry_run else "实际执行"
        print(f"\n🚀 开始清理代码 ({mode})...\n")

        self.cleanup_refactored_files()
        self.cleanup_backup_files()
        self.save_results()
        self.print_summary()

        if self.dry_run:
            print("ℹ️  这是模拟运行，没有实际修改文件。")
            print("如需实际执行，请使用参数: --execute")
        else:
            print("✅ 清理完成！")

def main():
    import argparse

    parser = argparse.ArgumentParser(description='执行代码清理操作')
    parser.add_argument('--execute', action='store_true', help='实际执行（默认为模拟运行）')
    args = parser.parse_args()

    base_path = Path(__file__).parent
    report_path = base_path / "CLEANUP_REPORT.json"

    if not report_path.exists():
        print("❌ 错误: 未找到分析报告文件")
        print("请先运行 cleanup_analysis.py 生成报告")
        return 1

    executor = CodeCleanupExecutor(base_path, report_path, dry_run=not args.execute)
    executor.execute()

    return 0

if __name__ == "__main__":
    sys.exit(main())
