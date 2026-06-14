"""
OCR and Organization Example - Quick Start Guide

This example demonstrates how to use the ocr_and_organize function
to extract text from images and organize it into coherent content.
"""

from pycore.pyutils.ai_cluster.gemini import gemini_manager


def example_basic_ocr():
    """Basic OCR and organization example"""
    print("=" * 70)
    print("Example 1: Basic OCR and Organization")
    print("=" * 70)

    # Replace with your image path
    image_path = "path/to/your/document-image.jpg"

    # Extract and organize text with default settings
    result = gemini_manager.ocr_and_organize(
        image_path=image_path
    )

    if result['success']:
        print("\n✅ Success!")
        print(f"⏱️  Processing time: {result['processing_time']:.2f}s")
        print(f"📝 Model used: {result['model']}")

        print("\n📄 Raw Extracted Text:")
        print("-" * 70)
        print(result['raw_text'])

        print("\n✨ Organized Text:")
        print("-" * 70)
        print(result['organized_text'])
    else:
        print(f"❌ Error: {result['error']}")


def example_structured_organization():
    """Example with structured organization"""
    print("\n" + "=" * 70)
    print("Example 2: Structured Organization")
    print("=" * 70)

    image_path = "path/to/your/notes-image.jpg"

    # Organize into clear sections with headings
    result = gemini_manager.ocr_and_organize(
        image_path=image_path,
        organization_type="structured"
    )

    if result['success']:
        print("\n✨ Organized with Structure:")
        print("-" * 70)
        print(result['organized_text'])


def example_preserve_format():
    """Example with format preservation"""
    print("\n" + "=" * 70)
    print("Example 3: Preserve Original Format")
    print("=" * 70)

    image_path = "path/to/your/formatted-doc.jpg"

    # Extract and organize while preserving layout
    result = gemini_manager.ocr_and_organize(
        image_path=image_path,
        organization_type="cleaned",
        preserve_format=True
    )

    if result['success']:
        print("\n✨ Organized (format preserved):")
        print("-" * 70)
        print(result['organized_text'])


def example_outline():
    """Example creating an outline"""
    print("\n" + "=" * 70)
    print("Example 4: Create Outline")
    print("=" * 70)

    image_path = "path/to/your/presentation-slide.jpg"

    # Create hierarchical outline from image text
    result = gemini_manager.ocr_and_organize(
        image_path=image_path,
        organization_type="outline"
    )

    if result['success']:
        print("\n✨ Outline:")
        print("-" * 70)
        print(result['organized_text'])


def example_categorized():
    """Example with categorization"""
    print("\n" + "=" * 70)
    print("Example 5: Categorized Organization")
    print("=" * 70)

    image_path = "path/to/your/mixed-content.jpg"

    # Organize by categorizing information
    result = gemini_manager.ocr_and_organize(
        image_path=image_path,
        organization_type="categorized"
    )

    if result['success']:
        print("\n✨ Categorized Content:")
        print("-" * 70)
        print(result['organized_text'])


def example_json_output():
    """Example with JSON output"""
    print("\n" + "=" * 70)
    print("Example 6: JSON Output")
    print("=" * 70)

    image_path = "path/to/your/image.jpg"

    # Get result as JSON string
    result_json = gemini_manager.ocr_and_organize(
        image_path=image_path,
        return_json=True
    )

    print("\n📦 JSON Output:")
    print(result_json)


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("🚀 Gemini OCR and Organization - Quick Start Examples")
    print("=" * 70)
    print("\n📌 Note: Replace image paths with your actual file paths")
    print()

    # Run examples (uncomment after providing valid image paths)
    # example_basic_ocr()
    # example_structured_organization()
    # example_preserve_format()
    # example_outline()
    # example_categorized()
    # example_json_output()

    print("\n" + "=" * 70)
    print("✅ Examples complete!")
    print("💡 Tip: Uncomment examples and provide image paths to test")
    print("=" * 70)


"""
Common Use Cases:

1. Photo of handwritten notes → Clean digital text
2. Screenshot of code → Formatted code with proper indentation
3. Scanned document → Structured document with sections
4. Presentation slide → Outlined bullet points
5. Receipt/Invoice → Organized transaction details
6. Whiteboard photo → Structured meeting notes
7. Book page → Formatted text with paragraphs
8. Form/Questionnaire → Categorized responses

Organization Types:

- cleaned: Fix grammar, improve readability (best for most cases)
- structured: Add headings and sections (good for documents)
- outline: Create hierarchical structure (good for presentations)
- categorized: Group by topic (good for mixed content)

Tips:

1. Use clear, well-lit photos for best OCR results
2. Set preserve_format=True for tables or formatted layouts
3. Use "structured" for multi-topic documents
4. Use "cleaned" for simple text cleanup
5. The model automatically handles multiple languages
"""
