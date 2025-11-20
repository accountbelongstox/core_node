# MCP File Processing Server - Usage Guide

## Quick Start

### Launch the MCP Server

```bash
# From project root
python ./pymain.py app=mcp

# Or directly
python -m pyapps.mcp.main

# Or full path
python /www/programing/core_node/pyapps/mcp/main.py
```

## Available MCP Tools

### 1. Get File Information with OCR and Document Parsing

Comprehensive file analysis for images, PDFs, and Office documents.

**Tool Name:** `get_file_info_with_ocr_and_document_parsing_tool`

**Parameters:**
- `file_path` (str, required): Path to file to analyze
- `use_cache` (bool, default: True): Use database caching
- `include_pixel_matrix` (bool, default: False): Include full pixel matrix for images
- `ocr_model_type` (str, default: "general"): OCR model type
  - Options: "scene", "doc", "number", "general", "english", "chinese_traditional"
- `num_colors` (int, default: 10): Number of dominant colors to extract
- `extract_images` (bool, default: True): Extract embedded images from documents
- `extract_tables` (bool, default: True): Extract tables from documents
- `extract_hyperlinks` (bool, default: True): Extract hyperlinks from PDFs

**Returns:**
```json
{
  "file_path": "/path/to/file.png",
  "file_type": "image",
  "file_size_bytes": 12345,

  // For images:
  "ocr_result": {
    "text": "Detected text...",
    "text_positions": [
      {
        "text": "Word",
        "position": [x1, y1, x2, y2],
        "confidence": 0.95
      }
    ]
  },
  "color_analysis": {
    "dominant_colors_rgb_top_10": [
      {"color": [255, 0, 0], "percentage": 45.2},
      {"color": [0, 255, 0], "percentage": 30.1}
    ],
    "color_palette_quantized": [[255, 0, 0], [0, 255, 0]],
    "color_histogram_statistics": {...},
    "brightness_analysis": {...}
  },
  "dimensions": {"width": 1920, "height": 1080},

  // For documents:
  "document_metadata": {
    "title": "Document Title",
    "author": "Author Name",
    "pages": 10
  },
  "text_content": "Full extracted text...",
  "text_positions": [...],
  "tables": [...],
  "images": [...],
  "hyperlinks": [...]
}
```

### 2. Generate Placeholder Image with OCR

Generate placeholder images using OCR text from original images.

**Tool Name:** `generate_placeholder_image_with_ocr_tool`

**Parameters:**
- `original_image_path` (str, required): Path to original image
- `output_path` (str, required): Path to save placeholder image
- `placeholder_text` (str, optional): Override text (if None, uses OCR from original)
- `background_color` (str, default: "#CCCCCC"): Background color hex
- `text_color` (str, default: "#333333"): Text color hex
- `font_size` (int, default: 20): Font size

**Returns:**
```json
{
  "success": true,
  "original_image_path": "/path/to/original.png",
  "placeholder_image_path": "/path/to/placeholder.png",
  "placeholder_text": "Text used for placeholder",
  "dimensions": {"width": 1920, "height": 1080},
  "style_used": {
    "background_color": "#CCCCCC",
    "text_color": "#333333",
    "font_size": 20
  },
  "processing_stats": {
    "processing_timestamp_utc": "2025-11-16T05:00:00",
    "processing_duration_seconds": 1.234
  }
}
```

### 3. Query File Processing History

Query cached file processing history with filtering and pagination.

**Tool Name:** `query_file_processing_history_tool`

**Parameters:**
- `file_type` (str, optional): Filter by file type
  - Options: "image", "pdf", "docx", "xlsx", "pptx"
- `date_from` (str, optional): Start date filter (ISO format: "2025-11-16T00:00:00")
- `date_to` (str, optional): End date filter (ISO format)
- `limit` (int, default: 100): Maximum number of results
- `offset` (int, default: 0): Offset for pagination

**Returns:**
```json
{
  "results": [
    {
      "file_path": "/path/to/file.png",
      "file_type": "image",
      "processing_timestamp": "2025-11-16T05:00:00",
      "file_info": {...}
    }
  ],
  "total_count": 150,
  "limit": 100,
  "offset": 0,
  "has_more": true
}
```

### 4. Clear File Cache

Clear cached file information from database.

**Tool Name:** `clear_file_cache_tool`

**Parameters:**
- `file_path` (str, optional): Specific file path to clear
  - If None, clears all cache (requires confirmation)

**Returns:**
```json
{
  "success": true,
  "message": "Cache cleared for file: /path/to/file.png",
  "files_cleared": 1
}
```

## Supported File Types

### Images
- PNG, JPG, JPEG, BMP, GIF, TIFF
- Features: OCR, color analysis, pixel matrix, dimensions

### PDF Documents
- Features: Text extraction with positions, metadata, tables, images, hyperlinks

### Microsoft Office Documents

**Word (.docx)**
- Features: Paragraphs, styles, metadata, tables, images

**Excel (.xlsx)**
- Features: Sheets, cells, formulas, metadata

