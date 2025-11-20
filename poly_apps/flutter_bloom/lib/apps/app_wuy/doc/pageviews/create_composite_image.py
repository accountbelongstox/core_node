#!/usr/bin/env python3
"""
Composite Image Generator
Creates a single long image containing all screenshots with titles and descriptions.
"""

import os
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import argparse


def get_image_info():
    """
    Get image information with titles and descriptions.
    """
    image_info = {
        '01_profile_page.png': {
            'title': 'Profile Page',
            'description': 'User profile information and settings display'
        },
        '02_about_us_page.png': {
            'title': 'About Us Page',
            'description': 'Application information and developer details'
        },
        '03_history_tracking_page.png': {
            'title': 'History Tracking Page',
            'description': 'User activity history and tracking interface'
        },
        '04_map_page.png': {
            'title': 'Map Page',
            'description': 'Location and map-based features interface'
        },
        '05_friend_info_page.png': {
            'title': 'Friend Information Page',
            'description': 'Detailed friend profile and information display'
        },
        '06_friends_list_page.png': {
            'title': 'Friends List Page',
            'description': 'Friends list management and navigation'
        },
        '07_my_profile_page.png': {
            'title': 'My Profile Page',
            'description': 'Personal profile and account settings'
        },
        '08_find_friends_page.png': {
            'title': 'Find Friends Page',
            'description': 'Friend search and discovery interface'
        },
        '09_registration_page.png': {
            'title': 'Registration Page',
            'description': 'User registration and account creation'
        },
        '10_add_friend_page.png': {
            'title': 'Add Friend Page',
            'description': 'Add new friend and connection interface'
        },
        '11_login_page.png': {
            'title': 'Login Page',
            'description': 'User authentication and login interface'
        },
        '12_network_records_page.png': {
            'title': 'Network Records Page',
            'description': 'Network activity and connection records'
        },
        '13_chat_page.png': {
            'title': 'Chat Page',
            'description': 'Messaging and chat interface'
        },
        '14_search_functionality.png': {
            'title': 'Search Functionality',
            'description': 'Search interface and features'
        }
    }
    return image_info


def get_available_images(directory):
    """
    Get list of available PNG images in the directory.
    """
    print(f"[INFO] Scanning directory: {directory}")

    try:
        png_files = []
        for file_path in Path(directory).glob("*.png"):
            if file_path.is_file():
                png_files.append(file_path)
                print(f"[INFO] Found image: {file_path.name}")

        # Sort by filename to maintain order
        png_files.sort(key=lambda x: x.name)
        print(f"[INFO] Total images found: {len(png_files)}")
        return png_files

    except Exception as e:
        print(f"[ERROR] Failed to scan directory: {e}")
        return []


def calculate_total_height(images, image_info, padding=20, title_height=60, desc_height=30, two_column=True, max_width=800):
    """
    Calculate the total height needed for the composite image.
    """
    total_height = padding  # Top padding

    # Process images in pairs for two-column layout
    for i in range(0, len(images), 2):
        # Get current row images (1 or 2 images)
        row_images = images[i:i+2]

        # Find max height in this row
        max_row_height = 0
        for img_path in row_images:
            try:
                with Image.open(img_path) as img:
                    # Calculate scaled height
                    if two_column:
                        img_width = (max_width - padding * 3) // 2  # Two images with padding
                    else:
                        img_width = max_width - padding * 2

                    scale_ratio = img_width / img.width
                    scaled_height = int(img.height * scale_ratio)
                    max_row_height = max(max_row_height, scaled_height)

            except Exception as e:
                print(f"[WARNING] Could not read image {img_path.name}: {e}")
                continue

        # Add text area height and image height for this row
        total_height += title_height + desc_height + padding + max_row_height + padding

    print(f"[INFO] Calculated total height: {total_height} pixels")
    return total_height


