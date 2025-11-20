# MCP Services Consolidation - Design Plan

## 1. Architecture Overview

```
/www/programing/core_node/
├── pyapps/mcp/                          # MCP Application - IMPORT ALL and organizational logic ONLY
│   ├── __init__.py
│   ├── main.py                          # MCP server entry point (imports from pycore, provides MCP protocol)
│
├── pycore/pyutils/mcp/file_processing/  # Library code - ALL implementations here
│   ├── __init__.py
│   ├── file_info_extractor_with_ocr_text_positions_color_palette_and_metadata.py
│   ├── image_analyzer_with_ocr_color_extraction_and_pixel_matrix.py
│   ├── document_parser_with_text_positions_and_metadata_extraction.py
│   ├── placeholder_image_generator_with_ocr_based_replacement.py
│   ├── color_palette_extractor_with_dominant_colors_and_histogram.py
│   └── database_manager_for_file_info_caching_and_history.py
│
└── pycore/pyutils/ocr/                  # Existing OCR utilities (keep and extend)
    ├── ocr_manager.py                   # Singleton OCR manager
    └── ...                              # Existing OCR files
```

## 2. Core Functionality: Unified Method with Long Descriptive Names

### Main Method Name (Expresses ALL Available Information):
```python
async def get_file_comprehensive_info_with_ocr_text_positions_color_palette_document_metadata_pixel_analysis_and_processing_stats(
    file_path: str,
    options: Dict[str, Any] = None
) -> Dict[str, Any]
```

**Shortened Alias (Still Descriptive):**
```python
# Alias for convenience
get_file_info_with_ocr_and_document_parsing = get_file_comprehensive_info_with_ocr_text_positions_color_palette_document_metadata_pixel_analysis_and_processing_stats
```

### Return Structure (Comprehensive):
```python
{
    "file_type": "image|pdf|office|text|unknown",
    "file_path": str,
    "file_size_bytes": int,
    "mime_type": str,
    "file_hash_sha256": str,

    # Image-specific fields (when file_type == "image")
    "image_comprehensive_analysis": {
        "dimensions": {
            "width_pixels": int,
            "height_pixels": int,
            "aspect_ratio": float
        },
        "format_info": {
            "format": str,              # PNG, JPEG, etc.
            "mode": str,                # RGB, RGBA, etc.
            "color_depth_bits": int,
            "has_transparency": bool
        },
        "ocr_full_text_extraction": {
            "full_text": str,
            "total_characters": int,
            "total_words": int,
            "language_detected": str,
            "confidence_average": float
        },
        "ocr_text_with_bounding_box_positions": [
            {
                "text": str,
                "bounding_box_coordinates": {
                    "x1": int, "y1": int,
                    "x2": int, "y2": int
                },
                "confidence_score": float,
                "line_number": int,
                "word_index": int
            }
        ],
        "color_palette_analysis": {
            "dominant_colors_rgb_top_10": [
                {
                    "rgb": [R, G, B],
                    "hex": "#RRGGBB",
                    "percentage": float,
                    "color_name": str
                }
            ],
            "color_palette_quantized": [
                {"rgb": [R, G, B], "hex": "#RRGGBB"}
            ],
            "color_histogram_statistics": {
                "red_channel": {"mean": float, "std": float, "min": int, "max": int},
                "green_channel": {"mean": float, "std": float, "min": int, "max": int},
                "blue_channel": {"mean": float, "std": float, "min": int, "max": int}
            },
            "brightness_analysis": {
                "average_brightness": float,
                "is_dark_image": bool,
                "is_bright_image": bool
            }
        },
        "pixel_matrix_data_optional": {
            "available": bool,
            "dimensions": [width, height],
            "sample_data": [[...]]  # Optional: subset of pixel data
        }
    },

    # Document-specific fields (when file_type in ["pdf", "docx", "xlsx", "pptx"])
    "document_comprehensive_parsing": {
        "document_type": str,
        "total_pages": int,
        "full_text_content": str,
        "text_extraction_with_page_positions": [
            {
                "page_number": int,
                "text_content": str,
                "bounding_box_coordinates": {
                    "x1": float, "y1": float,
                    "x2": float, "y2": float
                },
                "font_info": {
                    "font_family": str,
                    "font_size": float,
                    "is_bold": bool,
                    "is_italic": bool
                }
            }
        ],
        "document_metadata_extraction": {
            "title": str,
            "author": str,
            "subject": str,
            "keywords": List[str],
            "created_date": str,
            "modified_date": str,
            "application_name": str,
            "total_words": int,
            "total_characters": int
        },
        "embedded_images_analysis": [
            {
                "image_index": int,
                "page_number": int,
                "image_format": str,
                "dimensions": {"width": int, "height": int},
                "file_size_bytes": int,
                "extracted_image_path": str  # Temp path to extracted image
            }
        ],
        "tables_extraction": [
            {
                "table_index": int,
                "page_number": int,
                "rows": int,
                "columns": int,
                "data": [[...]]  # 2D array of cell values
            }
        ],
        "hyperlinks_extraction": [
            {
                "text": str,
                "url": str,
                "page_number": int
            }
        ]
    },

    # Office-specific fields (Excel)
    "excel_spreadsheet_analysis": {
        "total_sheets": int,
        "sheets_data": [
            {
                "sheet_name": str,
                "sheet_index": int,
                "total_rows": int,
                "total_columns": int,
                "data_range": str,  # e.g., "A1:Z100"
                "cell_data": [[...]],
                "formulas": [
                    {"cell": str, "formula": str}
                ]
            }
        ]
    },

    # Processing metadata
    "processing_comprehensive_stats": {
        "processing_timestamp_utc": str,
        "processing_duration_seconds": float,
        "processing_methods_applied": [
            "ocr_text_extraction",
            "color_palette_analysis",
            "document_metadata_extraction",
            "text_position_mapping"
        ],
        "processing_engine_versions": {
            "ocr_engine": str,
            "pdf_parser": str,
            "image_processor": str
        },
        "errors_and_warnings": [
            {
                "severity": "error|warning",
                "message": str,
                "component": str
            }
        ],
        "cache_status": {
            "was_cached": bool,
            "cache_key": str,
            "cache_timestamp": str
        }
    }
}
```

