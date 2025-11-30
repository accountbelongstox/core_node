import os
import json
from pathlib import Path
from datetime import datetime

root_apps = Path("Apps")
app_apps = Path("app/Apps")

# Check nested poly_apps
nested_path = app_apps / "poly_apps"

report = {
    "analysis_metadata": {
        "timestamp": datetime.now().isoformat(),
        "project_root": str(Path.cwd()),
        "analysis_version": "1.0"
    },
    "issue_summary": {
        "duplicate_apps_locations": [
            str(root_apps.absolute()),
            str(app_apps.absolute())
        ],
        "incorrect_nesting": str(nested_path.absolute()) if nested_path.exists() else None,
        "apps_affected": []
    },
    "detailed_analysis": {},
    "recommendations": {
        "actions": [],
        "correct_structure": "app/Apps/{appNameWithVersion}/"
    }
}

# Applications to analyze
apps = ["AChatV1", "AwyV0", "BankV1", "CodeMartV1", "DictV1", "ItToolsV1", "ServerManagerV1"]

for app in apps:
    root_path = root_apps / app
    app_path = app_apps / app

    root_exists = root_path.exists()
    app_exists = app_path.exists()

    analysis = {
        "app_name": app,
        "locations": {
            "root_apps": {
                "path": str(root_path.absolute()),
                "exists": root_exists
            },
            "app_apps": {
                "path": str(app_path.absolute()),
                "exists": app_exists
            }
        },
        "status": None,
        "recommendation": None,
        "action_required": None
    }

    if root_exists and app_exists:
        report["issue_summary"]["apps_affected"].append(app)

        # Get modification times
        root_files = list(root_path.rglob("*"))
        app_files = list(app_path.rglob("*"))

        root_latest = max((f.stat().st_mtime for f in root_files if f.is_file()), default=0)
        app_latest = max((f.stat().st_mtime for f in app_files if f.is_file()), default=0)

        root_count = len([f for f in root_files if f.is_file()])
        app_count = len([f for f in app_files if f.is_file()])

        root_size = sum(f.stat().st_size for f in root_files if f.is_file())
        app_size = sum(f.stat().st_size for f in app_files if f.is_file())

        analysis["locations"]["root_apps"].update({
            "file_count": root_count,
            "total_size_bytes": root_size,
            "latest_modification": datetime.fromtimestamp(root_latest).isoformat() if root_latest > 0 else None
        })

        analysis["locations"]["app_apps"].update({
            "file_count": app_count,
            "total_size_bytes": app_size,
            "latest_modification": datetime.fromtimestamp(app_latest).isoformat() if app_latest > 0 else None
        })

        analysis["status"] = "DUPLICATE_EXISTS"

        # Determine which is newer/better
        if app_latest > root_latest:
            analysis["recommendation"] = "KEEP_APP_APPS"
            analysis["action_required"] = f"DELETE: {root_path.absolute()}"
            analysis["reason"] = f"app/Apps/ version is more recent (last modified: {datetime.fromtimestamp(app_latest).strftime('%Y-%m-%d %H:%M:%S')})"
        elif root_latest > app_latest:
            analysis["recommendation"] = "UPDATE_APP_APPS_THEN_DELETE_ROOT"
            analysis["action_required"] = f"1. SYNC from {root_path.absolute()} to {app_path.absolute()}\n2. DELETE: {root_path.absolute()}"
            analysis["reason"] = f"Root Apps/ version is more recent (last modified: {datetime.fromtimestamp(root_latest).strftime('%Y-%m-%d %H:%M:%S')})"
        else:
            if app_count >= root_count:
                analysis["recommendation"] = "KEEP_APP_APPS"
                analysis["action_required"] = f"DELETE: {root_path.absolute()}"
                analysis["reason"] = f"app/Apps/ has equal or more files ({app_count} vs {root_count})"
            else:
                analysis["recommendation"] = "UPDATE_APP_APPS_THEN_DELETE_ROOT"
                analysis["action_required"] = f"1. SYNC from {root_path.absolute()} to {app_path.absolute()}\n2. DELETE: {root_path.absolute()}"
                analysis["reason"] = f"Root Apps/ has more files ({root_count} vs {app_count})"

    elif root_exists and not app_exists:
        analysis["status"] = "MISPLACED"
        analysis["recommendation"] = "MOVE_TO_APP_APPS"
        analysis["action_required"] = f"MOVE: {root_path.absolute()} -> {app_path.absolute()}"
        analysis["reason"] = "Application exists only in wrong location (root Apps/)"

        root_files = list(root_path.rglob("*"))
        root_count = len([f for f in root_files if f.is_file()])
        root_size = sum(f.stat().st_size for f in root_files if f.is_file())
        root_latest = max((f.stat().st_mtime for f in root_files if f.is_file()), default=0)

        analysis["locations"]["root_apps"].update({
            "file_count": root_count,
            "total_size_bytes": root_size,
            "latest_modification": datetime.fromtimestamp(root_latest).isoformat() if root_latest > 0 else None
        })

    elif not root_exists and app_exists:
        analysis["status"] = "CORRECT_LOCATION"
        analysis["recommendation"] = "NO_ACTION"
        analysis["action_required"] = "None - already in correct location"
        analysis["reason"] = "Application exists only in correct location (app/Apps/)"

        app_files = list(app_path.rglob("*"))
        app_count = len([f for f in app_files if f.is_file()])
        app_size = sum(f.stat().st_size for f in app_files if f.is_file())
        app_latest = max((f.stat().st_mtime for f in app_files if f.is_file()), default=0)

        analysis["locations"]["app_apps"].update({
            "file_count": app_count,
            "total_size_bytes": app_size,
            "latest_modification": datetime.fromtimestamp(app_latest).isoformat() if app_latest > 0 else None
        })

    report["detailed_analysis"][app] = analysis

