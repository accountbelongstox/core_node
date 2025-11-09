import re
import json
import shutil
from pathlib import Path
from typing import Dict, List, Tuple
from datetime import datetime

class HardcodedStringReplacer:
    def __init__(self, mapping_file: str, localization_keys_import: str):
        self.mapping_file = Path(mapping_file)
        self.localization_keys_import = localization_keys_import
        self.key_mapping = {}
        self.replacements_made = 0
        self.files_modified = 0
        self.backup_dir = None

    def load_mapping(self) -> None:
        with open(self.mapping_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            mappings = data.get('mappings', [])

            for mapping in mappings:
                chinese = mapping['chinese']
                key = mapping['key']
                self.key_mapping[chinese] = key

        print(f"Loaded {len(self.key_mapping)} key mappings")

    def create_backup(self, file_path: Path) -> None:
        if self.backup_dir is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            self.backup_dir = file_path.parent / f".i18n_backup_{timestamp}"
            self.backup_dir.mkdir(parents=True, exist_ok=True)

        backup_path = self.backup_dir / file_path.name
        shutil.copy2(file_path, backup_path)

    def has_i18n_import(self, content: str) -> bool:
        import_patterns = [
            r"import\s+.*i18n_service\.dart",
            r"import\s+.*localization_keys",
        ]
        return any(re.search(pattern, content) for pattern in import_patterns)

    def add_imports_if_needed(self, content: str) -> str:
        if self.has_i18n_import(content):
            return content

        import_section_end = 0
        lines = content.split('\n')

        for i, line in enumerate(lines):
            if line.strip().startswith('import '):
                import_section_end = i

        if import_section_end > 0:
            import_line = f"import '{self.localization_keys_import}';"
            lines.insert(import_section_end + 1, import_line)
            lines.insert(import_section_end + 2, "import '../../../../../../common/i18n/i18n_service.dart';")
            return '\n'.join(lines)

        return content

    def find_string_replacements(self, content: str) -> List[Tuple[str, str, str]]:
        replacements = []
        patterns = [
            (r"'([^']*[\u4e00-\u9fff][^']*)'", "'", "'"),
            (r'"([^"]*[\u4e00-\u9fff][^"]*)"', '"', '"'),
        ]

        for pattern, prefix, suffix in patterns:
            for match in re.finditer(pattern, content):
                chinese_text = match.group(1).strip()

                if chinese_text in self.key_mapping:
                    key = self.key_mapping[chinese_text]
                    const_name = key.replace('qy_', '').upper()
                    original = f"{prefix}{chinese_text}{suffix}"
                    replacement = f"QyAppLocalizationKeys.{const_name}.tr"
                    replacements.append((original, replacement, chinese_text))

        return replacements

    def apply_replacements(self, content: str, replacements: List[Tuple[str, str, str]]) -> Tuple[str, int]:
        replacements_count = 0

        replacements.sort(key=lambda x: len(x[0]), reverse=True)

        for original, replacement, chinese_text in replacements:
            if original in content:
                content = content.replace(original, replacement)
                replacements_count += 1

        return content, replacements_count

    def process_file(self, file_path: Path, dry_run: bool = False) -> Dict:
        result = {
            'path': str(file_path),
            'replacements': 0,
            'modified': False,
            'error': None
        }

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                original_content = f.read()

            replacements = self.find_string_replacements(original_content)

            if not replacements:
                return result

            new_content = original_content
            new_content = self.add_imports_if_needed(new_content)
            new_content, count = self.apply_replacements(new_content, replacements)

            result['replacements'] = count

            if count > 0 and not dry_run:
                self.create_backup(file_path)

                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)

                result['modified'] = True
                self.files_modified += 1
                self.replacements_made += count

        except Exception as e:
            result['error'] = str(e)
            print(f"Error processing {file_path}: {e}")

        return result

    def process_directory(self, directory: Path, pattern: str = "**/*.dart",
                         dry_run: bool = False, exclude_patterns: List[str] = None) -> List[Dict]:
        if exclude_patterns is None:
            exclude_patterns = [
                '**/localization_app_qy/**',
                '**/generated/**',
                '**/*.g.dart',
                '**/.dart_tool/**'
            ]

        dart_files = []
        for file_path in directory.glob(pattern):
            excluded = False
            for exclude_pattern in exclude_patterns:
                if file_path.match(exclude_pattern):
                    excluded = True
                    break
            if not excluded:
                dart_files.append(file_path)

        print(f"\nFound {len(dart_files)} Dart files to process...")

        results = []
        processed = 0

        for dart_file in dart_files:
            result = self.process_file(dart_file, dry_run)
            if result['replacements'] > 0:
                results.append(result)

            processed += 1
            if processed % 10 == 0:
                print(f"Processed {processed}/{len(dart_files)} files...")

        return results

    def generate_report(self, results: List[Dict], output_file: str) -> None:
        report = {
            'summary': {
                'total_files_processed': len(results),
                'total_files_modified': self.files_modified,
                'total_replacements': self.replacements_made,
                'backup_directory': str(self.backup_dir) if self.backup_dir else None
            },
            'modified_files': [r for r in results if r['modified']],
            'errors': [r for r in results if r['error']]
        }

        output_path = Path(output_file)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        print(f"\nReport saved to: {output_path}")

    def print_summary(self, results: List[Dict]) -> None:
        print("\n" + "="*80)
        print("REPLACEMENT SUMMARY")
        print("="*80)
        print(f"Files processed: {len(results)}")
        print(f"Files modified: {self.files_modified}")
        print(f"Total replacements: {self.replacements_made}")

        if self.backup_dir:
            print(f"Backups saved to: {self.backup_dir}")

        errors = [r for r in results if r['error']]
        if errors:
            print(f"\nErrors encountered: {len(errors)}")
            for error_result in errors[:5]:
                print(f"  - {error_result['path']}: {error_result['error']}")

        top_files = sorted([r for r in results if r['modified']],
                          key=lambda x: x['replacements'], reverse=True)[:10]

        if top_files:
            print("\n--- Top 10 Files by Replacements ---")
            for i, file_result in enumerate(top_files, 1):
                print(f"{i:2d}. {Path(file_result['path']).name:40s} ({file_result['replacements']} replacements)")

