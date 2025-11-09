import subprocess
import sys
from pathlib import Path
from datetime import datetime

class I18nWorkflow:
    def __init__(self, target_directory: str, output_base: str = None):
        self.target_dir = Path(target_directory)
        self.output_base = Path(output_base) if output_base else Path("i18n_output")
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.workflow_dir = self.output_base / f"workflow_{self.timestamp}"

        self.workflow_dir.mkdir(parents=True, exist_ok=True)

        self.scripts_dir = Path(__file__).parent

    def run_command(self, command: list, description: str) -> bool:
        print("\n" + "="*80)
        print(f"STEP: {description}")
        print("="*80)
        print(f"Command: {' '.join(command)}")
        print()

        try:
            result = subprocess.run(
                command,
                check=True,
                capture_output=True,
                text=True,
                encoding='utf-8'
            )
            print(result.stdout)
            if result.stderr:
                print("STDERR:", result.stderr)
            return True
        except subprocess.CalledProcessError as e:
            print(f"ERROR: Command failed with exit code {e.returncode}")
            print(f"STDOUT: {e.stdout}")
            print(f"STDERR: {e.stderr}")
            return False
        except Exception as e:
            print(f"ERROR: {e}")
            return False

    def step1_extract_strings(self) -> bool:
        report_file = self.workflow_dir / "chinese_strings_report.json"

        command = [
            sys.executable,
            str(self.scripts_dir / "extract_chinese_strings.py"),
            str(self.target_dir),
            str(report_file)
        ]

        return self.run_command(command, "Extract Chinese Strings")

    def step2_generate_keys(self, existing_keys_file: str = None) -> bool:
        report_file = self.workflow_dir / "chinese_strings_report.json"
        output_dir = self.workflow_dir / "generated_i18n"

        command = [
            sys.executable,
            str(self.scripts_dir / "generate_i18n_keys.py"),
            str(report_file),
            str(output_dir),
            "qy"
        ]

        if existing_keys_file:
            command.append(existing_keys_file)

        return self.run_command(command, "Generate I18n Keys")

    def step3_replace_strings_dry_run(self) -> bool:
        mapping_file = self.workflow_dir / "generated_i18n" / "key_mapping.json"

        command = [
            sys.executable,
            str(self.scripts_dir / "replace_hardcoded_strings.py"),
            str(mapping_file),
            str(self.target_dir),
            "--dry-run"
        ]

        return self.run_command(command, "Replace Strings (DRY RUN)")

    def step4_replace_strings_live(self) -> bool:
        mapping_file = self.workflow_dir / "generated_i18n" / "key_mapping.json"

        print("\n" + "="*80)
        print("WARNING: This will modify your source files!")
        print("="*80)
        response = input("Continue with LIVE replacement? (yes/no): ").strip().lower()

        if response != 'yes':
            print("Replacement cancelled by user.")
            return False

        command = [
            sys.executable,
            str(self.scripts_dir / "replace_hardcoded_strings.py"),
            str(mapping_file),
            str(self.target_dir)
        ]

        return self.run_command(command, "Replace Strings (LIVE)")

    def run_full_workflow(self, dry_run_only: bool = False,
                         existing_keys_file: str = None) -> None:
        print("="*80)
        print("I18N WORKFLOW AUTOMATION")
        print("="*80)
        print(f"Target Directory: {self.target_dir}")
        print(f"Output Directory: {self.workflow_dir}")
        print(f"Mode: {'DRY RUN ONLY' if dry_run_only else 'FULL WORKFLOW'}")
        print("="*80)

        steps = [
            ("Extract Chinese Strings", self.step1_extract_strings),
            ("Generate I18n Keys", lambda: self.step2_generate_keys(existing_keys_file)),
            ("Dry Run Replacement", self.step3_replace_strings_dry_run),
        ]

        if not dry_run_only:
            steps.append(("Live Replacement", self.step4_replace_strings_live))

        for step_name, step_func in steps:
            print(f"\n{'='*80}")
            print(f"Starting: {step_name}")
            print(f"{'='*80}")

            success = step_func()

            if not success:
                print(f"\n{'='*80}")
                print(f"ERROR: {step_name} failed!")
                print(f"{'='*80}")
                print("Workflow stopped. Please check the errors above.")
                return

            print(f"\n{'='*80}")
            print(f"✓ {step_name} completed successfully")
            print(f"{'='*80}")

        print("\n" + "="*80)
        print("WORKFLOW COMPLETE")
        print("="*80)
        print(f"\nAll output files are in: {self.workflow_dir}")
        print("\nGenerated files:")
        print(f"  - chinese_strings_report.json: Extraction report")
        print(f"  - generated_i18n/generated_keys.dart: Dart key constants")
        print(f"  - generated_i18n/generated_zh.dart: Chinese translations")
        print(f"  - generated_i18n/generated_en.dart: English translation templates")
        print(f"  - generated_i18n/key_mapping.json: Key-to-text mapping")

        if not dry_run_only:
            print(f"  - replacement_report_*.json: Replacement statistics")
            print(f"\nBackups of modified files are saved in subdirectories.")

def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Run the complete I18n workflow for Flutter apps"
    )
    parser.add_argument(
        "directory",
        help="Target directory containing Flutter Dart files"
    )
    parser.add_argument(
        "--output",
        default="i18n_output",
        help="Base output directory (default: i18n_output)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only run extraction, generation, and dry-run replacement (no actual changes)"
    )
    parser.add_argument(
        "--existing-keys",
        help="Path to existing localization keys file to avoid duplicates"
    )

    args = parser.parse_args()

    if not Path(args.directory).exists():
        print(f"Error: Directory not found: {args.directory}")
        sys.exit(1)

    workflow = I18nWorkflow(args.directory, args.output)
    workflow.run_full_workflow(
        dry_run_only=args.dry_run,
        existing_keys_file=args.existing_keys
    )

if __name__ == "__main__":
    main()
