#!/usr/bin/env python3
"""
Image to Base64 Converter Tool
Converts an image file to base64 encoding that can be directly used in HTML src attribute.
"""

import argparse
import base64
import os
import sys
from pathlib import Path


def get_image_mime_type(file_path):
    """
    Get the MIME type based on file extension.
    """
    extension = Path(file_path).suffix.lower()
    mime_types = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
    }

    return mime_types.get(extension, 'application/octet-stream')


def is_image_file(file_path):
    """
    Check if a file is an image based on its extension.

    Args:
        file_path (str): Path to the file

    Returns:
        bool: True if it's an image file, False otherwise
    """
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico'}
    return Path(file_path).suffix.lower() in image_extensions


def image_to_base64(image_path):
    """
    Convert an image file to base64 encoding string.

    Args:
        image_path (str): Path to the image file

    Returns:
        str: Base64 encoded string ready for HTML src attribute
        None: If file doesn't exist or error occurs
    """
    try:
        # Check if file exists
        if not os.path.exists(image_path):
            print(f"Error: File '{image_path}' does not exist.")
            return None

        # Check if it's a file
        if not os.path.isfile(image_path):
            print(f"Error: '{image_path}' is not a file.")
            return None

        # Read the image file in binary mode
        with open(image_path, 'rb') as image_file:
            image_data = image_file.read()

        # Encode the binary data to base64
        base64_encoded = base64.b64encode(image_data).decode('utf-8')

        # Get MIME type
        mime_type = get_image_mime_type(image_path)

        # Create data URI format ready for HTML src
        data_uri = f"data:{mime_type};base64,{base64_encoded}"

        return data_uri

    except Exception as e:
        print(f"Error converting image to base64: {e}")
        return None


def process_directory(directory_path, no_save=False, no_example=False):
    """
    Process all image files in a directory and convert them to base64.

    Args:
        directory_path (str): Path to the directory
        no_save (bool): Do not save base64 to files
        no_example (bool): Do not show HTML usage examples

    Returns:
        int: Number of successfully processed images
    """
    try:
        # Check if directory exists
        if not os.path.exists(directory_path):
            print(f"Error: Directory '{directory_path}' does not exist.")
            return 0

        if not os.path.isdir(directory_path):
            print(f"Error: '{directory_path}' is not a directory.")
            return 0

        # Get all files in the directory
        dir_path = Path(directory_path)
        image_files = []

        # Find all image files in the directory
        for file_path in dir_path.iterdir():
            if file_path.is_file() and is_image_file(file_path):
                image_files.append(file_path)

        if not image_files:
            print(f"No image files found in directory: {directory_path}")
            return 0

        print(f"Found {len(image_files)} image files in directory: {directory_path}")
        print("-" * 60)

        success_count = 0

        for image_file in image_files:
            print(f"\nProcessing: {image_file.name}")

            # Convert image to base64
            base64_result = image_to_base64(str(image_file))

            if base64_result is None:
                print(f"❌ Failed to convert: {image_file.name}")
                continue

            # Display file info
            file_size = image_file.stat().st_size
            base64_size = len(base64_result)
            size_increase = ((base64_size - file_size) / file_size) * 100

            print(f"  Original size: {file_size:,} bytes")
            print(f"  Base64 size: {base64_size:,} bytes")
            print(f"  Size increase: {size_increase:.1f}%")

            # Save to file unless --no-save flag is used
            if not no_save:
                saved_path = save_base64_to_file(base64_result, str(image_file))
                if saved_path:
                    print(f"  ✅ Saved to: {saved_path.name}")

            # Show HTML usage example unless --no-example flag is used
            if not no_example:
                print(f"\n  HTML usage for {image_file.name}:")
                print(f"  <img src=\"{base64_result}\" alt=\"{image_file.stem}\" />")

            print(f"  ✅ Successfully converted: {image_file.name}")
            success_count += 1

        return success_count

    except Exception as e:
        print(f"Error processing directory: {e}")
        return 0


