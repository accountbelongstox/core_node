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

# This parser uses ruamel.yaml to preserve indentation and formatting when parsing and saving pubspec.yaml files.
import os
from typing import Any, Dict, List, Optional
from ruamel.yaml import YAML

yaml = YAML()
yaml.preserve_quotes = True

class PubspecParser:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.data = self._load_yaml(file_path)
        self._migrate_assets_and_fonts_to_flutter()

    def _load_yaml(self, path: str) -> Dict[str, Any]:
        with open(path, 'r', encoding='utf-8') as f:
            return yaml.load(f)

    def _migrate_assets_and_fonts_to_flutter(self):
        """
        Move any root-level 'assets' or 'fonts' into 'flutter' if found.
        This ensures correct structure for Flutter pubspec.yaml.
        """
        if 'flutter' not in self.data or self.data['flutter'] is None:
            self.data['flutter'] = {}
        # Move root-level assets
        if 'assets' in self.data:
            self.data['flutter']['assets'] = self.data['assets']
            del self.data['assets']
        # Move root-level fonts
        if 'fonts' in self.data:
            self.data['flutter']['fonts'] = self.data['fonts']
            del self.data['fonts']

    def get_name(self) -> Optional[str]:
        return self.data.get('name')

    def set_name(self, name: str):
        self.data['name'] = name

    def get_description(self) -> Optional[str]:
        return self.data.get('description')

    def set_description(self, description: str):
        self.data['description'] = description

    def get_version(self) -> Optional[str]:
        return self.data.get('version')

    def set_version(self, version: str):
        self.data['version'] = version

    def get_assets(self) -> List[str]:
        flutter = self.data.get('flutter')
        if not flutter or 'assets' not in flutter:
            return []
        return flutter['assets']

    def set_assets(self, assets: List[str]):
        if 'flutter' not in self.data or self.data['flutter'] is None:
            self.data['flutter'] = {}
        self.data['flutter']['assets'] = assets

    def get_fonts(self) -> List[Dict[str, Any]]:
        flutter = self.data.get('flutter')
        if not flutter or 'fonts' not in flutter:
            return []
        return flutter['fonts']

    def set_fonts(self, fonts: List[Dict[str, Any]]):
        if 'flutter' not in self.data or self.data['flutter'] is None:
            self.data['flutter'] = {}
        self.data['flutter']['fonts'] = fonts

    def get_font_families(self) -> List[str]:
        fonts = self.get_fonts()
        return [font.get('family') for font in fonts if 'family' in font]

    def set_font_family(self, family: str, fonts_list: List[Dict[str, Any]]):
        fonts = self.get_fonts()
        found = False
        for font in fonts:
            if font.get('family') == family:
                font['fonts'] = fonts_list
                found = True
                break
        if not found:
            fonts.append({'family': family, 'fonts': fonts_list})
        self.set_fonts(fonts)

    def save(self, path: Optional[str] = None):
        save_path = path if path else self.file_path
        with open(save_path, 'w', encoding='utf-8') as f:
            yaml.dump(self.data, f)
        # Post-process: add two spaces to lines starting with '- assets' or '- family'
        with open(save_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        new_lines = []
        for line in lines:
            stripped = line.lstrip()
            if stripped.startswith('- assets') or stripped.startswith('- family'):
                new_lines.append('  ' + line)
            else:
                new_lines.append(line)
        # Further post-process: if a line is '- family', and the next line starts with 'fonts:', add two spaces to the next line
        i = 0
        while i < len(new_lines) - 1:
            curr_stripped = new_lines[i].lstrip()
            next_stripped = new_lines[i+1].lstrip()
            if curr_stripped.startswith('- family') and next_stripped.startswith('fonts:'):
                new_lines[i+1] = '  ' + new_lines[i+1]
            i += 1
        # Further post-process: add four spaces to lines starting with '- asset:' or 'weight:'
        for idx, line in enumerate(new_lines):
            lstripped = line.lstrip()
            if lstripped.startswith('- asset:') or lstripped.startswith('weight:'):
                new_lines[idx] = '    ' + line
        # Ensure exactly one blank line between '- assets' and next 'fonts:'
        i = 0
        while i < len(new_lines) - 1:
            curr_stripped = new_lines[i].lstrip()
            next_stripped = new_lines[i+1].lstrip()
            if curr_stripped.startswith('- assets'):
                # Look ahead for the next non-empty line
                j = i + 1
                while j < len(new_lines) and new_lines[j].strip() == '':
                    j += 1
                if j < len(new_lines) and new_lines[j].lstrip().startswith('fonts:'):
                    # Ensure exactly one blank line between i and j
                    # Remove all blank lines between i and j
                    del new_lines[i+1:j]
                    # Insert a single blank line
                    new_lines.insert(i+1, '\n')
                    i += 2  # Skip the blank and the fonts: line
                    continue
            i += 1
        with open(save_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