# Check nested poly_apps
if nested_path.exists():
    nested_files = list(nested_path.rglob("*"))
    nested_file_count = len([f for f in nested_files if f.is_file()])

    report["nested_directory_issue"] = {
        "path": str(nested_path.absolute()),
        "file_count": nested_file_count,
        "recommendation": "DELETE_IMMEDIATELY",
        "reason": "This is incorrectly nested duplicate directory structure",
        "action_required": f"DELETE: {nested_path.absolute()}"
    }

# Generate action plan
report["action_plan"] = {
    "phase_1_immediate_deletions": [],
    "phase_2_moves_or_syncs": [],
    "phase_3_final_cleanup": [],
    "estimated_disk_space_to_free": 0
}

# Add nested directory to immediate deletions
if "nested_directory_issue" in report:
    report["action_plan"]["phase_1_immediate_deletions"].append({
        "action": "DELETE",
        "path": report["nested_directory_issue"]["path"],
        "reason": "Incorrect nested structure"
    })

for app, data in report["detailed_analysis"].items():
    if data["recommendation"] == "KEEP_APP_APPS":
        root_size = data["locations"]["root_apps"].get("total_size_bytes", 0)
        report["action_plan"]["phase_3_final_cleanup"].append({
            "action": "DELETE",
            "path": data["locations"]["root_apps"]["path"],
            "reason": f"Duplicate of app/Apps/{app} (older/less complete)",
            "space_freed_bytes": root_size
        })
        report["action_plan"]["estimated_disk_space_to_free"] += root_size

    elif data["recommendation"] == "UPDATE_APP_APPS_THEN_DELETE_ROOT":
        root_size = data["locations"]["root_apps"].get("total_size_bytes", 0)
        report["action_plan"]["phase_2_moves_or_syncs"].append({
            "action": "SYNC_THEN_DELETE",
            "from": data["locations"]["root_apps"]["path"],
            "to": data["locations"]["app_apps"]["path"],
            "reason": f"Root version is newer, need to sync before deletion",
            "space_freed_bytes": root_size
        })
        report["action_plan"]["estimated_disk_space_to_free"] += root_size

    elif data["recommendation"] == "MOVE_TO_APP_APPS":
        report["action_plan"]["phase_2_moves_or_syncs"].append({
            "action": "MOVE",
            "from": data["locations"]["root_apps"]["path"],
            "to": data["locations"]["app_apps"]["path"],
            "reason": "Move to correct location"
        })

# Convert bytes to MB for readability
space_mb = report["action_plan"]["estimated_disk_space_to_free"] / (1024 * 1024)
report["action_plan"]["estimated_disk_space_to_free_mb"] = round(space_mb, 2)

# Summary statistics
report["summary_statistics"] = {
    "total_apps_analyzed": len(apps),
    "apps_with_duplicates": len(report["issue_summary"]["apps_affected"]),
    "apps_in_correct_location": sum(1 for d in report["detailed_analysis"].values() if d["recommendation"] == "NO_ACTION"),
    "apps_need_moving": sum(1 for d in report["detailed_analysis"].values() if d["recommendation"] == "MOVE_TO_APP_APPS"),
    "apps_need_sync": sum(1 for d in report["detailed_analysis"].values() if d["recommendation"] == "UPDATE_APP_APPS_THEN_DELETE_ROOT"),
    "apps_can_delete_root": sum(1 for d in report["detailed_analysis"].values() if d["recommendation"] == "KEEP_APP_APPS")
}

print(json.dumps(report, indent=2, ensure_ascii=False))