def main():
    import sys

    if len(sys.argv) < 3:
        print("Usage: python replace_hardcoded_strings.py <mapping_json> <directory> [--dry-run]")
        print("Example: python replace_hardcoded_strings.py mapping.json D:/path/to/app")
        print("         python replace_hardcoded_strings.py mapping.json D:/path/to/app --dry-run")
        sys.exit(1)

    mapping_file = sys.argv[1]
    target_directory = Path(sys.argv[2])
    dry_run = '--dry-run' in sys.argv

    if not Path(mapping_file).exists():
        print(f"Error: Mapping file not found: {mapping_file}")
        sys.exit(1)

    if not target_directory.exists():
        print(f"Error: Directory not found: {target_directory}")
        sys.exit(1)

    localization_keys_import = "../../../localization_app_qy/localization_keys_app_qy.dart"

    print("="*80)
    print("HARDCODED STRING REPLACER")
    print("="*80)
    print(f"Mapping File: {mapping_file}")
    print(f"Target Directory: {target_directory}")
    print(f"Mode: {'DRY RUN (no changes will be made)' if dry_run else 'LIVE (files will be modified)'}")
    print("="*80)

    replacer = HardcodedStringReplacer(mapping_file, localization_keys_import)
    replacer.load_mapping()

    results = replacer.process_directory(target_directory, dry_run=dry_run)

    replacer.print_summary(results)

    if not dry_run:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = f"replacement_report_{timestamp}.json"
        replacer.generate_report(results, report_file)

    print("\n" + "="*80)
    print("REPLACEMENT COMPLETE")
    print("="*80)

    if dry_run:
        print("\nThis was a DRY RUN. Run without --dry-run to apply changes.")

if __name__ == "__main__":
    main()