def load_font(size, font_path=None):
    """
    Load font with fallback to default.
    """
    try:
        if font_path and os.path.exists(font_path):
            return ImageFont.truetype(font_path, size)
        else:
            # Try common system fonts
            common_fonts = [
                "arial.ttf", "arialbd.ttf",  # Windows
                "/System/Library/Fonts/Arial.ttf",  # macOS
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",  # Linux
                "DejaVuSans.ttf"  # Common fallback
            ]

            for font in common_fonts:
                try:
                    return ImageFont.truetype(font, size)
                except:
                    continue

            # Fallback to default font
            return ImageFont.load_default()

    except Exception as e:
        print(f"[WARNING] Could not load custom font: {e}")
        return ImageFont.load_default()


def draw_text_with_shadow(draw, text, position, font, text_color, shadow_color=(128, 128, 128)):
    """
    Draw text with shadow effect for better readability.
    """
    x, y = position

    # Draw shadow
    draw.text((x + 2, y + 2), text, font=font, fill=shadow_color)

    # Draw main text
    draw.text((x, y), text, font=font, fill=text_color)


def create_composite_image(directory, output_filename, max_width=800, two_column=True, compression_quality=85):
    """
    Create a composite image containing all screenshots with titles and descriptions in two-column layout.
    """
    print(f"[INFO] Starting composite image creation...")
    print(f"[INFO] Output filename: {output_filename}")
    print(f"[INFO] Maximum width: {max_width}px")
    print(f"[INFO] Two column layout: {two_column}")
    print(f"[INFO] Compression quality: {compression_quality}%")

    # Get available images and image info
    images = get_available_images(directory)
    image_info = get_image_info()

    if not images:
        print("[ERROR] No images found in directory")
        return False

    # Calculate dimensions
    total_height = calculate_total_height(images, image_info, two_column=two_column, max_width=max_width)
    composite_width = max_width

    print(f"[INFO] Creating composite image: {composite_width} x {total_height}")

    # Create composite image with white background
    composite_img = Image.new('RGB', (composite_width, total_height), color='white')
    draw = ImageDraw.Draw(composite_img)

    # Load fonts
    try:
        title_font = load_font(24)  # Smaller title font for two-column layout
        desc_font = load_font(14)   # Smaller description font
        print("[INFO] Fonts loaded successfully")
    except Exception as e:
        print(f"[WARNING] Font loading failed: {e}")
        title_font = ImageFont.load_default()
        desc_font = ImageFont.load_default()

    # Position tracking
    current_y = 20  # Start with top padding
    padding = 20
    item_padding = 10  # Padding between two images in the same row

    # Process images in rows (two per row for two-column layout)
    for row_index in range(0, len(images), 2):
        row_images = images[row_index:row_index + 2]
        print(f"[INFO] Processing row {row_index // 2 + 1}/{(len(images) + 1) // 2} with {len(row_images)} images")

        # Calculate row title (combine titles of both images)
        row_title = f"{row_index + 1}-{min(row_index + 2, len(images))}. "
        row_titles = []
        for i, img_path in enumerate(row_images):
            info = image_info.get(img_path.name, {
                'title': img_path.stem.replace('_', ' ').title(),
                'description': 'Application interface screenshot'
            })
            row_titles.append(info['title'])

        row_title += " & ".join(row_titles)

        # Draw row title
        title_bbox = draw.textbbox((0, 0), row_title, font=title_font)
        title_width = title_bbox[2] - title_bbox[0]
        title_x = (composite_width - title_width) // 2

        draw_text_with_shadow(
            draw, row_title,
            (title_x, current_y),
            title_font,
            text_color=(33, 37, 41)
        )

        current_y += 45  # Move down for title

        # Calculate available width for images
        if two_column and len(row_images) == 2:
            image_width = (composite_width - padding * 3 - item_padding) // 2
            image_x_positions = [padding, padding + image_width + item_padding]
        else:
            image_width = composite_width - padding * 2
            image_x_positions = [padding]

        # Find max image height in this row for alignment
        max_image_height = 0
        processed_images = []

        for i, img_path in enumerate(row_images):
            try:
                print(f"[INFO] Processing image {row_index + i + 1}/{len(images)}: {img_path.name}")

                # Open and resize image
                with Image.open(img_path) as img:
                    original_width, original_height = img.size

                    # Calculate scaled dimensions
                    scale_ratio = image_width / original_width
                    new_width = int(original_width * scale_ratio)
                    new_height = int(original_height * scale_ratio)

                    img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                    max_image_height = max(max_image_height, new_height)

                    processed_images.append((img_path, img_resized, new_width, new_height, image_x_positions[i]))

                    print(f"[INFO] Resized image from {original_width}x{original_height} to {new_width}x{new_height}")

            except Exception as e:
                print(f"[ERROR] Failed to process {img_path.name}: {e}")
                continue

        # Paste all images in the row
        for img_path, img_resized, img_width, img_height, img_x in processed_images:
            try:
                # Calculate vertical position to center align images in the row
                img_y = current_y + (max_image_height - img_height) // 2

                # Paste image
                composite_img.paste(img_resized, (img_x, img_y))

                # Add image description below each image
                info = image_info.get(img_path.name, {
                    'title': img_path.stem.replace('_', ' ').title(),
                    'description': 'Application interface screenshot'
                })

                # Split description if too long
                desc_text = info['description']
                max_desc_width = img_width - 20

                # Simple text wrapping
                words = desc_text.split()
                lines = []
                current_line = []

                for word in words:
                    test_line = ' '.join(current_line + [word])
                    bbox = draw.textbbox((0, 0), test_line, font=desc_font)
                    if bbox[2] - bbox[0] <= max_desc_width:
                        current_line.append(word)
                    else:
                        if current_line:
                            lines.append(' '.join(current_line))
                        current_line = [word]

                if current_line:
                    lines.append(' '.join(current_line))

                # Draw description lines
                desc_y = current_y + max_image_height + 10
                for line in lines[:2]:  # Limit to 2 lines
                    line_bbox = draw.textbbox((0, 0), line, font=desc_font)
                    line_width = line_bbox[2] - line_bbox[0]
                    line_x = img_x + (img_width - line_width) // 2

                    draw.text(
                        (line_x, desc_y),
                        line,
                        font=desc_font,
                        fill=(108, 117, 125)
                    )
                    desc_y += 18

                print(f"[INFO] Successfully processed {img_path.name}")

            except Exception as e:
                print(f"[ERROR] Failed to paste {img_path.name}: {e}")
                continue

        # Move current_y down for next row
        current_y += max_image_height + 40  # Image height + description + padding

        # Draw separator line
        if row_index + 2 < len(images):  # Don't draw after last row
            line_y = current_y - 10
            draw.line(
                [(padding, line_y), (composite_width - padding, line_y)],
                fill=(233, 236, 239),
                width=1
            )

    # Add footer
    try:
        footer_y = total_height - 30
        footer_text = f"App WUY Screenshots - {len(images)} pages"
        footer_bbox = draw.textbbox((0, 0), footer_text, font=desc_font)
        footer_width = footer_bbox[2] - footer_bbox[0]
        footer_x = (composite_width - footer_width) // 2

        draw.text(
            (footer_x, footer_y),
            footer_text,
            font=desc_font,
            fill=(108, 117, 125)
        )

        # Add creation date
        from datetime import datetime
        date_text = f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        date_bbox = draw.textbbox((0, 0), date_text, font=desc_font)
        date_width = date_bbox[2] - date_bbox[0]

        draw.text(
            (composite_width - date_width - padding, footer_y),
            date_text,
            font=desc_font,
            fill=(173, 181, 189)
        )

    except Exception as e:
        print(f"[WARNING] Could not add footer: {e}")

    # Save composite image with compression
    try:
        output_path = Path(directory) / output_filename
        print(f"[INFO] Saving composite image to: {output_path}")

        # Save with JPEG compression for smaller file size
        if output_filename.lower().endswith('.jpg') or output_filename.lower().endswith('.jpeg'):
            composite_img.save(output_path, 'JPEG', quality=compression_quality, optimize=True)
        else:
            composite_img.save(output_path, 'PNG', compress_level=6)

        file_size = output_path.stat().st_size
        file_size_mb = file_size / (1024 * 1024)

        print(f"[SUCCESS] Composite image created successfully!")
        print(f"[INFO] Output file: {output_path}")
        print(f"[INFO] File size: {file_size_mb:.2f} MB")
        print(f"[INFO] Dimensions: {composite_width} x {total_height} pixels")
        print(f"[INFO] Contains {len(images)} screenshots in two-column layout")

        return True

    except Exception as e:
        print(f"[ERROR] Failed to save composite image: {e}")
        import traceback
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        return False


