import os
import hashlib
import sys
from pathlib import Path

class ScriptDetector:
    def __init__(self, script_path: str):
        self.script_path = Path(script_path).resolve()
        if not self.script_path.exists():
            raise FileNotFoundError(f"Script not found: {self.script_path}")
        
        self.script_md5 = self._calculate_md5(self.script_path)
        self.flag_dir = self._get_user_data_dir() / "script_flags"
        self.flag_dir.mkdir(parents=True, exist_ok=True)
        self.flag_file = self.flag_dir / f"{self.script_md5}.flag"

    def _calculate_md5(self, file_path: Path) -> str:
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()

    def _get_user_data_dir(self) -> Path:
        # Get user data directory for Windows/Linux
        if sys.platform == "win32":
            appdata = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA")
            if appdata:
                return Path(appdata) / "pycore"
            return Path.home() / ".pycore"
        else:
            return Path.home() / ".local" / "share" / "pycore"

    def is_installed(self) -> bool:
        """Check if the script has already been successfully installed/executed."""
        return self.flag_file.exists()

    def mark_installed(self):
        """Mark the script as successfully installed/executed."""
        self.flag_file.touch()
        print(f"[Detector] Marked {self.script_path.name} as installed (flag: {self.flag_file.name})")

    def clear_flag(self):
        """Clear the installation flag for this script."""
        if self.flag_file.exists():
            self.flag_file.unlink()
            print(f"[Detector] Cleared flag for {self.script_path.name}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Script installation detector")
    parser.add_argument("script_path", help="Path to the ps1/sh script")
    parser.add_argument("--check", action="store_true", help="Check if installed")
    parser.add_argument("--mark", action="store_true", help="Mark as installed")
    parser.add_argument("--clear", action="store_true", help="Clear installation flag")
    
    args = parser.parse_args()
    
    try:
        detector = ScriptDetector(args.script_path)
        
        if args.check:
            if detector.is_installed():
                print("INSTALLED")
                sys.exit(0)
            else:
                print("NOT_INSTALLED")
                sys.exit(1)
        elif args.mark:
            detector.mark_installed()
            sys.exit(0)
        elif args.clear:
            detector.clear_flag()
            sys.exit(0)
        else:
            print("Please specify --check, --mark, or --clear")
            sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
