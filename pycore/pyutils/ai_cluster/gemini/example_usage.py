"""
Example usage of the Gemini utility

This example demonstrates how to use the gemini_manager singleton
to interact with the Google Gemini API.
"""

from pycore.pyutils.ai_cluster.gemini.gemini_manager import gemini_manager


def test_generate_content():
    """Test basic text generation"""
    print("=" * 60)
    print("TEST: Generate Content")
    print("=" * 60)

    result = gemini_manager.generate_content(
        prompt="Explain how AI works in a few words"
    )

    print(f"Success: {result['success']}")
    print(f"Model: {result['model']}")
    print(f"Processing Time: {result['processing_time']:.2f}s")
    if result['success']:
        print(f"Generated Text: {result['text']}")
    else:
        print(f"Error: {result['error']}")
    print()


def test_generate_with_parameters():
    """Test text generation with custom parameters"""
    print("=" * 60)
    print("TEST: Generate Content with Custom Parameters")
    print("=" * 60)

    result = gemini_manager.generate_content(
        prompt="Write a haiku about programming",
        temperature=0.8,
        max_output_tokens=100
    )

    print(f"Success: {result['success']}")
    print(f"Model: {result['model']}")
    print(f"Processing Time: {result['processing_time']:.2f}s")
    if result['success']:
        print(f"Generated Text:\n{result['text']}")
    else:
        print(f"Error: {result['error']}")
    print()


def test_recognize_objects():
    """Test object recognition in an image"""
    print("=" * 60)
    print("TEST: Recognize Objects in Image")
    print("=" * 60)

    # Note: Replace with actual image path
    image_path = "path/to/your/image.jpg"

    result = gemini_manager.recognize_objects(
        image_path=image_path,
        max_objects=10
    )

    print(f"Success: {result['success']}")
    print(f"Model: {result['model']}")
    print(f"Processing Time: {result['processing_time']:.2f}s")
    if result['success']:
        print(f"Objects Found ({len(result['objects'])}):")
        for obj in result['objects']:
            print(f"  - {obj['label']} at point {obj['point']}")
    else:
        print(f"Error: {result['error']}")
    print()


def test_summarize_image():
    """Test image summarization"""
    print("=" * 60)
    print("TEST: Summarize Image")
    print("=" * 60)

    # Note: Replace with actual image path
    image_path = "path/to/your/image.jpg"

    # Test different detail levels
    for detail_level in ["brief", "medium", "detailed"]:
        print(f"\n--- Detail Level: {detail_level} ---")
        result = gemini_manager.summarize_image(
            image_path=image_path,
            detail_level=detail_level
        )

        print(f"Success: {result['success']}")
        if result['success']:
            print(f"Summary: {result['summary']}")
        else:
            print(f"Error: {result['error']}")
    print()


def test_summarize_text():
    """Test text summarization"""
    print("=" * 60)
    print("TEST: Summarize Text")
    print("=" * 60)

    long_text = """
    Artificial Intelligence (AI) has revolutionized the way we live and work.
    From virtual assistants to self-driving cars, AI is transforming industries
    across the globe. Machine learning, a subset of AI, enables computers to
    learn from data without being explicitly programmed. Deep learning, which
    uses neural networks with multiple layers, has achieved remarkable success
    in tasks such as image recognition, natural language processing, and game
    playing. As AI continues to advance, it raises important questions about
    ethics, privacy, and the future of work. Researchers and policymakers are
    working to ensure that AI development is responsible and beneficial for
    society.
    """

    # Test different summary types
    for summary_type in ["paragraph", "bullet_points", "key_points"]:
        print(f"\n--- Summary Type: {summary_type} ---")
        result = gemini_manager.summarize_text(
            text=long_text,
            summary_type=summary_type
        )

        print(f"Success: {result['success']}")
        if result['success']:
            print(f"Original Length: {result['original_length']} chars")
            print(f"Summary Length: {result['summary_length']} chars")
            print(f"Summary:\n{result['summary']}")
        else:
            print(f"Error: {result['error']}")
    print()


