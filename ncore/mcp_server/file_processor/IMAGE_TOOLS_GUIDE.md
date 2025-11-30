# Image Processing Tools - Complete Guide

## Overview

FileProcessor MCP now includes comprehensive image processing capabilities for cropping, splitting, transforming, compressing, merging, and more.

## New Features Added

### 1. Equal Split (Auto-calculate sprite size)
```python
# Split image into N equal parts
mcp__FileProcessor__split_image_equal(
    image_path="sprite.png",
    count=10,
    direction="vertical",
    name_pattern="icon_{index}"
)
```

**Use Cases:**
- Split sprite sheets without knowing individual sprite dimensions
- Divide long images into equal sections
- Automatic calculation of part sizes

**Example:**
- Input: 56×560 image
- Count: 10
- Result: 10 images of 56×56 each

---

### 2. Custom Split Points
```python
# Split at specific pixel positions
mcp__FileProcessor__split_image_custom(
    image_path="image.png",
    split_points=[100, 250, 400],
    direction="vertical"
)
```

**Result Parts:**
- Part 0: 0-100px
- Part 1: 100-250px
- Part 2: 250-400px
- Part 3: 400px-end

---

### 3. Create Image Grid/Collage
```python
# Create grid from multiple images
mcp__FileProcessor__create_image_grid(
    image_paths=["img1.png", "img2.png", "img3.png", ...],
    cols=3,
    output_path="grid.png",
    spacing=10,
    cell_width=200,
    cell_height=200,
    resize_mode="fit"  # or "fill" or "stretch"
)
```

**Resize Modes:**
- `fit`: Fit inside cell, maintain aspect ratio (default)
- `fill`: Fill cell, crop if needed, maintain aspect ratio
- `stretch`: Stretch to fill cell exactly

**Use Cases:**
- Create photo collages
- Generate thumbnails grid
- Build image galleries
- Combine multiple screenshots

---

### 4. Sprite Sheet Splitting
```python
# Split horizontal/vertical sprite sheets
mcp__FileProcessor__split_sprite_sheet(
    image_path="sprite.png",
    sprite_width=80,
    sprite_height=80,
    direction="vertical",
    name_pattern="sprite_{index}"
)
```

---

### 5. Grid Splitting
```python
# Split into rows × cols grid
mcp__FileProcessor__split_image_grid(
    image_path="image.png",
    rows=3,
    cols=3,
    name_pattern="tile_{row}_{col}"
)
```

---

### 6. Image Cropping
```python
# Crop to specific rectangle
mcp__FileProcessor__crop_image(
    image_path="image.png",
    x=100,
    y=100,
    width=500,
    height=400
)
```

---

### 7. Resize with Multiple Options
```python
# Resize by width
mcp__FileProcessor__resize_image(
    image_path="image.png",
    width=800,
    keep_aspect=True
)

# Resize by max dimension
mcp__FileProcessor__resize_image(
    image_path="image.png",
    max_size=1920
)

# Exact dimensions
mcp__FileProcessor__resize_image(
    image_path="image.png",
    width=800,
    height=600,
    keep_aspect=False
)
```

---

### 8. Rotation
```python
# Rotate image
mcp__FileProcessor__rotate_image(
    image_path="image.png",
    angle=90,
    expand=True,
    fill_color="white"
)
```

---

### 9. Flip
```python
# Flip horizontally or vertically
mcp__FileProcessor__flip_image(
    image_path="image.png",
    direction="horizontal"  # or "vertical"
)
```

---

### 10. Compression
```python
# Compress with quality control
mcp__FileProcessor__compress_image(
    image_path="image.jpg",
    quality=85,
    max_width=1920,
    max_height=1080,
    output_format="JPEG"
)
```

**Features:**
- Quality control (1-100)
- Size constraints
- Format conversion (JPEG, PNG, WEBP)
- Automatic RGBA→RGB conversion for JPEG
- Reports compression ratio

---

### 11. Merge Images
```python
# Merge horizontally
mcp__FileProcessor__merge_images_horizontal(
    image_paths=["img1.png", "img2.png", "img3.png"],
    output_path="merged.png",
    spacing=10,
    align="center"  # or "top" or "bottom"
)

# Merge vertically
mcp__FileProcessor__merge_images_vertical(
    image_paths=["img1.png", "img2.png", "img3.png"],
    output_path="merged.png",
    spacing=10,
    align="center"  # or "left" or "right"
)
```

---

### 12. Add Text Overlay
```python
# Add text to image
mcp__FileProcessor__add_text_to_image(
    image_path="image.png",
    text="Copyright 2025",
    position=(10, 10),
    font_size=24,
    font_color="black",
    background_color="rgba(255, 255, 255, 128)"  # semi-transparent white
)
```

---

### 13. Apply Filters
```python
# Apply image filters
mcp__FileProcessor__apply_image_filter(
    image_path="image.png",
    filter_type="blur",  # or sharpen, brightness, contrast, grayscale, sepia
    intensity=1.0
)
```

**Available Filters:**
- `blur`: Gaussian blur
- `sharpen`: Sharpen image
- `brightness`: Adjust brightness (0.0-2.0)
- `contrast`: Adjust contrast (0.0-2.0)
- `grayscale`: Convert to grayscale
- `sepia`: Apply sepia tone effect

---

## Real-World Examples

### Example 1: Process Flutter Sprite Sheets

