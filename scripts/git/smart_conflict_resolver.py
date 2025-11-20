#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
智能Git冲突解决工具 v2.0
全新版本，支持智能分析、预览和一键解决Git合并冲突
作者: AI Assistant
创建时间: 2025-01-10
"""

import os
import re
import shutil
import datetime
import json
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import argparse
import sys
from dataclasses import dataclass
from enum import Enum

class ConflictStrategy(Enum):
    """冲突解决策略"""
    LOCAL = "local"
    REMOTE = "remote"
    SMART = "smart"

@dataclass
class ConflictInfo:
    """冲突信息数据类"""
    start_line: int
    end_line: int
    separator_line: int
    local_branch: str
    remote_branch: str
    local_content: str
    remote_content: str
    file_path: Path
    conflict_id: str

class SmartConflictResolver:
    """智能Git冲突解决器"""
    
    def __init__(self, base_path: str = "../../", backup_dir: str = "../../tmp/git_merge"):
        self.base_path = Path(base_path).resolve()
        self.backup_dir = Path(backup_dir).resolve()
        self.script_path = Path(__file__).resolve()
        
        # 代码文件扩展名 - 更全面的支持
        self.code_extensions = {
            # 编程语言
            '.py', '.js', '.ts', '.jsx', '.tsx', '.vue', '.java', '.cpp', '.c', '.h', '.hpp',
            '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala', '.dart', '.r',
            '.m', '.mm', '.pl', '.lua', '.jl', '.clj', '.hs', '.elm', '.ex', '.exs',
            # 脚本和配置
            '.sh', '.bat', '.ps1', '.cmd', '.sql', '.html', '.css', '.scss', '.less',
            '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
            # 文档和其他
            '.md', '.txt', '.rst', '.tex', '.lock', '.gitignore', '.env', '.dockerfile',
            '.makefile', '.cmake', '.gradle', '.maven', '.sbt'
        }
        
        # 跳过的目录 - 更智能的过滤
        self.skip_dirs = {
            'node_modules', '.git', '__pycache__', '.vscode', '.idea', '.vs',
            'dist', 'build', 'target', 'bin', 'obj', '.next', '.nuxt',
            'coverage', '.nyc_output', 'logs', 'tmp', 'temp', '.cache',
            'vendor', 'packages', '.gradle', '.maven', 'bower_components'
        }
        
        # Git冲突标识符的正则表达式
        self.conflict_patterns = {
            'start': re.compile(r'^<{7}\s*(.*)$'),
            'separator': re.compile(r'^={7}$'),
            'end': re.compile(r'^>{7}\s*(.*)$')
        }
        
        # 统计信息
        self.stats = {
            'scanned_files': 0,
            'conflict_files': 0,
            'resolved_files': 0,
            'backup_files': 0,
            'skipped_files': 0,
            'errors': 0,
            'total_conflicts': 0
        }
        
        # 智能分析缓存
        self.analysis_cache = {}

    def setup_environment(self):
        """设置运行环境"""
        # 创建备份目录
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        
        # 创建会话记录文件
        session_id = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        self.session_file = self.backup_dir / f"session_{session_id}.json"
        
        session_info = {
            'session_id': session_id,
            'start_time': datetime.datetime.now().isoformat(),
            'base_path': str(self.base_path),
            'backup_dir': str(self.backup_dir),
            'resolved_files': [],
            'stats': self.stats.copy()
        }
        
        with open(self.session_file, 'w', encoding='utf-8') as f:
            json.dump(session_info, f, indent=2, ensure_ascii=False)

    def is_valid_code_file(self, file_path: Path) -> bool:
        """判断是否为有效的代码文件"""
        if not file_path.is_file():
            return False
            
        # 检查扩展名
        if file_path.suffix.lower() not in self.code_extensions:
            return False
            
        # 跳过脚本自身
        if file_path.resolve() == self.script_path:
            return False
            
        # 跳过备份目录中的文件
        try:
            file_path.resolve().relative_to(self.backup_dir)
            return False
        except ValueError:
            pass
            
        # 检查文件大小（跳过过大的文件，可能是二进制文件）
        try:
            if file_path.stat().st_size > 10 * 1024 * 1024:  # 10MB
                return False
        except OSError:
            return False
            
        return True

    def should_skip_directory(self, dir_path: Path) -> bool:
        """判断是否应该跳过目录"""
        dir_name = dir_path.name.lower()
        
        # 检查是否在跳过列表中
        if dir_name in self.skip_dirs:
            return True
            
        # 跳过隐藏目录（以.开头）
        if dir_name.startswith('.') and dir_name not in {'.github', '.vscode'}:
            return True
            
        # 跳过备份目录
        try:
            dir_path.resolve().relative_to(self.backup_dir)
            return True
        except ValueError:
            pass
            
        return False

    def scan_for_conflicts(self) -> List[Path]:
        """扫描包含冲突的文件"""
        print(f"🔍 开始扫描路径: {self.base_path}")
        conflict_files = []
        
        def scan_directory(directory: Path, depth: int = 0):
            if depth > 10:  # 防止过深的递归
                return
                
            try:
                for item in directory.iterdir():
                    if item.is_dir():
                        if not self.should_skip_directory(item):
                            scan_directory(item, depth + 1)
                    elif item.is_file():
                        if self.is_valid_code_file(item):
                            self.stats['scanned_files'] += 1
                            if self.has_git_conflicts(item):
                                conflict_files.append(item)
                                self.stats['conflict_files'] += 1
                                
            except (PermissionError, OSError) as e:
                print(f"⚠️  跳过目录 {directory}: {e}")
                self.stats['errors'] += 1
        
        scan_directory(self.base_path)
        
        print(f"📊 扫描完成:")
        print(f"  📁 扫描文件: {self.stats['scanned_files']}")
        print(f"  🔥 冲突文件: {self.stats['conflict_files']}")
        
        return conflict_files

    def has_git_conflicts(self, file_path: Path) -> bool:
        """快速检查文件是否包含Git冲突标记"""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                return ('<<<<<<<' in content and 
                       '=======' in content and 
                       '>>>>>>>' in content)
        except Exception:
            self.stats['errors'] += 1
            return False

    def parse_conflicts(self, file_path: Path) -> List[ConflictInfo]:
        """解析文件中的所有冲突"""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
        except Exception as e:
            print(f"❌ 读取文件失败 {file_path}: {e}")
            self.stats['errors'] += 1
            return []
        
        conflicts = []
        i = 0
        conflict_counter = 0
        
        while i < len(lines):
            line = lines[i].rstrip()
            
            # 检测冲突开始
            start_match = self.conflict_patterns['start'].match(line)
            if start_match:
                conflict_counter += 1
                start_line = i
                local_branch = start_match.group(1).strip() or "HEAD"
                
                # 查找分隔符
                separator_line = None
                for j in range(i + 1, len(lines)):
                    if self.conflict_patterns['separator'].match(lines[j].rstrip()):
                        separator_line = j
                        break
                
                if separator_line is None:
                    i += 1
                    continue
                
                # 查找结束标记
                end_line = None
                remote_branch = ""
                for j in range(separator_line + 1, len(lines)):
                    end_match = self.conflict_patterns['end'].match(lines[j].rstrip())
                    if end_match:
                        end_line = j
                        remote_branch = end_match.group(1).strip() or "REMOTE"
                        break
                
                if end_line is None:
                    i += 1
                    continue
                
                # 提取冲突内容
                local_content = ''.join(lines[start_line + 1:separator_line])
                remote_content = ''.join(lines[separator_line + 1:end_line])
                
                conflict_info = ConflictInfo(
                    start_line=start_line,
                    end_line=end_line,
                    separator_line=separator_line,
                    local_branch=local_branch,
                    remote_branch=remote_branch,
                    local_content=local_content,
                    remote_content=remote_content,
                    file_path=file_path,
                    conflict_id=f"{file_path.name}_{conflict_counter}"
                )
                
                conflicts.append(conflict_info)
                self.stats['total_conflicts'] += 1
                i = end_line + 1
            else:
                i += 1
        
        return conflicts

    def smart_analyze_conflict(self, conflict: ConflictInfo) -> ConflictStrategy:
        """智能分析冲突，推荐最佳解决策略"""
        local_lines = conflict.local_content.strip().split('\n')
        remote_lines = conflict.remote_content.strip().split('\n')

        # 如果一方为空，选择非空的一方
        if not conflict.local_content.strip():
            return ConflictStrategy.REMOTE
        if not conflict.remote_content.strip():
            return ConflictStrategy.LOCAL

        # 如果内容相同，选择本地（默认策略）
        if conflict.local_content.strip() == conflict.remote_content.strip():
            return ConflictStrategy.LOCAL

        # 简单的启发式规则
        local_len = len(local_lines)
        remote_len = len(remote_lines)

        # 如果远程版本明显更完整（行数多很多），推荐远程
        if remote_len > local_len * 1.5 and remote_len > 5:
            return ConflictStrategy.REMOTE

        # 默认推荐本地
        return ConflictStrategy.LOCAL

    def create_backup(self, file_path: Path) -> Path:
        """创建文件备份"""
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"{file_path.name}.{timestamp}.backup"
        backup_path = self.backup_dir / backup_name

        try:
            shutil.copy2(file_path, backup_path)
            self.stats['backup_files'] += 1

            # 记录到会话文件
            self.update_session_log('backup_created', {
                'original_file': str(file_path),
                'backup_file': str(backup_path),
                'timestamp': datetime.datetime.now().isoformat()
            })

            return backup_path
        except Exception as e:
            print(f"❌ 备份失败 {file_path}: {e}")
            self.stats['errors'] += 1
            raise

    def update_session_log(self, action: str, data: dict):
        """更新会话日志"""
        try:
            with open(self.session_file, 'r', encoding='utf-8') as f:
                session_data = json.load(f)

            if 'actions' not in session_data:
                session_data['actions'] = []

            session_data['actions'].append({
                'timestamp': datetime.datetime.now().isoformat(),
                'action': action,
                'data': data
            })

            session_data['stats'] = self.stats.copy()

            with open(self.session_file, 'w', encoding='utf-8') as f:
                json.dump(session_data, f, indent=2, ensure_ascii=False)
        except Exception:
            pass  # 日志记录失败不影响主要功能

    def preview_resolution(self, file_path: Path, conflicts: List[ConflictInfo],
                          strategy: ConflictStrategy = ConflictStrategy.LOCAL) -> str:
        """预览冲突解决后的文件内容"""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
        except Exception as e:
            return f"❌ 读取文件失败: {e}"

        # 从后往前处理冲突，避免行号变化
        for conflict in reversed(conflicts):
            if strategy == ConflictStrategy.LOCAL:
                replacement = conflict.local_content
            elif strategy == ConflictStrategy.REMOTE:
                replacement = conflict.remote_content
            else:  # SMART
                smart_strategy = self.smart_analyze_conflict(conflict)
                replacement = (conflict.local_content if smart_strategy == ConflictStrategy.LOCAL
                             else conflict.remote_content)

            # 替换冲突区域
            lines[conflict.start_line:conflict.end_line + 1] = [replacement]

        return ''.join(lines)

    def display_conflict_preview(self, conflict: ConflictInfo, index: int, total: int):
        """显示单个冲突的预览"""
        print(f"\n{'='*60}")
        print(f"🔥 冲突 {index}/{total} - {conflict.file_path.name}")
        print(f"📍 行号: {conflict.start_line + 1} - {conflict.end_line + 1}")
        print(f"🌿 本地分支: {conflict.local_branch}")
        print(f"🌐 远程分支: {conflict.remote_branch}")

        # 智能推荐
        recommended = self.smart_analyze_conflict(conflict)
        print(f"🤖 智能推荐: 保留{recommended.value}版本")

        print(f"\n📝 本地版本 ({conflict.local_branch}):")
        print("─" * 40)
        local_preview = conflict.local_content.strip()
        if len(local_preview) > 200:
            local_preview = local_preview[:200] + "..."
        print(local_preview or "(空内容)")

        print(f"\n📝 远程版本 ({conflict.remote_branch}):")
        print("─" * 40)
        remote_preview = conflict.remote_content.strip()
        if len(remote_preview) > 200:
            remote_preview = remote_preview[:200] + "..."
        print(remote_preview or "(空内容)")

    def resolve_file_conflicts(self, file_path: Path,
                             default_strategy: ConflictStrategy = ConflictStrategy.LOCAL,
                             interactive: bool = True) -> bool:
        """解决文件中的所有冲突"""
        conflicts = self.parse_conflicts(file_path)

        if not conflicts:
            return False

        print(f"\n📄 处理文件: {file_path}")
        print(f"🔥 发现 {len(conflicts)} 个冲突")

        if interactive:
            # 显示所有冲突预览
            for i, conflict in enumerate(conflicts, 1):
                self.display_conflict_preview(conflict, i, len(conflicts))

            # 预览整体解决效果
            preview_content = self.preview_resolution(file_path, conflicts, default_strategy)

            print(f"\n📋 整体预览 (策略: 保留{default_strategy.value}版本):")
            print("=" * 60)

            preview_lines = preview_content.split('\n')
            # 显示冲突附近的内容
            for conflict in conflicts:
                start_preview = max(0, conflict.start_line - 2)
                end_preview = min(len(preview_lines), conflict.start_line + 10)

                print(f"\n--- 冲突区域 {conflict.start_line + 1} 附近 ---")
                for i in range(start_preview, end_preview):
                    marker = ">>> " if i == conflict.start_line else "    "
                    print(f"{marker}{i+1:3d}: {preview_lines[i].rstrip()}")

            print("=" * 60)

            # 用户确认
            while True:
                choice = input(f"\n选择操作:\n"
                             f"  Y/y - 应用解决方案\n"
                             f"  N/n - 跳过此文件\n"
                             f"  L/l - 切换到本地版本\n"
                             f"  R/r - 切换到远程版本\n"
                             f"  S/s - 使用智能推荐\n"
                             f"请选择: ").strip().lower()

                if choice in ['y', 'yes']:
                    break
                elif choice in ['n', 'no']:
                    print("⏭️  跳过此文件")
                    self.stats['skipped_files'] += 1
                    return False
                elif choice in ['l', 'local']:
                    default_strategy = ConflictStrategy.LOCAL
                    preview_content = self.preview_resolution(file_path, conflicts, default_strategy)
                    print(f"🔄 已切换到本地版本策略")
                elif choice in ['r', 'remote']:
                    default_strategy = ConflictStrategy.REMOTE
                    preview_content = self.preview_resolution(file_path, conflicts, default_strategy)
                    print(f"🔄 已切换到远程版本策略")
                elif choice in ['s', 'smart']:
                    default_strategy = ConflictStrategy.SMART
                    preview_content = self.preview_resolution(file_path, conflicts, default_strategy)
                    print(f"🔄 已切换到智能推荐策略")
                else:
                    print("❌ 无效选择，请重新输入")
                    continue

        # 执行解决方案
        try:
            # 创建备份
            backup_path = self.create_backup(file_path)
            print(f"💾 已备份到: {backup_path}")

            # 应用解决方案
            resolved_content = self.preview_resolution(file_path, conflicts, default_strategy)

            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(resolved_content)

            print(f"✅ 已解决冲突: {file_path}")
            self.stats['resolved_files'] += 1

            # 记录到会话日志
            self.update_session_log('conflict_resolved', {
                'file_path': str(file_path),
                'conflicts_count': len(conflicts),
                'strategy': default_strategy.value,
                'backup_path': str(backup_path)
            })

            return True

        except Exception as e:
            print(f"❌ 解决冲突失败: {e}")
            self.stats['errors'] += 1
            return False

    def run(self, strategy: ConflictStrategy = ConflictStrategy.LOCAL,
            interactive: bool = True):
        """运行智能冲突解决器"""
        print("🚀 智能Git冲突解决工具 v2.0")
        print(f"📂 扫描路径: {self.base_path}")
        print(f"💾 备份目录: {self.backup_dir}")
        print(f"⚙️  默认策略: {strategy.value}")
        print(f"🤖 交互模式: {'开启' if interactive else '关闭'}")

        # 设置环境
        self.setup_environment()

        # 扫描冲突文件
        conflict_files = self.scan_for_conflicts()

        if not conflict_files:
            print("✅ 恭喜！未发现任何Git冲突")
            return

        print(f"\n🔥 发现冲突文件列表:")
        for i, file_path in enumerate(conflict_files, 1):
            conflicts = self.parse_conflicts(file_path)
            print(f"  {i:2d}. {file_path} ({len(conflicts)} 个冲突)")

        if interactive:
            print(f"\n开始逐个处理冲突文件...")

            for i, file_path in enumerate(conflict_files, 1):
                print(f"\n{'='*80}")
                print(f"📋 进度: {i}/{len(conflict_files)}")

                try:
                    _ = self.resolve_file_conflicts(file_path, strategy, interactive)
                except KeyboardInterrupt:
                    print("\n⏹️  用户中断操作")
                    break
                except Exception as e:
                    print(f"❌ 处理文件时出错: {e}")
                    self.stats['errors'] += 1
                    continue
        else:
            # 非交互模式，批量处理
            print(f"\n🤖 自动处理模式，使用策略: {strategy.value}")

            for file_path in conflict_files:
                try:
                    _ = self.resolve_file_conflicts(file_path, strategy, False)
                except Exception as e:
                    print(f"❌ 处理文件时出错 {file_path}: {e}")
                    self.stats['errors'] += 1

        # 显示最终统计
        self.display_final_stats()

    def display_final_stats(self):
        """显示最终统计信息"""
        print(f"\n{'='*80}")
        print("📊 处理完成统计报告")
        print(f"{'='*80}")
        print(f"📁 扫描文件数: {self.stats['scanned_files']}")
        print(f"🔥 冲突文件数: {self.stats['conflict_files']}")
        print(f"⚡ 冲突总数: {self.stats['total_conflicts']}")
        print(f"✅ 已解决文件: {self.stats['resolved_files']}")
        print(f"⏭️  跳过文件数: {self.stats['skipped_files']}")
        print(f"💾 备份文件数: {self.stats['backup_files']}")
        print(f"❌ 错误数量: {self.stats['errors']}")

        success_rate = (self.stats['resolved_files'] / max(1, self.stats['conflict_files'])) * 100
        print(f"🎯 解决成功率: {success_rate:.1f}%")

        if self.stats['backup_files'] > 0:
            print(f"\n💾 备份文件位置: {self.backup_dir}")
            print(f"📋 会话记录: {self.session_file}")

        if self.stats['resolved_files'] > 0:
            print(f"\n🎉 成功解决了 {self.stats['resolved_files']} 个文件的冲突！")
            print("💡 建议接下来:")
            print("   1. 检查解决后的文件内容")
            print("   2. 运行测试确保功能正常")
            print("   3. 提交更改: git add . && git commit")


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description='智能Git冲突解决工具 v2.0',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  python smart_conflict_resolver.py                    # 交互模式，默认保留本地
  python smart_conflict_resolver.py --strategy remote  # 交互模式，默认保留远程
  python smart_conflict_resolver.py --strategy smart   # 交互模式，智能推荐
  python smart_conflict_resolver.py --auto             # 自动模式，保留本地
  python smart_conflict_resolver.py --path ../         # 指定扫描路径
        """
    )

    parser.add_argument('--path', '-p', default='../../',
                       help='扫描路径 (默认: ../../)')
    parser.add_argument('--backup-dir', '-b', default='../../tmp/git_merge',
                       help='备份目录 (默认: ../../tmp/git_merge)')
    parser.add_argument('--strategy', '-s',
                       choices=['local', 'remote', 'smart'],
                       default='local',
                       help='冲突解决策略 (默认: local)')
    parser.add_argument('--auto', '-a', action='store_true',
                       help='自动模式，不询问用户确认')
    parser.add_argument('--version', '-v', action='version',
                       version='智能Git冲突解决工具 v2.0')

    args = parser.parse_args()

    # 转换策略参数
    strategy_map = {
        'local': ConflictStrategy.LOCAL,
        'remote': ConflictStrategy.REMOTE,
        'smart': ConflictStrategy.SMART
    }
    strategy = strategy_map[args.strategy]

    try:
        resolver = SmartConflictResolver(
            base_path=args.path,
            backup_dir=args.backup_dir
        )

        resolver.run(
            strategy=strategy,
            interactive=not args.auto
        )

    except KeyboardInterrupt:
        print("\n⏹️  程序被用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"❌ 程序运行出错: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
