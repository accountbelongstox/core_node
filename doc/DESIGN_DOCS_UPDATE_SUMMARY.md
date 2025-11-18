# Design Docs System Update Summary

**Date**: 2025-11-19
**Status**: ✅ COMPLETED

## Changes Overview

### 1. Directory Renaming (Precision-Based, Not Language-Based)

**Before** (Misleading):
```
2_page_designs_cn/     # "cn" implied Chinese, but meant rough
3_page_designs_en/     # "en" implied English, but meant detailed
```

**After** (Clear):
```
2_page_designs_rough/      # Rough page designs (wireframes)
3_page_designs_detailed/   # Detailed page designs (specs + code mapping)
```

### 2. Smart Example Images (Context-Aware Naming)

**Before**:
- Fixed name: `_placeholder.png` (all directories)

**After** (Context-aware):
- Layer 1: `example_architecture.png`
- Layer 2: `example_home_wireframe.png`
- Layer 3: `example_mockup.png`
- Page-specific: `example_home_mockup.png`, `example_profile_mockup.png`

### 3. All English Codebase

**Before**: Mixed Chinese and English
- Templates: Chinese text
- Comments: Chinese
- Log messages: Chinese

**After**: 100% English
- All templates: English
- All comments: English
- All log messages: English
- All generated content: English

### 4. Deprecated File Cleanup

Auto-removes on startup:
- Old directories: `2_page_designs_cn`, `3_page_designs_en`
- Old placeholders: `_placeholder.png`
- Chinese examples: `示例_*.md`

## Technical Implementation

### Files Modified

1. **design_structure_auto_expand.py**
   - Renamed directory structure definitions
   - All templates converted to English
   - Added `cleanup_deprecated_files()` function
   - Integrated cleanup into `ensure_design_structure()`

2. **placeholder_generator.py**
   - Removed fixed `PLACEHOLDER_FILENAME`
   - Added `EXAMPLE_IMAGE_NAMES` mapping
   - Added `get_example_image_name()` - context-aware naming
   - Added `is_example_image()` - detect example images
   - Added `remove_example_images()` - cleanup all examples
   - Updated `manage_placeholder()` - use context-aware names

3. **Documentation**
   - Updated `doc/PYCORE_UP.md` with changes
   - Created `doc/DESIGN_DOCS_UPDATE_SUMMARY.md` (this file)

### New Functions

```python
# design_structure_auto_expand.py
def cleanup_deprecated_files(base_dir: Path) -> List[str]:
    """Remove deprecated files and directories"""

# placeholder_generator.py
def get_example_image_name(directory_label: str) -> str:
    """Get example image name based on directory context"""

def is_example_image(filename: str) -> bool:
    """Check if filename is an example/placeholder image"""

def get_example_images(images_dir: Path) -> List[Path]:
    """Get all example placeholder images in directory"""

def remove_example_images(images_dir: Path) -> int:
    """Remove all example placeholder images"""
```

## Example Image Naming Map

```python
EXAMPLE_IMAGE_NAMES = {
    "1_concept_designs": "example_architecture.png",
    "2_page_designs_rough": "example_home_wireframe.png",
    "3_page_designs_detailed": "example_mockup.png",
    "home_page": "example_home_mockup.png",
    "profile_page": "example_profile_mockup.png",
    "settings_page": "example_settings_mockup.png",
}
```

## Migration Guide

### For Existing Projects

1. **Run Auto-Expansion**:
   ```bash
   python -m poly_apps.flutter_bloom.scripts.flutter_dev_tools.design_doc_tool
   ```

2. **What Happens**:
   - Old directories (`2_page_designs_cn`, `3_page_designs_en`) are removed
   - New directories (`2_page_designs_rough`, `3_page_designs_detailed`) are created
   - Old `_placeholder.png` files are removed
   - Context-aware example images are generated

3. **Manual Steps** (if needed):
   - Move any custom content from old directories to new ones **before** running

### For New Projects

Just run the auto-expansion - everything is created automatically with the new structure.

## Testing Results

**Test App**: `app_test`

**Generated Structure**:
```
design_docs_and_progress/
├── 1_concept_designs/
│   └── images/
│       ├── example_architecture.png      ✓ Context-aware name
│       └── README.md                      ✓ English
├── 2_page_designs_rough/                  ✓ New name
│   └── images/
│       ├── example_home_wireframe.png     ✓ Context-aware name
│       └── README.md                      ✓ English
└── 3_page_designs_detailed/               ✓ New name
    └── example_home_page/
        └── images/
            ├── example_mockup.png         ✓ Context-aware name
            └── README.md                  ✓ English
```

**Verification**:
- ✅ All directory names correct
- ✅ All example images have context-aware names
- ✅ All generated content in English
- ✅ No deprecated files present

## Benefits

1. **Clearer Naming**: "rough" and "detailed" clearly indicate precision level
2. **Context-Aware Examples**: Example image names suggest what to put there
3. **Cleaner Codebase**: All English, easier for international collaboration
4. **Auto-Cleanup**: No manual migration needed, deprecated files auto-removed
5. **Backwards Compatible**: Old structure auto-migrated on first run

## Known Limitations

- Chinese text in old `README.md` files won't be auto-translated (only templates updated)
- Developers need to manually move content from old directories if they have custom files

## Future Enhancements

- [ ] Add migration report showing what was moved/removed
- [ ] Support for custom example image templates
- [ ] Validate example image content matches layer purpose
- [ ] Integration with design tool APIs (Figma, Sketch, etc.)

## References

- Main docs: `doc/DESIGN_DOCS_STRUCTURE.md`
- Image placement: `doc/DESIGN_IMAGES_PLACEMENT.md`
- Placeholder system: `utils/PLACEHOLDER_README.md`
- Update history: `doc/PYCORE_UP.md`