**PowerPoint (.pptx)**
- Features: Slides, shapes, speaker notes, metadata

## Database Caching

The system uses SQLite for caching processed file information:

**Cache Location:** `{PYTOOLS_TMP_DIR}/mcp_file_info_cache.db`

**Cache Key:** SHA256 hash of file path + file content

**Cache Invalidation:** Automatic on file modification

**Tables:**
- `file_info_cache`: Cached file analysis results
- `processing_history`: Historical processing records

## OCR Models

Available OCR model types:
- `general`: General purpose (default)
- `scene`: Scene text (photos, natural images)
- `doc`: Document text (scanned documents)
- `number`: Number recognition
- `english`: English text only
- `chinese_traditional`: Traditional Chinese characters

## Color Analysis

**Dominant Colors:**
- K-means clustering algorithm
- Configurable number of colors (default: 10)
- Includes RGB values and percentages

**Color Palette:**
- Quantized palette (16 colors)
- Evenly distributed across color space

**Statistics:**
- RGB channel histograms
- Mean, median, std dev for each channel
- Brightness analysis (luminance formula: 0.299*R + 0.587*G + 0.114*B)

## Integration Examples

### Python Client Example

```python
from fastmcp import Client

async def analyze_document():
    # Connect to MCP server (STDIO transport)
    async with Client("python ./pymain.py app=mcp") as client:

        # Analyze an image with OCR
        result = await client.call_tool(
            "get_file_info_with_ocr_and_document_parsing_tool",
            {
                "file_path": "/path/to/image.png",
                "use_cache": True,
                "ocr_model_type": "general",
                "num_colors": 10
            }
        )

        print(f"Detected text: {result['ocr_result']['text']}")
        print(f"Dominant colors: {result['color_analysis']['dominant_colors_rgb_top_10']}")

        # Generate placeholder
        placeholder_result = await client.call_tool(
            "generate_placeholder_image_with_ocr_tool",
            {
                "original_image_path": "/path/to/image.png",
                "output_path": "/tmp/placeholder.png",
                "background_color": "#F0F0F0",
                "text_color": "#333333"
            }
        )

        print(f"Placeholder created: {placeholder_result['placeholder_image_path']}")

# Run the async function
import asyncio
asyncio.run(analyze_document())
```

### Direct Python Usage (Without MCP)

```python
from pycore.pyutils.mcp.file_processing import (
    get_file_comprehensive_info_with_ocr_text_positions_color_palette_document_metadata_pixel_analysis_and_processing_stats
)
import asyncio

async def analyze_file():
    result = await get_file_comprehensive_info_with_ocr_text_positions_color_palette_document_metadata_pixel_analysis_and_processing_stats(
        file_path="/path/to/file.png",
        options={
            "use_cache": True,
            "include_pixel_matrix": False,
            "ocr_model_type": "general",
            "num_colors": 10
        }
    )

    print(f"File type: {result['file_type']}")
    print(f"OCR text: {result.get('ocr_result', {}).get('text', '')}")

asyncio.run(analyze_file())
```

## Performance Tips

1. **Use Caching:** Enable `use_cache=True` for faster repeated analysis
2. **Pixel Matrix:** Only enable `include_pixel_matrix=True` when needed (large data)
3. **Color Count:** Reduce `num_colors` for faster color analysis
4. **Selective Extraction:** Disable `extract_images`, `extract_tables`, or `extract_hyperlinks` if not needed

## Troubleshooting

### OCR Not Working
- Check cnocr installation: `pip list | grep cnocr`
- Verify image format is supported
- Try different OCR models

### Cache Issues
- Clear cache: Use `clear_file_cache_tool`
- Check database: `{PYTOOLS_TMP_DIR}/mcp_file_info_cache.db`
- Verify file permissions

### Import Errors
- Ensure third_party.py dependencies installed
- Check PYTHONPATH includes project root
- Verify FastMCP installed: `pip list | grep fastmcp`

## Architecture

```
pyapps/mcp/
├── main.py                          # FastMCP server entry point
└── controller/
    └── file_info_controller.py      # Organizational logic

pycore/pyutils/mcp/file_processing/
├── __init__.py                                                    # Exports
├── file_info_extractor_with_ocr_text_positions_color_palette_and_metadata.py  # Main entry
├── image_analyzer_with_ocr_color_extraction_and_pixel_matrix.py              # Image processing
├── document_parser_with_text_positions_and_metadata_extraction.py            # Document parsing
├── color_palette_extractor_with_dominant_colors_and_histogram.py             # Color analysis
├── placeholder_image_generator_with_ocr_based_replacement.py                 # Placeholders
└── database_manager_for_file_info_caching_and_history.py                     # Caching
```

## Further Documentation

- FastMCP v2: https://gofastmcp.com
- Python Pycore Guide: `/www/programing/core_node/development-guides/PYTHON_PYCORE_BASE_GUIDE_THIS_FILE_NO_AI_EDIT.md`
- Design Plan: `/www/programing/core_node/pyapps/mcp/DESIGN_PLAN.md`

