"""
OCR Tool Usage Examples
"""
import sys
from pathlib import Path

# Add path
sys.path.insert(0, str(Path(__file__).parent.parent))

from ocr_tool import OCRTool, create_ocr


def example_basic_usage():
    """Basic usage example"""
    print("=" * 60)
    print("Example 1: Basic Usage - Recognize Entire Image")
    print("=" * 60)

    # Method 1: Manual creation and initialization
    ocr = OCRTool(det_model_name='naive_det')
    ocr.init()

    # Assuming image file exists
    # result = ocr.ocr('test_image.png')
    # print(f"Recognized text: {result['text']}")
    # print(f"Offset: {result['offset']}")
    # print(f"Region: {result['region']}")

    print("\nCode example:")
    print("""
    ocr = OCRTool(det_model_name='naive_det')
    ocr.init()
    result = ocr.ocr('image.png')
    print(result['text'])
    """)


def example_grid_usage():
    """9-grid recognition example"""
    print("\n" + "=" * 60)
    print("Example 2: 9-Grid Recognition - Recognize Specific Region")
    print("=" * 60)

    # Method 2: Use convenience function
    ocr = create_ocr()

    print("""
9-Grid Layout:
┌─────┬─────┬─────┐
│  1  │  2  │  3  │  ← Top row
├─────┼─────┼─────┤
│  4  │  5  │  6  │  ← Middle row
├─────┼─────┼─────┤
│  7  │  8  │  9  │  ← Bottom row
└─────┴─────┴─────┘
  ↑     ↑     ↑
 Left  Mid  Right
    """)

    print("Code example:")
    print("""
    # Recognize top-left region (position 1)
    result = ocr.ocr('image.png', grid_position=1)

    # Recognize center region (position 5)
    result = ocr.ocr('image.png', grid_position=5)

    # Recognize bottom-right region (position 9)
    result = ocr.ocr('image.png', grid_position=9)

    # Result contains offset values
    print(f"Region: {result['region']}")  # (left, top, right, bottom)
    print(f"Offset: {result['offset']}")  # (x_offset, y_offset)
    print(f"Text: {result['text']}")
    """)


def example_multiple_models():
    """Multiple models example"""
    print("\n" + "=" * 60)
    print("Example 3: Using Different Models")
    print("=" * 60)

    print("""
    # Use PaddleOCR Chinese model (supports vertical text)
    ocr_vertical = OCRTool(
        det_model_name='ch_PP-OCRv3_det',
        rec_model_name='ch_PP-OCRv3'
    )
    ocr_vertical.init()

    # Use English-specific model
    ocr_english = OCRTool(
        det_model_name='en_PP-OCRv3_det',
        rec_model_name='en_PP-OCRv3'
    )
    ocr_english.init()

    # Use scene text model
    ocr_scene = OCRTool(
        det_model_name='naive_det',
        rec_model_name='scene-densenet_lite_136-gru'
    )
    ocr_scene.init()
    """)


def example_single_line():
    """Single line text recognition example"""
    print("\n" + "=" * 60)
    print("Example 4: Single Line Text Recognition")
    print("=" * 60)

    print("""
    ocr = create_ocr()

    # Recognize single line text
    result = ocr.ocr_for_single_line('single_line.png')
    print(result['text'])

    # Recognize single line in grid region
    result = ocr.ocr_for_single_line('image.png', grid_position=2)
    print(f"Region 2 text: {result['text']}")
    print(f"Offset: {result['offset']}")
    """)


def example_coordinate_conversion():
    """Coordinate conversion example"""
    print("\n" + "=" * 60)
    print("Example 5: Coordinate Conversion - Using Offsets")
    print("=" * 60)

    print("""
    # Recognize grid position 5
    result = ocr.ocr('image.png', grid_position=5)

    # Get offset values
    x_offset, y_offset = result['offset']

    # OCR coordinates are automatically adjusted to original image coordinates
    for item in result['raw_result']:
        # Position is already in original image coordinate system
        position = item['position']
        text = item['text']
        print(f"Text: {text}")
        print(f"Original coords: {position}")

    # If you need coordinates relative to cropped region, subtract offset
    # local_x = global_x - x_offset
    # local_y = global_y - y_offset
    """)


def example_practical_usage():
    """Practical application examples"""
    print("\n" + "=" * 60)
    print("Example 6: Practical Use Cases")
    print("=" * 60)

    print("""
    # Use case 1: Screenshot OCR - Recognize specific screen region
    ocr = create_ocr()

    # Recognize top region (position 2)
    result = ocr.ocr('screenshot.png', grid_position=2)
    print(f"Top text: {result['text']}")

    # Use case 2: ID card recognition - Region-based recognition
    # Recognize top-left name area
    name_result = ocr.ocr('id_card.png', grid_position=1)

    # Recognize center ID number area
    number_result = ocr.ocr('id_card.png', grid_position=5)

    # Use case 3: Table recognition - Cell by cell
    for i in range(1, 10):
        cell_result = ocr.ocr('table.png', grid_position=i)
        print(f"Cell {i}: {cell_result['text']}")

    # Use case 4: Long image recognition - Process in segments (reduce memory)
    # Only recognize needed parts
    top_part = ocr.ocr('long_image.png', grid_position=2)
    middle_part = ocr.ocr('long_image.png', grid_position=5)
    bottom_part = ocr.ocr('long_image.png', grid_position=8)
    """)


if __name__ == '__main__':
    example_basic_usage()
    example_grid_usage()
    example_multiple_models()
    example_single_line()
    example_coordinate_conversion()
    example_practical_usage()

    print("\n" + "=" * 60)
    print("For more information:")
    print("- cnocr docs: https://github.com/breezedeus/cnocr")
    print("- Available models: See ocr_tool.py documentation")
    print("=" * 60)
