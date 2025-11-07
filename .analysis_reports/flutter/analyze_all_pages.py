#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import sys
from pathlib import Path
from collections import defaultdict

def analyze_pages():
    """Analyze all pages from docs directory"""

    docs_dir = Path("D:/programing/core_node/poly_apps/flutter_bloom/lib/apps/app_qy/docs")

    # Find all JSON files
    json_files = sorted(docs_dir.glob("*_info.json"))

    pages_analysis = []

    for json_file in json_files:
        # Read JSON
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Extract page name from filename
        page_name = json_file.stem.replace('_info', '')
        image_file = json_file.parent / f"{page_name}.jpg"

        # Analyze OCR result
        ocr = data.get('ocr_result', {})
        text = ocr.get('text', '')
        lines = ocr.get('lines', [])
        words = ocr.get('words', [])

        # Categorize page type
        page_type = categorize_page(page_name, text)

        pages_analysis.append({
            'name': page_name,
            'image': image_file.name,
            'json': json_file.name,
            'type': page_type,
            'text_length': len(text),
            'lines_count': len(lines),
            'words_count': len(words),
            'has_position': len(lines) > 0,
            'text_preview': text[:100] if text else ''
        })

    return pages_analysis

def categorize_page(name, text):
    """Categorize page by name and content"""

    categories = {
        'authentication': ['login', 'signin', 'signup', 'verify', 'forgot'],
        'home': ['home'],
        'course': ['course', 'ielts', 'python', 'plans'],
        'settings': ['settings', 'account', 'display', 'recommend', 'reminder'],
        'word': ['word_book', 'word_listening', 'word_card'],
        'profile': ['more_features', 'certificate', 'about'],
        'social': ['checkin', 'message'],
        'other': []
    }

    name_lower = name.lower()

    for category, keywords in categories.items():
        for keyword in keywords:
            if keyword in name_lower:
                return category

    return 'other'

def group_by_category(pages):
    """Group pages by category"""
    grouped = defaultdict(list)
    for page in pages:
        grouped[page['type']].append(page)
    return dict(grouped)

def generate_progress_table(pages_by_category):
    """Generate progress tracking table in markdown format"""

    output = []
    output.append("# App QY - Pages Development Progress Table")
    output.append("")
    output.append("Generated: 2025-11-06")
    output.append("")
    output.append("## Overview")
    output.append("")

    total_pages = sum(len(pages) for pages in pages_by_category.values())
    output.append(f"- **Total Pages:** {total_pages}")
    output.append(f"- **Categories:** {len(pages_by_category)}")
    output.append("")

    # Category summary
    output.append("## Category Summary")
    output.append("")
    output.append("| Category | Pages Count | Status |")
    output.append("|----------|-------------|--------|")

    for category, pages in sorted(pages_by_category.items()):
        output.append(f"| {category.capitalize()} | {len(pages)} | Not Started |")

    output.append("")
    output.append("## Detailed Progress by Category")
    output.append("")

    # Detailed pages by category
    for category in sorted(pages_by_category.keys()):
        pages = pages_by_category[category]
        output.append(f"### {category.capitalize()} Pages ({len(pages)} pages)")
        output.append("")
        output.append("| # | Page Name | Image | JSON | Status | Priority | Notes |")
        output.append("|---|-----------|-------|------|--------|----------|-------|")

        for idx, page in enumerate(pages, 1):
            priority = "High" if category in ['authentication', 'home'] else "Medium"
            if category == 'home' and page['name'] == 'home_study':
                priority = "URGENT"

            output.append(f"| {idx} | {page['name']} | {page['image']} | {page['json']} | Not Started | {priority} | - |")

        output.append("")

    # Development order recommendation
    output.append("## Recommended Development Order")
    output.append("")
    output.append("### Phase 1: Core Features (Week 1-2)")
    output.append("1. **Authentication** - Login, signup flow")
    output.append("2. **Home** - Main landing page (URGENT: home_study)")
    output.append("")
    output.append("### Phase 2: Primary Features (Week 3-4)")
    output.append("3. **Course** - Course browsing and details")
    output.append("4. **Word** - Word learning features")
    output.append("")
    output.append("### Phase 3: User Features (Week 5-6)")
    output.append("5. **Profile** - User profile and settings")
    output.append("6. **Settings** - App configuration")
    output.append("")
    output.append("### Phase 4: Social Features (Week 7)")
    output.append("7. **Social** - Check-in, messages")
    output.append("")
    output.append("## Technical Requirements")
    output.append("")
    output.append("All pages must follow:")
    output.append("- Use `QyAppLocalizationKeys.*.tr(context)` for all text")
    output.append("- Use `UserModelAppQy` for user data")
    output.append("- Use state management (Provider/Riverpod)")
    output.append("- Use API services from `services_app_qy/`")
    output.append("- Use theme colors from `lib/common/theme/base/`")
    output.append("- No hardcoded colors, text, or data")
    output.append("- Follow `FLUTTER_GUIDE_THIS_FILE_NO_AI_EDIT.md` strictly")
    output.append("")
    output.append("## Page Details")
    output.append("")

    # All pages table
    output.append("| # | Page Name | Type | Image | Has Position Data | Text Length | Lines | Words |")
    output.append("|---|-----------|------|-------|-------------------|-------------|-------|-------|")

    all_pages = []
    for pages in pages_by_category.values():
        all_pages.extend(pages)

    for idx, page in enumerate(sorted(all_pages, key=lambda x: x['name']), 1):
        pos_data = "Yes" if page['has_position'] else "No"
        output.append(f"| {idx} | {page['name']} | {page['type']} | {page['image']} | {pos_data} | {page['text_length']} | {page['lines_count']} | {page['words_count']} |")

    return '\n'.join(output)

def main():
    print("Analyzing all pages from docs directory...")

    pages = analyze_pages()
    pages_by_category = group_by_category(pages)

    print(f"\nFound {len(pages)} pages in {len(pages_by_category)} categories:")
    for category, cat_pages in sorted(pages_by_category.items()):
        print(f"  - {category}: {len(cat_pages)} pages")

    # Generate progress table
    progress_table = generate_progress_table(pages_by_category)

    # Save to file
    output_file = Path("D:/programing/core_node/poly_apps/flutter_bloom/lib/apps/app_qy/PAGES_PROGRESS.md")
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(progress_table)

    print(f"\nProgress table saved to: {output_file}")
    print("\nNext step: Start refactoring home_study page")

    return 0

if __name__ == "__main__":
    sys.exit(main())
