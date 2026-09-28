#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Reorganize Training Data Structure
Moves processed data from source/ to processed/ namespaces
"""

import os
import shutil
from pathlib import Path

# Paths
d3_check_dir = Path(__file__).parent.parent
cache_dir = d3_check_dir / ".cache"
training_data_dir = cache_dir / "training_data"

# Source and processed directories
source_dir = training_data_dir / "source" / "progress_bar"
processed_classification_dir = training_data_dir / "processed" / "classification" / "progress_bar"

print("=" * 80)
print("Reorganizing Training Data Structure")
print("=" * 80)

# Create processed directory
processed_classification_dir.mkdir(parents=True, exist_ok=True)
print(f"\nCreated: {processed_classification_dir}")

# Move yes/no folders if they exist in source
yes_source = source_dir / "yes"
no_source = source_dir / "no"

yes_dest = processed_classification_dir / "yes"
no_dest = processed_classification_dir / "no"

if yes_source.exists():
    if yes_dest.exists():
        print(f"\n⚠️  Destination exists, removing: {yes_dest}")
        shutil.rmtree(yes_dest)

    print(f"Moving: {yes_source} -> {yes_dest}")
    shutil.move(str(yes_source), str(yes_dest))
    print(f"OK - Moved yes folder")
else:
    print(f"\nWARNING: 'yes' folder not found in source")

if no_source.exists():
    if no_dest.exists():
        print(f"\nWARNING: Destination exists, removing: {no_dest}")
        shutil.rmtree(no_dest)

    print(f"Moving: {no_source} -> {no_dest}")
    shutil.move(str(no_source), str(no_dest))
    print(f"OK - Moved no folder")
else:
    print(f"\nWARNING: 'no' folder not found in source")

# Copy source image to source directory
source_image_original = cache_dir / "d4_exp_farming_20251016_031749_166.png"
source_image_dest = source_dir / "d4_exp_farming_20251016_031749_166.png"

if source_image_original.exists() and not source_image_dest.exists():
    print(f"\nCopying source image:")
    print(f"  From: {source_image_original}")
    print(f"  To:   {source_image_dest}")
    shutil.copy(str(source_image_original), str(source_image_dest))
    print(f"OK - Copied source image")
elif source_image_dest.exists():
    print(f"\nOK - Source image already exists: {source_image_dest}")
else:
    print(f"\nWARNING: Source image not found: {source_image_original}")

# Update metadata.json to use correct relative path
metadata_file = source_dir / "metadata.json"
if metadata_file.exists():
    import json

    print(f"\nUpdating metadata.json...")
    with open(metadata_file, 'r', encoding='utf-8') as f:
        metadata = json.load(f)

    # Update source_image path to be relative to metadata location
    metadata['source_image'] = "d4_exp_farming_20251016_031749_166.png"

    with open(metadata_file, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    print(f"OK - Updated metadata.json")

print("\n" + "=" * 80)
print("SUCCESS: Reorganization Complete!")
print("=" * 80)

print("\nNew structure:")
print(f"  Source data:        {source_dir}")
print(f"  Classification data: {processed_classification_dir}")
print("\nSource directory should contain:")
print("  - metadata.json")
print("  - d4_exp_farming_*.png (original screenshot)")
print("\nProcessed/classification directory should contain:")
print("  - yes/ (positive samples)")
print("  - no/ (negative samples)")
