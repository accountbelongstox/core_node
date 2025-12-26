#!/usr/bin/env python3
"""
Remove all try-catch blocks from TypeScript files
让错误自然显现，便于调试
"""

import re
import sys
from pathlib import Path

def remove_try_catch(content: str) -> str:
    """
    Remove try-catch-finally blocks from TypeScript code
    """
    lines = content.split('\n')
    result = []
    skip_until_bracket = 0
    indent_stack = []

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # 检测 try { 开始
        if stripped.startswith('try {'):
            # 记录 try 之前的缩进
            indent = len(line) - len(line.lstrip())
            result.append(f"{' ' * indent}// ✅ REMOVED try-catch for debugging - let errors surface naturally")
            i += 1
            continue

        # 检测 } catch (
        if '} catch (' in stripped or stripped.startswith('catch ('):
            # 跳过 catch 块直到对应的 }
            bracket_count = 0
            found_open = False
            while i < len(lines):
                if '{' in lines[i]:
                    found_open = True
                    bracket_count += lines[i].count('{')
                bracket_count -= lines[i].count('}')
                i += 1
                if found_open and bracket_count == 0:
                    break
            continue

        # 检测 } finally {
        if '} finally {' in stripped or stripped.startswith('finally {'):
            # 移除 finally {
            indent = len(line) - len(line.lstrip())
            i += 1
            # 处理 finally 块内容，去掉一级缩进
            while i < len(lines):
                finally_line = lines[i]
                if finally_line.strip() == '}' and len(finally_line) - len(finally_line.lstrip()) == indent:
                    i += 1
                    break
                # 去掉一级缩进
                if len(finally_line) > indent + 2:
                    result.append(finally_line[2:])
                else:
                    result.append(finally_line)
                i += 1
            continue

        result.append(line)
        i += 1

    return '\n'.join(result)

def process_file(file_path: Path):
    """Process a single file"""
    print(f"Processing: {file_path}")

    content = file_path.read_text(encoding='utf-8')

    # 检查是否有 try-catch
    if 'try {' not in content and 'catch (' not in content:
        print(f"  [OK] No try-catch found")
        return

    new_content = remove_try_catch(content)

    file_path.write_text(new_content, encoding='utf-8')
    print(f"  [OK] Removed try-catch blocks")

def main():
    base_path = Path(__file__).parent.parent / 'poly_apps' / 'nuxt_main'

    # 处理 composables
    composables_path = base_path / 'apps' / 'app_pymatrix' / 'composables_app_pymatrix'
    print(f"\n=== Processing composables ===")
    for ts_file in composables_path.glob('*.ts'):
        process_file(ts_file)

    # 处理 API services
    api_path = base_path / 'services' / 'api' / 'pymatrix'
    print(f"\n=== Processing API services ===")
    for ts_file in api_path.glob('*.ts'):
        process_file(ts_file)

    # 处理 stores
    stores_path = base_path / 'apps' / 'app_pymatrix' / 'stores_app_pymatrix'
    print(f"\n=== Processing stores ===")
    for ts_file in stores_path.glob('*.ts'):
        process_file(ts_file)

    print(f"\n✅ All done!")

if __name__ == '__main__':
    main()