```python
# Problem: 80×400 sprite sheet with 5 icons (80×80 each)
# Solution: Use equal split

result = mcp__FileProcessor__split_image_equal(
    image_path="home-fivemain-sprite2x@v7.15.png",
    count=5,
    direction="vertical",
    output_dir="icons/",
    name_pattern="local_nav_{index}"
)

# Result: 5 separate 80×80 icons
# local_nav_0.png, local_nav_1.png, ..., local_nav_4.png
```

### Example 2: Create Photo Gallery Grid

```python
# Create 3-column grid from 9 photos
result = mcp__FileProcessor__create_image_grid(
    image_paths=[
        "photo1.jpg", "photo2.jpg", "photo3.jpg",
        "photo4.jpg", "photo5.jpg", "photo6.jpg",
        "photo7.jpg", "photo8.jpg", "photo9.jpg"
    ],
    cols=3,
    output_path="gallery.jpg",
    spacing=5,
    resize_mode="fill",
    cell_width=300,
    cell_height=300
)

# Result: 3×3 grid (900×900) with 5px spacing
```

### Example 3: Batch Compress Images

```python
# Compress for web
result = mcp__FileProcessor__compress_image(
    image_path="large_photo.jpg",
    quality=85,
    max_width=1920,
    max_height=1080,
    output_format="WEBP"
)

# Result: Optimized web image with compression ratio report
```

### Example 4: Create Watermarked Image

```python
# Add watermark
result = mcp__FileProcessor__add_text_to_image(
    image_path="photo.jpg",
    text="© My Company 2025",
    position=(20, 20),
    font_size=18,
    font_color="white",
    background_color="rgba(0, 0, 0, 128)"
)
```

---

## Integration with Flutter

### Before (Complex Sprite Logic)
```dart
Widget _buildSpriteIcon(int index) {
  const spriteImagePath = 'assets/sprite.png';
  const iconSize = 32.0;
  const originalSpriteWidth = 40.0;
  const originalSpriteHeight = 40.0;
  final scale = iconSize / originalSpriteWidth;
  final yOffset = -originalSpriteHeight * index * scale;

  return SizedBox(
    width: iconSize,
    height: iconSize,
    child: ClipRect(
      child: Transform.translate(
        offset: Offset(0, yOffset),
        child: Image.asset(spriteImagePath, ...),
      ),
    ),
  );
}
```

### After (Simple Direct Loading)
```dart
Widget _buildIcon(int index) {
  const iconSize = 32.0;
  final iconPath = AssetsImages.localNavIcons[index];

  return Image.asset(
    iconPath,
    width: iconSize,
    height: iconSize,
    fit: BoxFit.contain,
  );
}
```

**Benefits:**
- ✅ Simpler code
- ✅ No complex calculations
- ✅ Better maintainability
- ✅ Easier debugging
- ✅ No 2x resolution confusion

---

## Advanced Use Cases

### 1. Split and Grid Combination
```python
# Split large image into parts
split_result = mcp__FileProcessor__split_image_equal(
    image_path="large_image.png",
    count=9,
    direction="vertical"
)

# Recreate as grid with spacing
grid_result = mcp__FileProcessor__create_image_grid(
    image_paths=split_result['output_files'],
    cols=3,
    output_path="grid_with_spacing.png",
    spacing=10
)
```

### 2. Batch Processing with Filters
```python
# Process and apply filter
for img in image_list:
    # Compress
    compressed = mcp__FileProcessor__compress_image(
        image_path=img,
        quality=80,
        max_width=1200
    )

    # Apply filter
    filtered = mcp__FileProcessor__apply_image_filter(
        image_path=compressed['output_path'],
        filter_type="sharpen",
        intensity=1.2
    )
```

---

## Error Handling

All functions return a dictionary with:
```python
{
    "success": True/False,
    "output_path": "path/to/output.png",  # if applicable
    "error": "error message",  # if failed
    ... # additional metadata
}
```

**Example:**
```python
result = mcp__FileProcessor__split_image_equal(...)

if result.get('success'):
    print(f"Created {result['part_count']} parts")
    print(f"Files: {result['output_files']}")
else:
    print(f"Error: {result['error']}")
```

---

## Supported Formats

- **Input**: JPG, JPEG, PNG, BMP, TIFF, TIF, WEBP, GIF
- **Output**: PNG (default), JPEG, WEBP, BMP, TIFF

---

## Performance Tips

1. **Large Images**: Use `max_size` parameter to resize before processing
2. **Batch Operations**: Process multiple images in sequence for consistency
3. **Compression**: Use WEBP format for best size/quality ratio
4. **Grid Creation**: Specify exact cell dimensions for faster processing
5. **Quality**: Use quality=85 for good balance of size/quality

---

## Dependencies

All image processing uses PIL/Pillow, which is automatically installed by PackageManager.

---

## Complete Tool List

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `split_image_equal` | Split into N equal parts | count, direction |
| `split_image_custom` | Split at specific points | split_points |
| `split_sprite_sheet` | Split sprite sheets | sprite_width, sprite_height |
| `split_image_grid` | Split into grid | rows, cols |
| `create_image_grid` | Create grid/collage | cols, resize_mode |
| `crop_image` | Crop rectangle | x, y, width, height |
| `resize_image` | Resize with options | width, height, max_size |
| `rotate_image` | Rotate by angle | angle, expand |
| `flip_image` | Flip H/V | direction |
| `compress_image` | Compress with quality | quality, max_width |
| `merge_images_horizontal` | Merge horizontally | spacing, align |
| `merge_images_vertical` | Merge vertically | spacing, align |
| `add_text_to_image` | Add text overlay | text, position, font_size |
| `apply_image_filter` | Apply filters | filter_type, intensity |

---

## Questions & Support

For issues or feature requests, check the FileProcessor MCP server logs.
