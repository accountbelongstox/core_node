import re
import json
import os
from pathlib import Path
from typing import Dict, List, Set, Tuple
from collections import defaultdict

class ChineseStringExtractor:
    def __init__(self, base_dir: str):
        self.base_dir = Path(base_dir)
        self.chinese_pattern = re.compile(r'[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]+')
        self.string_patterns = [
            re.compile(r"'([^']*[\u4e00-\u9fff][^']*)'"),
            re.compile(r'"([^"]*[\u4e00-\u9fff][^"]*)"'),
        ]
        self.results = defaultdict(list)
        self.all_strings = set()

    def has_chinese(self, text: str) -> bool:
        return bool(self.chinese_pattern.search(text))

    def extract_strings_from_line(self, line: str, line_number: int) -> List[Tuple[str, int]]:
        found_strings = []
        for pattern in self.string_patterns:
            matches = pattern.finditer(line)
            for match in matches:
                string_content = match.group(1)
                if self.has_chinese(string_content):
                    string_content = string_content.strip()
                    if string_content and len(string_content) > 0:
                        found_strings.append((string_content, line_number))
        return found_strings

    def extract_from_file(self, file_path: Path) -> Dict:
        file_data = {
            'path': str(file_path.relative_to(self.base_dir)),
            'strings': []
        }

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            for line_num, line in enumerate(lines, 1):
                if self.has_chinese(line):
                    extracted = self.extract_strings_from_line(line, line_num)
                    for string_content, _ in extracted:
                        self.all_strings.add(string_content)
                        file_data['strings'].append({
                            'text': string_content,
                            'line': line_num,
                            'context': line.strip()
                        })
        except Exception as e:
            print(f"Error processing {file_path}: {e}")

        return file_data if file_data['strings'] else None

    def scan_directory(self, pattern: str = "**/*.dart") -> None:
        dart_files = list(self.base_dir.glob(pattern))
        print(f"Found {len(dart_files)} Dart files to scan...")

        processed = 0
        for dart_file in dart_files:
            file_data = self.extract_from_file(dart_file)
            if file_data:
                self.results[str(dart_file.relative_to(self.base_dir))] = file_data
            processed += 1
            if processed % 10 == 0:
                print(f"Processed {processed}/{len(dart_files)} files...")

        print(f"\nScan complete!")
        print(f"Total files with Chinese: {len(self.results)}")
        print(f"Total unique strings: {len(self.all_strings)}")

    def generate_report(self, output_file: str) -> None:
        report = {
            'summary': {
                'total_files': len(self.results),
                'total_unique_strings': len(self.all_strings),
                'base_directory': str(self.base_dir)
            },
            'files': self.results,
            'unique_strings': sorted(list(self.all_strings))
        }

        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        print(f"\nReport saved to: {output_path}")

    def generate_statistics(self) -> Dict:
        stats = {
            'files_by_directory': defaultdict(int),
            'strings_by_category': defaultdict(int),
            'top_files': []
        }

        for file_path, file_data in self.results.items():
            directory = str(Path(file_path).parent)
            stats['files_by_directory'][directory] += 1

            string_count = len(file_data['strings'])
            stats['top_files'].append({
                'path': file_path,
                'string_count': string_count
            })

        stats['top_files'].sort(key=lambda x: x['string_count'], reverse=True)
        stats['top_files'] = stats['top_files'][:20]

        return stats

    def print_statistics(self) -> None:
        stats = self.generate_statistics()

        print("\n" + "="*80)
        print("STATISTICS REPORT")
        print("="*80)

        print(f"\nTotal Files: {len(self.results)}")
        print(f"Total Unique Strings: {len(self.all_strings)}")

        print("\n--- Top 20 Files by String Count ---")
        for i, file_info in enumerate(stats['top_files'], 1):
            print(f"{i:2d}. {file_info['path']:60s} ({file_info['string_count']} strings)")

        print("\n--- Files by Directory ---")
        sorted_dirs = sorted(stats['files_by_directory'].items(),
                           key=lambda x: x[1], reverse=True)
        for directory, count in sorted_dirs[:15]:
            print(f"{directory:60s}: {count} files")

def main():
    import sys

    if len(sys.argv) < 2:
        print("Usage: python extract_chinese_strings.py <directory_path> [output_json]")
        print("Example: python extract_chinese_strings.py D:/path/to/flutter/app output.json")
        sys.exit(1)

    base_directory = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else "chinese_strings_report.json"

    if not os.path.exists(base_directory):
        print(f"Error: Directory not found: {base_directory}")
        sys.exit(1)

    print("="*80)
    print("CHINESE STRING EXTRACTOR FOR FLUTTER")
    print("="*80)
    print(f"Base Directory: {base_directory}")
    print(f"Output File: {output_file}")
    print("="*80)

    extractor = ChineseStringExtractor(base_directory)
    extractor.scan_directory()
    extractor.print_statistics()
    extractor.generate_report(output_file)

    print("\n" + "="*80)
    print("EXTRACTION COMPLETE")
    print("="*80)

if __name__ == "__main__":
    main()
