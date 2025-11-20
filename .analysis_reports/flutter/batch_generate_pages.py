#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import sys
from pathlib import Path
from collections import defaultdict

TEMPLATE_VIEW = '''// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

/// {page_title} Screen for QY App
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

class {class_name}ScreenAppQy extends StatefulWidget {{
  const {class_name}ScreenAppQy({{super.key}});

  @override
  State<{class_name}ScreenAppQy> createState() => _{class_name}ScreenAppQyState();
}}

class _{class_name}ScreenAppQyState extends State<{class_name}ScreenAppQy> {{
  @override
  Widget build(BuildContext context) {{
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          '{page_title}',
          style: TextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.all(Dimensions.paddingMedium),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildContent(),
            ],
          ),
        ),
      ),
    );
  }}

  Widget _buildContent() {{
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.construction,
            size: 64,
            color: ThemeColors.primary.withOpacity(0.5),
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Text(
            '{page_title} - Coming Soon',
            style: TextStyles.body1.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
          SizedBox(height: Dimensions.spacingSmall),
          Text(
            'This page is under development',
            style: TextStyles.caption.copyWith(
              color: ThemeColors.textTertiary,
            ),
          ),
        ],
      ),
    );
  }}
}}
'''

def to_pascal_case(text):
    """Convert text to PascalCase"""
    return ''.join(word.capitalize() for word in text.replace('_', ' ').replace('-', ' ').split())

def to_title(text):
    """Convert text to Title Case"""
    return ' '.join(word.capitalize() for word in text.replace('_', ' ').replace('-', ' ').split())

def generate_page_files():
    """Generate page files for all pages"""

    docs_dir = Path("D:/programing/core_node/poly_apps/flutter_bloom/lib/apps/app_qy/docs")
    features_dir = Path("D:/programing/core_node/poly_apps/flutter_bloom/lib/apps/app_qy/features_app_qy")

    json_files = sorted(docs_dir.glob("*_info.json"))

    # Skip already done pages
    skip_pages = ['home_study', 'login_phone']

    generated_files = []

    for json_file in json_files:
        page_name = json_file.stem.replace('_info', '')

        if page_name in skip_pages:
            continue

        # Generate class name
        class_name = to_pascal_case(page_name)
        page_title = to_title(page_name)

        # Determine feature directory
        if 'course' in page_name:
            feature_name = 'course'
        elif 'word' in page_name:
            feature_name = 'word'
        elif 'settings' in page_name or 'account' in page_name or 'display' in page_name or 'recommend' in page_name or 'reminder' in page_name:
            feature_name = 'settings'
        elif 'about' in page_name or 'certificate' in page_name or 'more_features' in page_name:
            feature_name = 'profile'
        elif 'checkin' in page_name or 'message' in page_name:
            feature_name = 'social'
        elif 'home' in page_name:
            feature_name = 'home'
        else:
            feature_name = 'other'

        # Create feature directory structure
        feature_path = features_dir / feature_name
        views_path = feature_path / 'views'
        views_path.mkdir(parents=True, exist_ok=True)

        # Generate file content
        file_content = TEMPLATE_VIEW.format(
            page_title=page_title,
            class_name=class_name
        )

        # Write file (skip if already customized)
        output_file = views_path / f"{page_name}_screen_app_qy.dart"

        # Check if file exists and has been customized (not just skeleton)
        skip_file = False
        if output_file.exists():
            with open(output_file, 'r', encoding='utf-8') as f:
                content = f.read()
                # Skip if file doesn't contain "Coming Soon" (indicates it's been customized)
                if 'Coming Soon' not in content:
                    skip_file = True
                    print(f"Skipped (customized): {page_name}")

        if not skip_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(file_content)

        generated_files.append({
            'page_name': page_name,
            'class_name': class_name,
            'feature': feature_name,
            'file': str(output_file.relative_to(features_dir.parent))
        })

        print(f"Generated: {page_name} -> {feature_name}/{output_file.name}")

    # Save summary
    summary_file = Path("D:/programing/core_node/.analysis_reports/flutter/generated_pages_summary.json")
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(generated_files, f, indent=2)

    print(f"\nTotal generated: {len(generated_files)} pages")
    print(f"Summary saved to: {summary_file}")

    return generated_files

if __name__ == "__main__":
    try:
        files = generate_page_files()
        sys.exit(0)
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
