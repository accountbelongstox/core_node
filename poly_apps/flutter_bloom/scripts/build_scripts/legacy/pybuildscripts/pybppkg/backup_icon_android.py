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

import sys
from pathlib import Path
from datetime import datetime
from bppkg.bp_icons import (
    ANDROID_RES_DIR,
    ASSETS_BACKUP_DIR,
    Printer,
    scan_android_icons,
    analyze_icons
)

def backup_icons(appname: str) -> bool:
    """Backup all Android icons with timestamp"""
    # Create timestamp for backup folder
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = ASSETS_BACKUP_DIR / f"android_{timestamp}"
    backup_dir.mkdir(exist_ok=True)
    
    # Scan for existing icons
    icons = scan_android_icons()
    if not icons:
        Printer.error("No icons found to backup!")
        return False
        
    # Analyze current icons
    analyze_icons(icons)
    
    # Perform backup
    Printer.info("\nBacking up icons...")
    for icon in icons:
        # Create relative directory structure in backup
        backup_path = backup_dir / icon.relative_path
        backup_path.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            # Copy file to backup location
            backup_path.write_bytes(icon.path.read_bytes())
            Printer.success(f"Backed up: {icon.relative_path}")
        except Exception as e:
            Printer.error(f"Failed to backup {icon.relative_path}: {e}")
            return False
    
    Printer.success(f"\nBackup completed successfully at: {backup_dir}")
    return True

if __name__ == "__main__":
    try:
        if len(sys.argv) < 2:
            Printer.error("Missing appname parameter")
            Printer.info("Usage: python backup_icon_android.py <appname>")
            sys.exit(1)
            
        appname = sys.argv[1]
        Printer.info(f"Backing up icons for app: {appname}")
        
        if not backup_icons(appname):
            sys.exit(1)
    except KeyboardInterrupt:
        Printer.warn("\nOperation cancelled by user")
        sys.exit(1)
    except Exception as e:
        Printer.error(f"Unexpected error: {e}")
        sys.exit(1)