def test_organize_text():
    """Test text organization"""
    print("=" * 60)
    print("TEST: Organize Text")
    print("=" * 60)

    messy_text = """
    AI can help with data analysis it also helps with automation
    machine learning is important deep learning uses neural networks
    ethics are a concern privacy is important jobs may change
    researchers are working on solutions
    """

    # Test different organization types
    for org_type in ["structured", "categorized", "outline", "cleaned"]:
        print(f"\n--- Organization Type: {org_type} ---")
        result = gemini_manager.organize_text(
            text=messy_text,
            organization_type=org_type
        )

        print(f"Success: {result['success']}")
        if result['success']:
            print(f"Organized Text:\n{result['organized_text']}")
        else:
            print(f"Error: {result['error']}")
    print()


def test_ocr_and_organize():
    """Test OCR and text organization combined"""
    print("=" * 60)
    print("TEST: OCR and Organize Text from Image")
    print("=" * 60)

    # Note: Replace with actual image path containing text
    image_path = "path/to/your/text-image.jpg"

    # Test different organization types
    for org_type in ["cleaned", "structured", "outline"]:
        print(f"\n--- Organization Type: {org_type} ---")
        result = gemini_manager.ocr_and_organize(
            image_path=image_path,
            organization_type=org_type,
            preserve_format=False
        )

        print(f"Success: {result['success']}")
        print(f"Model: {result.get('model', 'N/A')}")
        print(f"Processing Time: {result.get('processing_time', 0):.2f}s")

        if result['success']:
            print(f"\n--- Raw Extracted Text ---")
            print(result['raw_text'][:200] + "..." if len(result['raw_text']) > 200 else result['raw_text'])
            print(f"\n--- Organized Text ---")
            print(result['organized_text'])
        else:
            print(f"Error: {result['error']}")

        print("\n" + "-" * 60)
    print()


def test_ocr_preserve_format():
    """Test OCR with format preservation"""
    print("=" * 60)
    print("TEST: OCR with Format Preservation")
    print("=" * 60)

    # Note: Replace with actual image path
    image_path = "path/to/your/formatted-document.jpg"

    result = gemini_manager.ocr_and_organize(
        image_path=image_path,
        organization_type="cleaned",
        preserve_format=True
    )

    print(f"Success: {result['success']}")
    if result['success']:
        print(f"Processing Time: {result['processing_time']:.2f}s")
        print(f"\nOrganized Text (with format preserved):")
        print(result['organized_text'])
    else:
        print(f"Error: {result['error']}")
    print()


def test_list_models():
    """Test listing available models"""
    print("=" * 60)
    print("TEST: List Available Models")
    print("=" * 60)

    result = gemini_manager.list_models()

    print(f"Success: {result['success']}")
    if result['success']:
        print(f"Available Models ({len(result['models'])}):")
        for model in result['models']:
            print(f"  - {model}")
    else:
        print(f"Error: {result['error']}")
    print()


def test_client_info():
    """Test getting client information"""
    print("=" * 60)
    print("TEST: Get Client Information")
    print("=" * 60)

    info = gemini_manager.get_client_info()

    print(f"Loaded Clients: {info.get('loaded_clients', [])}")
    print(f"Default API Key: {info.get('default_api_key_name')}")
    print(f"Default Model: {info.get('default_model')}")
    print()


def test_json_output():
    """Test JSON output format"""
    print("=" * 60)
    print("TEST: JSON Output Format")
    print("=" * 60)

    result_json = gemini_manager.generate_content(
        prompt="What is the capital of France?",
        return_json=True
    )

    print(f"JSON Output:\n{result_json}")
    print()


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("Gemini Utility - Example Usage")
    print("=" * 60 + "\n")

    # Run basic tests
    test_generate_content()
    test_generate_with_parameters()

    # Run new feature tests (uncomment after providing image paths)
    # test_recognize_objects()
    # test_summarize_image()

    test_summarize_text()
    test_organize_text()

    # Run OCR tests (uncomment after providing image paths with text)
    # test_ocr_and_organize()
    # test_ocr_preserve_format()

    test_list_models()
    test_client_info()
    test_json_output()

    print("=" * 60)
    print("All tests completed!")
    print("Note: Image-related tests are commented out.")
    print("Provide valid image paths to test those features.")
    print("=" * 60)


