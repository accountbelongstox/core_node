# Gemini Utility

Google Gemini API integration for pycore.

## Overview

The Gemini utility provides a unified interface to the Google Gemini API with automatic API key loading from the secret manager. It follows the pycore standards with singleton pattern and lazy loading.

## Features

- **Text Generation**: Generate text content using Gemini models
- **Vision API**: Generate content with images (multi-modal)
- **Object Recognition**: Identify and locate objects in images with coordinates
- **Image Summarization**: Generate descriptions and summaries of images
- **Text Summarization**: Summarize text in various formats
- **Text Organization**: Structure and organize text content
- **OCR and Organization** (NEW): Extract text from images and organize it into coherent content
- **Model Management**: List and switch between available Gemini models
- **Automatic API Key Loading**: Seamlessly loads API keys from secret manager
- **Error Handling**: Comprehensive error handling with detailed error messages
- **JSON Output**: Optional JSON string output for API responses
- **Configuration**: Customizable generation parameters (temperature, top_p, top_k, max_output_tokens)

## Installation

The `google-genai` package is automatically installed when first imported through the third_party lazy loading system.

## API Key Setup

1. Place your Google API key in `.secret_keys/.secret_ignore/GOOGLE_API_KEY_1`
2. Or use the secret manager to decrypt encrypted API keys

## Usage

### Basic Text Generation

```python
from pycore.pyutils.gemini import gemini_manager

# Simple generation
result = gemini_manager.generate_content(
    prompt="Explain how AI works in a few words"
)

if result['success']:
    print(result['text'])
else:
    print(f"Error: {result['error']}")
```

### Advanced Generation with Parameters

```python
result = gemini_manager.generate_content(
    prompt="Write a haiku about programming",
    model="gemini-2.5-flash",
    temperature=0.8,
    max_output_tokens=100,
    top_p=0.9,
    top_k=40
)
```

### Object Recognition (NEW)

```python
# Recognize objects in an image and get their coordinates
result = gemini_manager.recognize_objects(
    image_path="path/to/image.jpg",
    max_objects=10
)

if result['success']:
    for obj in result['objects']:
        print(f"{obj['label']} at point {obj['point']}")
```

### Image Summarization (NEW)

```python
# Generate a summary of an image
result = gemini_manager.summarize_image(
    image_path="path/to/image.jpg",
    detail_level="medium"  # brief, medium, detailed
)

if result['success']:
    print(result['summary'])
```

### Text Summarization (NEW)

```python
# Summarize text content
long_text = """
Your long text here...
"""

result = gemini_manager.summarize_text(
    text=long_text,
    summary_type="paragraph",  # paragraph, bullet_points, key_points
    max_length=100  # optional
)

if result['success']:
    print(f"Original: {result['original_length']} chars")
    print(f"Summary: {result['summary']}")
```

### Text Organization (NEW)

```python
# Organize and structure text
messy_text = """
Your unorganized text here...
"""

result = gemini_manager.organize_text(
    text=messy_text,
    organization_type="structured"  # structured, categorized, outline, cleaned
)

if result['success']:
    print(result['organized_text'])
```

### OCR and Organization (NEW - 核心功能)

```python
# Extract text from image and organize it into coherent content
# This is a combined operation: OCR + Text Organization
result = gemini_manager.ocr_and_organize(
    image_path="path/to/document-image.jpg",
    organization_type="cleaned",  # structured, categorized, outline, cleaned
    preserve_format=False  # Set True to preserve original layout
)

if result['success']:
    print("Raw extracted text:")
    print(result['raw_text'])
    print("\nOrganized text:")
    print(result['organized_text'])
    print(f"\nProcessing time: {result['processing_time']:.2f}s")
```

**Use Cases for OCR and Organization:**
- Extract and organize text from photos of documents
- Convert handwritten notes to clean digital text
- Extract text from screenshots and format it properly
- Process scanned documents and make them readable
- Convert presentation slides to structured text

### Vision API (Multi-modal)

```python
result = gemini_manager.generate_with_images(
    prompt="What's in this image?",
    image_paths=["path/to/image1.jpg", "path/to/image2.jpg"],
    model="gemini-2.5-flash"
)
```

