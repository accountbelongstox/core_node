# Image Comparison System - Implementation Summary

## Overview
Extended design tool with image preview, comparison upload, and AI prompt generation.

## Key Features

### 1. Middle Panel Enhancements
- **Current Path Display**: Show selected file/folder path
- **Open in Explorer**: Quick access to current location
- **Image Preview**: Display images instead of "Binary file not supported"

### 2. Image Comparison Workflow
```
┌─────────────────────────────────────────────────────────────┐
│  Left: Design Files Tree    │   Middle: Image Viewer       │
│                              │   - Show selected image       │
│  Click image file →          │   - Upload Comparison button  │
│                              │   - History list below        │
└──────────────────────────────────────────────────────────────┘
                                      ↓
                        Generate Composite Image
                                      ↓
┌──────────────────────────────────────────────────────────────┐
│            Composite Comparison Image                        │
│  ┌─────────────────────┐  │  ┌────────────────────────────┐ │
│  │  Expected Design    │  │  │  Actual Implementation     │ │
│  │                     │  │  │  (auto-resized, white pad) │ │
│  │                     │  │  │                            │ │
│  └─────────────────────┘  │  └────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 3. External Directory Mapping
**Windows Path**: `D:\programing\_build_dir\flutter_main\{appname}\comparison_images\{page_name}\`

**Filename Format**: `{appname}_{pagename}_{description}_{timestamp}_comparison.png`

Example: `app_wuy_home_page_v1_test_20251119143520_comparison.png`

### 4. Composite Image Generation
- **Left**: Expected design image
- **Right**: Uploaded actual image
- **Auto-resize**: Match height, scale width proportionally
- **White fill**: Pad to match widths
- **Top labels**: "Expected Design" (left, blue) vs "Actual Implementation" (right, red)

### 5. AI Prompt Integration
**Pre-defined Prompt Template**:
```
Based on the comparison image at {download_url}, analyze the differences between expected design (left) and actual implementation (right).

Focus on:
- Layout differences
- Color variations (use color_palette data)
- Text content mismatches (use ocr_text data)
- Spacing and alignment issues

Provide specific Flutter code adjustments to match the expected design.

Design source: {layer} layer (2_page_designs_rough / 3_page_designs_detailed)
```

**Dynamic Variables**:
- `{download_url}`: Comparison image URL
- `{layer}`: rough or detailed
- `{color_palette}`: Top 10 colors from analysis
- `{ocr_text}`: OCR-extracted text with positions

## API Endpoints

### Create Comparison
```bash
POST /api/apps/{app}/comparison/create
{
  "page_key": "home_page",
  "expected_image_path": "2_page_designs_rough/images/home.png",
  "actual_image_path": "temp_uploaded.png",
  "description": "v1_test"
}

Response:
{
  "success": true,
  "filename": "app_wuy_home_page_v1_test_20251119143520_comparison.png",
  "download_url": "/api/comparison/download/app_wuy/home_page/...",
  "dimensions": { "width": 1600, "height": 900 }
}
```

### List Comparisons
```bash
GET /api/apps/{app}/comparison/list/{page_key}

Response:
{
  "success": true,
  "comparisons": [
    {
      "filename": "app_wuy_home_page_v1_test_..._comparison.png",
      "download_url": "...",
      "created_at": "2025-11-19T14:35:20"
    }
  ]
}
```

### Download Comparison
```bash
GET /api/comparison/download/{app}/{page_key}/{filename}

Response: Binary PNG image
```

## Frontend Components

### File Viewer Enhancement
- **isImageFile()**: Check if `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`
- **renderImagePreview()**: Display `<img>` tag instead of text
- **Upload button**: Appears on right side when viewing image
- **History list**: Below image, click to generate comparison

### Prompts Panel Extension
**New Prompt**: "Generate UI Adjustment Recommendations"
```javascript
{
  id: 'comparison-analysis',
  title: 'Analyze Design vs Implementation',
  icon: '🔍',
  text: `Based on the comparison image at "${comparisonUrl}", analyze...`
}
```

## pageview_map.json Structure Update

### Clean Up Meaningless Fields
**Remove**:
- Old `images` array (migrated to `expected_images`)
- Empty `comparison_notes`
- Redundant `image_type` (inferred from array)

**Keep**:
- `expected_images`: Design mockups
- `actual_images`: Implementation screenshots
- `comparison_notes`: AI recommendations (when filled)
- `color_palette`: Top 10 colors
- `ocr_text`: Extracted text with positions
- `download_url`: Direct file access

## Implementation Files

### Backend
- `utils/comparison_manager.py` ✅ Created
- `api/comparison_api.py` - To create
- `main.py` - Add comparison endpoints

### Frontend
- `static/js/file-viewer.js` - Add image preview
- `static/js/comparison-uploader.js` - New component
- `static/js/prompts-panel.js` - Add comparison prompt
- `static/css/image-viewer.css` - New styles

### Documentation
- `development-guides/FLUTTER_GUIDE.md` - Update with comparison system
- `doc/FLUTTER_UP.md` - Record changes

## Usage Workflow

1. **Select Design Image**: Click image in file tree
2. **View in Middle Panel**: Image displays with preview
3. **Upload Actual Image**: Click "Upload Comparison" button
4. **Select from History**: Or click existing comparison from list
5. **Generate Composite**: System creates side-by-side comparison
6. **Get AI Prompt**: Prompt panel updates with comparison URL
7. **Copy Prompt**: One-click copy to share with AI
8. **Implement Adjustments**: AI provides Flutter code changes

## Benefits

- ✅ Visual comparison of expected vs actual
- ✅ Historical tracking of all comparisons
- ✅ AI-ready prompts with context
- ✅ Automatic color and OCR analysis
- ✅ External storage (doesn't clutter design docs)
- ✅ Persistent history (never auto-deleted)
