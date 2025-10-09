# Image Comparison Generator

A Python tool that reads images from a specified directory and creates a comparison collage with labeled images for AI analysis.

## Features

- Reads all supported image formats from a directory
- Creates a comparison collage with temporary labels (A, B, C, etc.)
- Skips already generated comparison images
- Supports multiple image formats: JPG, PNG, BMP, GIF, TIFF, WebP
- Generates AI-friendly comparison output with clear labels

## Installation

1. Install required dependencies:
```bash
pip install -r requirements.txt
```

## Usage

```bash
python image_comparison_generator.py <directory_path>
```

### Examples

```bash
# Process images in current directory
python image_comparison_generator.py .

# Process images in specific directory
python image_comparison_generator.py ./my_images

# Process images with absolute path
python image_comparison_generator.py /path/to/image/folder
```

## Output

The tool generates a comparison collage image named:
`comparison_collage_[N]_images_comparison_collage.jpg`

Where `[N]` is the number of images processed.

## Features Details

- **Smart Skipping**: Automatically skips previously generated comparison images
- **Grid Layout**: Automatically arranges images in optimal grid (max 4 columns)
- **Labeling**: Each image is labeled with letters (A, B, C, etc.)
- **Filenames**: Shows original filenames below each image
- **Error Handling**: Gracefully handles corrupted or unreadable images
- **Aspect Ratio**: Maintains original aspect ratios while creating uniform thumbnails

## Supported Image Formats

- JPEG (.jpg, .jpeg)
- PNG (.png)
- BMP (.bmp)
- GIF (.gif)
- TIFF (.tiff)
- WebP (.webp)