## 3. Method Naming Convention (ALL Methods Use Long Descriptive Names)

### Image Processing Methods:
```python
# Core method
async def extract_image_comprehensive_info_with_ocr_text_positions_color_palette_dimensions_and_pixel_analysis(
    image_path: str,
    include_pixel_matrix: bool = False,
    ocr_engine: str = "cnocr"
) -> Dict[str, Any]

# OCR methods
async def perform_optical_character_recognition_with_bounding_boxes_confidence_scores_and_language_detection(
    image_path: str,
    model_type: str = "general"
) -> Dict[str, Any]

# Color analysis methods
async def extract_color_palette_with_dominant_colors_histogram_statistics_and_brightness_analysis(
    image_path: str,
    num_colors: int = 10
) -> Dict[str, Any]

async def analyze_pixel_data_and_generate_color_matrix_with_rgb_values(
    image_path: str
) -> Dict[str, Any]
```

### Document Processing Methods:
```python
# PDF methods
async def parse_pdf_document_with_text_extraction_metadata_images_tables_and_hyperlinks(
    pdf_path: str,
    extract_images: bool = True,
    extract_tables: bool = True
) -> Dict[str, Any]

async def extract_text_from_pdf_pages_with_bounding_box_positions_and_font_information(
    pdf_path: str
) -> Dict[str, Any]

# Office document methods
async def parse_word_document_with_text_paragraphs_styles_images_and_metadata(
    docx_path: str
) -> Dict[str, Any]

async def parse_excel_spreadsheet_with_sheets_cells_formulas_and_data_ranges(
    xlsx_path: str
) -> Dict[str, Any]

async def parse_powerpoint_presentation_with_slides_text_images_and_speaker_notes(
    pptx_path: str
) -> Dict[str, Any]
```

### Placeholder Generation Methods:
```python
async def generate_placeholder_image_with_ocr_text_replacement_and_custom_styling(
    original_image_path: str,
    output_path: str,
    placeholder_text: str = None,
    style_options: Dict[str, Any] = None
) -> Dict[str, Any]

async def replace_images_in_document_with_ocr_based_placeholder_generation(
    document_path: str,
    output_path: str
) -> Dict[str, Any]
```

### Database Methods:
```python
async def save_file_info_to_database_with_caching_and_version_tracking(
    file_path: str,
    file_info: Dict[str, Any]
) -> bool

async def retrieve_cached_file_info_from_database_by_path_or_hash(
    file_path: str = None,
    file_hash: str = None
) -> Optional[Dict[str, Any]]

async def query_file_processing_history_with_filters_and_pagination(
    file_type: str = None,
    date_from: str = None,
    date_to: str = None,
    limit: int = 100,
    offset: int = 0
) -> Dict[str, Any]
```

## 4. Migration Strategy

### Phase 1: Core Utilities Implementation
**Location:** `/www/programing/core_node/pycore/pyutils/mcp/`

1. **file_info_extractor_with_ocr_text_positions_color_palette_and_metadata.py**
   - Main unified entry point
   - Auto-detect file type
   - Route to appropriate processor
   - Consolidate from: `file_processor/main.py`

2. **image_analyzer_with_ocr_color_extraction_and_pixel_matrix.py**
   - Image OCR processing
   - Color palette extraction
   - Pixel matrix analysis
   - Consolidate from: `file_processor/image_processor.py`, `image_tools.py`
   - Integrate with: `pycore/pyutils/ocr/ocr_manager.py`

3. **document_parser_with_text_positions_and_metadata_extraction.py**
   - PDF text extraction with positions
   - Office document parsing
   - Metadata extraction
   - Table and image extraction
   - Consolidate from: `file_processor/pdf_processor.py`

