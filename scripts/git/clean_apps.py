# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

import os
import shutil
import sys

# 配置参数
APPS_ROOT = r"D:\programing\core_node\apps"
SKIPPED_FILES = 0
RED = "\033[31m"
RESET = "\033[0m"

def enable_vt_mode():
    """启用Windows虚拟终端支持"""
    if sys.platform == "win32":
        import ctypes
        kernel32 = ctypes.WinDLL('kernel32')
        hStdOut = kernel32.GetStdHandle(-11)
        mode = ctypes.c_ulong()
        kernel32.GetConsoleMode(hStdOut, ctypes.byref(mode))
        mode.value |= 4
        kernel32.SetConsoleMode(hStdOut, mode)

def print_progress():
    """在同一行更新跳过文件数"""
    sys.stdout.write(f"\rSkipped files: {SKIPPED_FILES}")
    sys.stdout.flush()

def delete_git_dirs(root_dir):
    """递归删除.git目录"""
    for root, dirs, _ in os.walk(root_dir, topdown=True):
        if '.git' in dirs:
            git_dir = os.path.join(root, '.git')
            try:
                shutil.rmtree(git_dir)
                print(f"Deleted: {git_dir}")
            except Exception as e:
                print(f"{RED}Error deleting {git_dir}: {e}{RESET}")
            dirs.remove('.git')

def check_large_files(root_dir):
    """检查并打印大于1MB的文件"""
    global SKIPPED_FILES
    for root, _, files in os.walk(root_dir):
        for file in files:
            path = os.path.join(root, file)
            try:
                size = os.path.getsize(path)
                if size > 1024*1024:  # 1MB
                    print(f"Large file: {path} ({size//1024//1024}MB)")
            except Exception as e:
                SKIPPED_FILES += 1
                print_progress()
                print(f"\n{RED}Error accessing {path}: {e}{RESET}")

if __name__ == "__main__":
    enable_vt_mode()
    print("Cleaning .git directories...")
    delete_git_dirs(APPS_ROOT)
    print("\nChecking large files...")
    check_large_files(APPS_ROOT)
    print(f"\n\nTotal skipped files: {SKIPPED_FILES}") 