#!/usr/bin/env python3
import os
import json
import hashlib
from pathlib import Path

def get_file_hash(filepath):
    """计算文件的MD5哈希值"""
    try:
        with open(filepath, 'rb') as f:
            return hashlib.md5(f.read()).hexdigest()
    except:
        return None

def get_file_size(filepath):
    """获取文件大小"""
    try:
        return os.path.getsize(filepath)
    except:
        return 0

def compare_files_content(file1, file2):
    """比较两个文件的内容"""
    try:
        with open(file1, 'r', encoding='utf-8') as f1:
            content1 = f1.read()
        with open(file2, 'r', encoding='utf-8') as f2:
            content2 = f2.read()

        if content1 == content2:
            return "identical", None
        else:
            # 检查哪个文件更大/更完整
            lines1 = content1.count('\n')
            lines2 = content2.count('\n')
            size1 = len(content1)
            size2 = len(content2)

            diff_info = {
                "root_lines": lines1,
                "app_lines": lines2,
                "root_size": size1,
                "app_size": size2,
                "line_diff": lines2 - lines1,
                "size_diff": size2 - size1
            }

            if lines1 > lines2 or size1 > size2:
                return "root_more_complete", diff_info
            elif lines2 > lines1 or size2 > size1:
                return "app_more_complete", diff_info
            else:
                return "different_content", diff_info
    except Exception as e:
        return "error", str(e)

def main():
    base_dir = Path(r"D:\programing\core_node\poly_apps\laravel_main")
    root_apps = base_dir / "Apps"
    app_apps = base_dir / "app" / "Apps"

    apps_list = ["AChatV1", "AwyV0", "BankV1", "DictV1", "ItToolsV1", "ServerManagerV1"]

    report = {
        "summary": {
            "total_apps": len(apps_list),
            "apps_compared": 0,
            "identical_files": 0,
            "different_files": 0,
            "root_only_files": 0,
            "app_only_files": 0
        },
        "apps": {}
    }

    for app_name in apps_list:
        print(f"Comparing {app_name}...", file=__import__('sys').stderr)

        root_app_dir = root_apps / app_name
        app_app_dir = app_apps / app_name

        app_report = {
            "app_name": app_name,
            "root_exists": root_app_dir.exists(),
            "app_exists": app_app_dir.exists(),
            "files": {},
            "summary": {
                "identical": 0,
                "different": 0,
                "root_only": 0,
                "app_only": 0,
                "needs_merge": 0,
                "safe_to_delete_root": True
            }
        }

        if not root_app_dir.exists():
            app_report["note"] = "Root Apps directory does not exist"
            report["apps"][app_name] = app_report
            continue

        if not app_app_dir.exists():
            app_report["note"] = "app/Apps directory does not exist"
            app_report["summary"]["safe_to_delete_root"] = False
            report["apps"][app_name] = app_report
            continue

        # 收集所有PHP文件
        root_files = set()
        app_files = set()

        for root, dirs, files in os.walk(root_app_dir):
            for file in files:
                if file.endswith('.php'):
                    rel_path = os.path.relpath(os.path.join(root, file), root_app_dir)
                    root_files.add(rel_path)

        for root, dirs, files in os.walk(app_app_dir):
            for file in files:
                if file.endswith('.php'):
                    rel_path = os.path.relpath(os.path.join(root, file), app_app_dir)
                    app_files.add(rel_path)

        all_files = root_files.union(app_files)

        for rel_path in sorted(all_files):
            root_file = root_app_dir / rel_path
            app_file = app_app_dir / rel_path

            file_info = {
                "relative_path": rel_path,
                "in_root": root_file.exists(),
                "in_app": app_file.exists()
            }

            if root_file.exists() and app_file.exists():
                status, diff_info = compare_files_content(str(root_file), str(app_file))
                file_info["status"] = status
                file_info["diff_info"] = diff_info

                if status == "identical":
                    app_report["summary"]["identical"] += 1
                    report["summary"]["identical_files"] += 1
                elif status in ["root_more_complete", "app_more_complete", "different_content"]:
                    app_report["summary"]["different"] += 1
                    report["summary"]["different_files"] += 1
                    if status == "root_more_complete":
                        app_report["summary"]["needs_merge"] += 1
                        app_report["summary"]["safe_to_delete_root"] = False
                        file_info["action_required"] = "MERGE: Root version has more content"
                    elif status == "app_more_complete":
                        file_info["action_required"] = "OK: app version is more complete"
                    else:
                        app_report["summary"]["needs_merge"] += 1
                        app_report["summary"]["safe_to_delete_root"] = False
                        file_info["action_required"] = "MANUAL_REVIEW: Content differs significantly"

            elif root_file.exists():
                file_info["status"] = "root_only"
                file_info["action_required"] = "MISSING: File exists only in root, needs to be copied to app/Apps"
                app_report["summary"]["root_only"] += 1
                app_report["summary"]["safe_to_delete_root"] = False
                report["summary"]["root_only_files"] += 1
            else:
                file_info["status"] = "app_only"
                file_info["action_required"] = "OK: New file in app/Apps"
                app_report["summary"]["app_only"] += 1
                report["summary"]["app_only_files"] += 1

            app_report["files"][rel_path] = file_info

        report["apps"][app_name] = app_report
        report["summary"]["apps_compared"] += 1

    # 生成最终结论
    report["conclusion"] = {
        "can_safely_delete_root_apps": all(
            app_info["summary"]["safe_to_delete_root"]
            for app_info in report["apps"].values()
        ),
        "apps_needing_attention": [
            app_name for app_name, app_info in report["apps"].items()
            if not app_info["summary"]["safe_to_delete_root"]
        ],
        "total_files_needing_merge": sum(
            app_info["summary"]["needs_merge"]
            for app_info in report["apps"].values()
        )
    }

    # 输出JSON报告
    print(json.dumps(report, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