4. **placeholder_image_generator_with_ocr_based_replacement.py**
   - OCR-based placeholder generation
   - Smart image replacement
   - Consolidate from: `placeholder_image_generator/main.py`

5. **color_palette_extractor_with_dominant_colors_and_histogram.py**
   - Dominant color extraction
   - Color histogram analysis
   - Brightness analysis
   - Color naming

6. **database_manager_for_file_info_caching_and_history.py**
   - SQLite-based caching
   - File hash tracking
   - Processing history
   - Query methods

### Phase 2: MCP Application Implementation
**Location:** `/www/programing/core_node/pyapps/mcp/`

1. **main.py** - MCP server entry
   - Follow FastMCP pattern
   - Register all tools
   - Handle MCP protocol
   - Follow `python ./pymain.py app=mcp` pattern

2. **tools/file_info_with_ocr_and_document_parsing_tool.py**
   - MCP tool wrapper
   - Parameter validation
   - Result formatting

3. **tools/placeholder_image_generation_with_ocr_replacement_tool.py**
   - Placeholder generation tool

4. **tools/codebase_scanner_with_dependency_analysis_tool.py**
   - Consolidate from: `codebase-scanner/main.py`

5. **tools/ai_collaboration_context_management_tool.py**
   - Consolidate from: `ai_collaboration/main.py`

## 5. Key Design Principles

### Naming Convention:
- **ALL method names must be VERY LONG and DESCRIPTIVE**
- Method names should express ALL available information and features
- Use underscores to separate concepts
- Include input types, output types, and processing methods in name

### Separation of Concerns:
- **pycore/pyutils/mcp/** = Pure business logic (no MCP protocol)
- **pyapps/mcp/** = MCP protocol layer (thin wrappers)

### Code Reuse:
- Extend existing `pycore/pyutils/ocr/ocr_manager.py`
- Import existing OCR engines
- Consolidate duplicate code from multiple MCP servers

### Performance:
- Database caching for processed files
- Parallel processing where possible
- Smart image preprocessing

### Error Handling:
- Graceful degradation
- Detailed error reporting
- Continue processing even if some methods fail

## 6. Consolidated Features From Existing MCP Servers

**From file_processor:**
- ✅ PDF text extraction and OCR
- ✅ Office document parsing (DOCX, XLSX, PPTX)
- ✅ XMind mind map parsing
- ✅ Image OCR with bounding boxes
- ✅ Smart image preprocessing for OCR
- ✅ OCR queue system with priority
- ✅ Code scanning capabilities
- ✅ Pixel matrix analysis

**From placeholder_image_generator:**
- ✅ OCR placeholder replacement
- ✅ Smart placeholder generation

**From existing pycore/pyutils/ocr:**
- ✅ CnOCR engine integration
- ✅ Model management
- ✅ Batch processing

**New unified features:**
- ✅ Single entry point with long descriptive name
- ✅ Color extraction and palette generation
- ✅ Text position tracking for all formats
- ✅ Database caching for performance
- ✅ Comprehensive metadata extraction
- ✅ Streamlined API with consistent format

## 7. Benefits

1. **Single comprehensive entry point** - One method handles all file types
2. **Consistent interface** - Same response format for all files
3. **Very long descriptive method names** - Expresses all functionality
4. **Code reuse** - Shared utilities in pycore/pyutils/mcp/
5. **Better performance** - Database caching, parallel processing
6. **Easier maintenance** - Consolidated codebase
7. **Follows project patterns** - `python ./pymain.py app=mcp`
8. **Complete information** - Returns ALL available data for each file type

## 8. Implementation Order

1. Create directory structure ✅
2. Implement core utilities (pycore/pyutils/mcp/)
   - Start with `file_info_extractor_with_ocr_text_positions_color_palette_and_metadata.py`
   - Add `image_analyzer_with_ocr_color_extraction_and_pixel_matrix.py`
   - Add `document_parser_with_text_positions_and_metadata_extraction.py`
   - Add `color_palette_extractor_with_dominant_colors_and_histogram.py`
   - Add `placeholder_image_generator_with_ocr_based_replacement.py`
   - Add `database_manager_for_file_info_caching_and_history.py`
3. Implement MCP application (pyapps/mcp/)
   - Create `main.py` following pymain.py pattern
   - Implement tools with long descriptive names
4. Testing and validation
5. Migrate/deprecate old MCP servers

---

**Status:** Ready for implementation
**Next Step:** Implement Phase 1 core utilities

notice lib should be realized in /www/programing/core_node/pycore/pyutils/mcp , 
/www/programing/core_node/pyapps/mcp folder is just organizational logic. 

 following /www/programing/core_node/development-guides/PYTHON_PYCORE_BASE_GUIDE_TH
IS_FILE_NO_AI_EDIT.md specification , Not hard coding abs-path, and need use 
/www/programing/core_node/pycore/pyfoundations/color_print.py 