def main():
    """
    Main function to handle command line arguments and execute image creation.
    """
    parser = argparse.ArgumentParser(
        description='Create a composite image from all PNG screenshots with titles and descriptions in two-column layout',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  # Create composite image with default settings (two-column, compressed JPEG)
  python create_composite_image.py

  # Create composite image with custom filename
  python create_composite_image.py --output all_screenshots_composite.jpg

  # Create composite image with custom width
  python create_composite_image.py --width 1200

  # Create composite image with custom compression
  python create_composite_image.py --quality 95

  # Create single column layout
  python create_composite_image.py --single-column

  # Create PNG with no compression
  python create_composite_image.py --output composite.png --quality 100 --single-column
        '''
    )

    parser.add_argument(
        '--output',
        default='composite_screenshots.jpg',
        help='Output filename for the composite image (default: composite_screenshots.jpg)'
    )

    parser.add_argument(
        '--width',
        type=int,
        default=1200,
        help='Maximum width of the composite image (default: 1200)'
    )

    parser.add_argument(
        '--directory',
        default='.',
        help='Directory containing PNG images (default: current directory)'
    )

    parser.add_argument(
        '--quality',
        type=int,
        default=85,
        help='Compression quality for JPEG output (1-100, default: 85)'
    )

    parser.add_argument(
        '--single-column',
        action='store_true',
        help='Use single column layout instead of two-column'
    )

    args = parser.parse_args()

    # Validate directory
    if not os.path.exists(args.directory):
        print(f"[ERROR] Directory does not exist: {args.directory}")
        sys.exit(1)

    if not os.path.isdir(args.directory):
        print(f"[ERROR] Path is not a directory: {args.directory}")
        sys.exit(1)

    # Validate width
    if args.width < 600 or args.width > 2000:
        print(f"[ERROR] Width must be between 600 and 2000 pixels")
        sys.exit(1)

    # Validate quality
    if args.quality < 1 or args.quality > 100:
        print(f"[ERROR] Quality must be between 1 and 100")
        sys.exit(1)

    two_column = not args.single_column
    print(f"[INFO] Composite Image Generator")
    print(f"[INFO] Directory: {os.path.abspath(args.directory)}")
    print(f"[INFO] Output: {args.output}")
    print(f"[INFO] Width: {args.width}px")
    print(f"[INFO] Layout: {'Two-column' if two_column else 'Single-column'}")
    print(f"[INFO] Compression quality: {args.quality}%")
    print("=" * 60)

    # Create composite image
    success = create_composite_image(
        args.directory,
        args.output,
        args.width,
        two_column=two_column,
        compression_quality=args.quality
    )

    if success:
        print("=" * 60)
        print("[SUCCESS] Operation completed successfully!")
        sys.exit(0)
    else:
        print("=" * 60)
        print("[ERROR] Operation failed!")
        sys.exit(1)


if __name__ == "__main__":
    main()