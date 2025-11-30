#!/usr/bin/env python3
"""
Image Comparison Generator Tool

This tool reads images from a specified directory, creates a comparison collage
with temporary labels (A, B, C, etc.), and generates an AI-friendly comparison image.
"""

import os
import sys
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import string


class ImageComparisonGenerator:
    def __init__(self, target_directory):
        self.target_directory = Path(target_directory)
        self.comparison_marker = "_comparison_collage"
        self.supported_formats = {'.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tiff', '.webp'}

    def is_comparison_image(self, filename):
        """Check if file is a generated comparison image"""
        return self.comparison_marker in filename.lower()

    def is_image_file(self, filepath):
        """Check if file is a supported image format"""
        return filepath.suffix.lower() in self.supported_formats

    def get_image_files(self):
        """Get all image files from directory, excluding comparison images"""
        if not self.target_directory.exists():
            raise FileNotFoundError(f"Directory not found: {self.target_directory}")

        image_files = []
        for file_path in self.target_directory.iterdir():
            if (file_path.is_file() and
                self.is_image_file(file_path) and
                not self.is_comparison_image(file_path.name)):
                image_files.append(file_path)

        # Sort files for consistent ordering
        image_files.sort(key=lambda x: x.name.lower())
        return image_files

    def get_label_for_index(self, index):
        """Generate label (A, B, C, ...) for given index"""
        alphabet = string.ascii_uppercase
        if index < len(alphabet):
            return alphabet[index]
        else:
            # For more than 26 images, use AA, AB, etc.
            first_char = alphabet[(index // len(alphabet)) - 1]
            second_char = alphabet[index % len(alphabet)]
            return first_char + second_char

    def calculate_collage_size(self, image_files, thumb_size=(300, 300)):
        """Calculate the optimal collage layout"""
        num_images = len(image_files)
        if num_images == 0:
            return 0, 0, 1, 1

        # Calculate grid layout (prefer wider layouts)
        cols = min(num_images, 4)  # Max 4 columns
        rows = (num_images + cols - 1) // cols

        # Individual image size
        img_width, img_height = thumb_size

        # Spacing between images
        spacing = 20
        label_height = 40  # Space for label at bottom of each image

        # Total dimensions
        total_width = cols * img_width + (cols - 1) * spacing + 40  # 40px margin
        total_height = rows * (img_height + label_height) + (rows - 1) * spacing + 60  # 60px margin

        return total_width, total_height, cols, rows

    def create_comparison_collage(self, image_files, output_path):
        """Create comparison collage with labels"""
        num_images = len(image_files)
        if num_images == 0:
            print("No images found in directory")
            return

        collage_width, collage_height, cols, rows = self.calculate_collage_size(image_files)

        # Create white background
        collage = Image.new('RGB', (collage_width, collage_height), 'white')
        draw = ImageDraw.Draw(collage)

        try:
            # Try to load a nice font, fallback to default if not available
            title_font = ImageFont.truetype("arial.ttf", 36)
            label_font = ImageFont.truetype("arial.ttf", 24)
        except:
            try:
                title_font = ImageFont.truetype("DejaVuSans.ttf", 36)
                label_font = ImageFont.truetype("DejaVuSans.ttf", 24)
            except:
                title_font = ImageFont.load_default()
                label_font = ImageFont.load_default()

        # Draw title
        title_text = f"Image Comparison - {num_images} Images"
        title_bbox = draw.textbbox((0, 0), title_text, font=title_font)
        title_width = title_bbox[2] - title_bbox[0]
        title_x = (collage_width - title_width) // 2
        draw.text((title_x, 20), title_text, fill='black', font=title_font)

        # Thumbnail size and spacing
        thumb_width, thumb_height = 300, 300
        spacing = 20
        label_height = 40
        start_y = 70  # Start after title

        for idx, img_path in enumerate(image_files):
            row = idx // cols
            col = idx % cols

            x = 20 + col * (thumb_width + spacing)
            y = start_y + row * (thumb_height + label_height + spacing)

            try:
                # Open and resize image
                with Image.open(img_path) as img:
                    # Convert to RGB if necessary
                    if img.mode != 'RGB':
                        img = img.convert('RGB')

                    # Resize maintaining aspect ratio
                    img.thumbnail((thumb_width, thumb_height), Image.Resampling.LANCZOS)

                    # Calculate position to center the image
                    img_x = x + (thumb_width - img.width) // 2
                    img_y = y + (thumb_height - img.height) // 2

                    # Paste image onto collage
                    collage.paste(img, (img_x, img_y))

                # Draw label below image
                label = self.get_label_for_index(idx)
                label_text = f"Image {label}"
                label_bbox = draw.textbbox((0, 0), label_text, font=label_font)
                label_width = label_bbox[2] - label_bbox[0]
                label_x = x + (thumb_width - label_width) // 2
                label_y = y + thumb_height + 10

                # Draw label background
                draw.rectangle([label_x - 5, label_y - 2,
                              label_x + label_width + 5, label_y + label_bbox[3] - label_bbox[1] + 2],
                             fill='lightgray', outline='black')
                draw.text((label_x, label_y), label_text, fill='black', font=label_font)

                # Draw filename below label (smaller text)
                try:
                    filename_font = ImageFont.truetype("arial.ttf", 12)
                except:
                    try:
                        filename_font = ImageFont.truetype("DejaVuSans.ttf", 12)
                    except:
                        filename_font = ImageFont.load_default()

                filename = img_path.name
                if len(filename) > 30:
                    filename = filename[:27] + "..."

                filename_y = label_y + 25
                draw.text((x + 5, filename_y), filename, fill='gray', font=filename_font)

            except Exception as e:
                print(f"Error processing {img_path}: {e}")
                # Draw error placeholder
                draw.rectangle([x, y, x + thumb_width, y + thumb_height],
                             fill='lightcoral', outline='red', width=2)
                error_text = f"Error loading\n{img_path.name}"
                draw.text((x + 10, y + thumb_height // 2), error_text, fill='red', font=label_font)

        # Save the collage
        collage.save(output_path, quality=95)
        print(f"Comparison collage saved to: {output_path}")

    def generate_comparison(self):
        """Main method to generate comparison collage"""
        try:
            image_files = self.get_image_files()

            if not image_files:
                print("No supported image files found in the directory")
                return

            print(f"Found {len(image_files)} images to process")

            # Generate output filename
            output_filename = f"comparison_collage_{len(image_files)}_images{self.comparison_marker}.jpg"
            output_path = self.target_directory / output_filename

            # Check if comparison already exists
            if output_path.exists():
                print(f"Comparison image already exists: {output_path}")
                response = input("Overwrite? (y/N): ").strip().lower()
                if response != 'y':
                    print("Skipping generation")
                    return

            # Create the comparison collage
            self.create_comparison_collage(image_files, output_path)

        except Exception as e:
            print(f"Error: {e}")
            sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Generate image comparison collage from directory images",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python image_comparison_generator.py ./images
  python image_comparison_generator.py /path/to/image/directory
        """
    )

    parser.add_argument(
        'directory',
        help='Directory containing images to compare'
    )

    args = parser.parse_args()

    # Create generator and run
    generator = ImageComparisonGenerator(args.directory)
    generator.generate_comparison()


if __name__ == "__main__":
    main()