### List Available Models

```python
models = gemini_manager.list_models()
if models['success']:
    for model in models['models']:
        print(model)
```

### JSON Output

```python
result_json = gemini_manager.generate_content(
    prompt="What is the capital of France?",
    return_json=True
)
# Returns JSON string instead of dictionary
```

### Client Information

```python
info = gemini_manager.get_client_info()
print(f"Loaded Clients: {info['loaded_clients']}")
print(f"Default Model: {info['default_model']}")
```

### Using Multiple API Keys

```python
# Use specific API key
result = gemini_manager.generate_content(
    prompt="Hello",
    api_key_name="GOOGLE_API_KEY_2"
)
```

## API Reference

### `gemini_manager.generate_content()`

Generate text content using Gemini API.

**Parameters:**
- `prompt` (str): Text prompt for generation
- `model` (str, optional): Model to use (default: "gemini-2.5-flash")
- `api_key_name` (str, optional): Name of API key in secret manager
- `max_output_tokens` (int, optional): Maximum tokens to generate
- `temperature` (float, optional): Sampling temperature (0.0 to 2.0)
- `top_p` (float, optional): Top-p sampling parameter
- `top_k` (int, optional): Top-k sampling parameter
- `return_json` (bool): Return JSON string instead of dict

**Returns:**
```python
{
    "success": bool,
    "text": str,
    "model": str,
    "processing_time": float,
    "error": str
}
```

### `gemini_manager.recognize_objects()`

Recognize objects in an image and return their locations.

**Parameters:**
- `image_path` (str): Path to image file
- `max_objects` (int): Maximum number of objects to identify (default: 10)
- `model` (str, optional): Model to use
- `api_key_name` (str, optional): Name of API key in secret manager
- `return_json` (bool): Return JSON string instead of dict

**Returns:**
```python
{
    "success": bool,
    "objects": List[{"point": [y, x], "label": str}],  # normalized 0-1000
    "model": str,
    "processing_time": float,
    "error": str
}
```

### `gemini_manager.summarize_image()`

Generate a summary of an image.

**Parameters:**
- `image_path` (str): Path to image file
- `detail_level` (str): Level of detail (brief, medium, detailed)
- `model` (str, optional): Model to use
- `api_key_name` (str, optional): Name of API key in secret manager
- `return_json` (bool): Return JSON string instead of dict

**Returns:**
```python
{
    "success": bool,
    "summary": str,
    "model": str,
    "processing_time": float,
    "error": str
}
```

### `gemini_manager.summarize_text()`

Summarize text content.

**Parameters:**
- `text` (str): Text to summarize
- `summary_type` (str): Type of summary (paragraph, bullet_points, key_points)
- `max_length` (int, optional): Maximum length of summary in words
- `model` (str, optional): Model to use
- `api_key_name` (str, optional): Name of API key in secret manager
- `return_json` (bool): Return JSON string instead of dict

**Returns:**
```python
{
    "success": bool,
    "summary": str,
    "original_length": int,
    "summary_length": int,
    "model": str,
    "processing_time": float,
    "error": str
}
```

### `gemini_manager.organize_text()`

Organize and structure text content.

**Parameters:**
- `text` (str): Text to organize
- `organization_type` (str): Type of organization (structured, categorized, outline, cleaned)
- `model` (str, optional): Model to use
- `api_key_name` (str, optional): Name of API key in secret manager
- `return_json` (bool): Return JSON string instead of dict

**Returns:**
```python
{
    "success": bool,
    "organized_text": str,
    "model": str,
    "processing_time": float,
    "error": str
}
```

### `gemini_manager.ocr_and_organize()` (NEW)

Extract text from image and organize it into coherent content.

This is a combined operation that:
1. Extracts all text from the image using OCR
2. Organizes and structures the text to make it coherent and readable

**Parameters:**
- `image_path` (str): Path to image file
- `organization_type` (str): Type of organization (structured, categorized, outline, cleaned)
  - `cleaned`: Clean up text, fix grammar, improve readability (default)
  - `structured`: Organize into sections with headings
  - `categorized`: Group information into logical categories
  - `outline`: Create hierarchical outline