def save_base64_to_file(base64_string, original_path):
    """
    Save the base64 encoding to a .txt file in the same directory.

    Args:
        base64_string (str): The base64 encoded data URI
        original_path (str): Path to the original image file
    """
    try:
        # Create output file path
        original_path = Path(original_path)
        output_path = original_path.with_suffix('.base64.txt')

        # Write base64 string to file
        with open(output_path, 'w', encoding='utf-8') as output_file:
            output_file.write(base64_string)

        print(f"Base64 encoding saved to: {output_path}")
        return output_path

    except Exception as e:
        print(f"Error saving base64 to file: {e}")
        return None


def print_html_usage_example(base64_string, original_path):
    """
    Print HTML usage example.

    Args:
        base64_string (str): The base64 encoded data URI
        original_path (str): Path to the original image file
    """
    original_path = Path(original_path)
    print("\n" + "="*60)
    print("HTML USAGE EXAMPLE:")
    print("="*60)

    html_example = f'''<!-- HTML usage example for {original_path.name} -->
<img src="{base64_string}" alt="{original_path.stem}" />

<!-- CSS usage example -->
<style>
    .background-image {{
        background-image: url("{base64_string}");
        background-size: cover;
        background-position: center;
    }}
</style>

<!-- JavaScript usage example -->
<script>
    const img = new Image();
    img.src = "{base64_string}";
    document.body.appendChild(img);
</script>'''

    print(html_example)
    print("="*60)


def main():
    """
    Main function to handle command line arguments and execute conversion.
    """
    parser = argparse.ArgumentParser(
        description='Convert image file(s) to base64 encoding for HTML usage',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  # Convert a single image file
  python image_to_base64.py photo.jpg

  # Convert all images in a directory
  python image_to_base64.py /path/to/images/

  # Convert without saving to files
  python image_to_base64.py photo.jpg --no-save

  # Convert directory without HTML examples
  python image_to_base64.py /path/to/images/ --no-example
        '''
    )

    parser.add_argument(
        'path',
        help='Path to an image file or directory containing images'
    )

    parser.add_argument(
        '--no-save',
        action='store_true',
        help='Do not save base64 to file, only display to console'
    )

    parser.add_argument(
        '--no-example',
        action='store_true',
        help='Do not show HTML usage example'
    )

    args = parser.parse_args()

    # Check if the path exists
    if not os.path.exists(args.path):
        print(f"Error: Path '{args.path}' does not exist.")
        sys.exit(1)

    # Check if it's a directory or file
    if os.path.isdir(args.path):
        # Process directory - convert all images in the directory
        print(f"Processing directory: {args.path}")
        success_count = process_directory(args.path, args.no_save, args.no_example)

        print(f"\n{'='*60}")
        print(f"SUMMARY: {success_count} images converted successfully")
        print(f"{'='*60}")

        if success_count == 0:
            sys.exit(1)

    elif os.path.isfile(args.path):
        # Process single file
        if not is_image_file(args.path):
            print(f"Error: '{args.path}' is not a supported image file.")
            print("Supported formats: .jpg, .jpeg, .png, .gif, .webp, .bmp, .svg, .ico")
            sys.exit(1)

        # Convert single image to base64
        print(f"Converting image: {args.path}")
        base64_result = image_to_base64(args.path)

        if base64_result is None:
            sys.exit(1)

        # Display encoding info
        file_size = os.path.getsize(args.path)
        base64_size = len(base64_result)
        size_increase = ((base64_size - file_size) / file_size) * 100

        print(f"Original file size: {file_size:,} bytes")
        print(f"Base64 encoded size: {base64_size:,} bytes")
        print(f"Size increase: {size_increase:.1f}%")

        # Save to file unless --no-save flag is used
        if not args.no_save:
            saved_path = save_base64_to_file(base64_result, args.path)
            if saved_path:
                print(f"✅ Successfully saved base64 encoding to file")

        # Show HTML usage example unless --no-example flag is used
        if not args.no_example:
            print_html_usage_example(base64_result, args.path)

        print("✅ Image conversion completed successfully!")

    else:
        print(f"Error: '{args.path}' is neither a file nor a directory.")
        sys.exit(1)


if __name__ == "__main__":
    main()