- `preserve_format` (bool): Try to preserve original layout/formatting (default: False)
- `model` (str, optional): Model to use
- `api_key_name` (str, optional): Name of API key in secret manager
- `return_json` (bool): Return JSON string instead of dict

**Returns:**
```python
{
    "success": bool,
    "raw_text": str,  # Extracted text before organization
    "organized_text": str,  # Cleaned and organized text
    "model": str,
    "processing_time": float,
    "error": str
}
```

**Example:**
```python
result = gemini_manager.ocr_and_organize(
    image_path="document.jpg",
    organization_type="cleaned",
    preserve_format=False
)

if result['success']:
    print(f"Raw: {result['raw_text']}")
    print(f"Organized: {result['organized_text']}")
```

### `gemini_manager.generate_with_images()`

Generate content with images using Gemini Vision API.

**Parameters:**
- `prompt` (str): Text prompt for generation
- `image_paths` (List[str]): List of image file paths
- `model` (str, optional): Model to use
- `api_key_name` (str, optional): Name of API key in secret manager
- `return_json` (bool): Return JSON string instead of dict

**Returns:** Same format as `generate_content()`

### `gemini_manager.list_models()`

List available Gemini models.

**Parameters:**
- `api_key_name` (str, optional): Name of API key in secret manager
- `return_json` (bool): Return JSON string instead of dict

**Returns:**
```python
{
    "success": bool,
    "models": List[str],
    "error": str
}
```

### `gemini_manager.set_default_model()`

Set default model for new clients.

**Parameters:**
- `model` (str): Model name to set as default

**Returns:** `bool` - True if successful

### `gemini_manager.get_client_info()`

Get information about loaded clients.

**Parameters:**
- `api_key_name` (str, optional): Get info for specific client

**Returns:**
```python
{
    "loaded_clients": List[str],
    "default_api_key_name": str,
    "default_model": str
}
```

## Architecture

### Directory Structure

```
pycore/pyutils/gemini/
├── __init__.py              # Exports gemini_manager singleton
├── gemini_manager.py        # Manager with API key handling
├── gemini_client.py         # Core client wrapper
├── example_usage.py         # Usage examples
└── README.md                # This file
```

### Components

1. **GeminiClient** (`gemini_client.py`): Core wrapper around Google Gemini API
2. **GeminiManager** (`gemini_manager.py`): Singleton manager with API key loading
3. **gemini_manager** (`__init__.py`): Exported singleton instance

## Development Standards

This utility follows pycore development standards:

- ✅ Singleton pattern with exported instance
- ✅ Lazy loading through third_party system
- ✅ Secret manager integration for API keys
- ✅ No try-except blocks in AI-generated code
- ✅ ColorPrint for user feedback
- ✅ Absolute imports from pycore packages
- ✅ JSON-serializable return values

## Feature Comparison

| Feature | Description | Input | Output |
|---------|-------------|-------|--------|
| **Text Generation** | Generate text from prompts | Text | Text |
| **Vision API** | Multi-modal generation | Text + Images | Text |
| **Object Recognition** | Identify objects in images | Image | JSON (points + labels) |
| **Image Summary** | Describe image content | Image | Text summary |
| **Text Summary** | Summarize text content | Text | Text summary |
| **Text Organization** | Structure text | Text | Organized text |
| **OCR and Organization** | Extract and organize text from images | Image | Raw text + Organized text |

## Error Handling

All functions return a dictionary with `success` field:
- `success=True`: Operation completed successfully
- `success=False`: Error occurred, check `error` field for details

No exceptions are raised - errors are returned in the result dictionary.

## Example Script

Run the example script to see all features in action:

```bash
python pycore/pyutils/gemini/example_usage.py
```

## References

- [Google Gemini API Quickstart](https://ai.google.dev/gemini-api/docs/quickstart)
- [Google Gemini Models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini Robotics-ER 1.5](https://ai.google.dev/gemini-api/docs/models/gemini-robotics)
- pycore Development Guide: `development-guides/PYTHON_PYCORE.md`
