from PIL import Image, ImageDraw
import os

# Global configuration
IMAGE_NAME = 'chat.png'
NUM_ICONS = 5
SPACING_BETWEEN_ICONS = 23
BORDER_RADIUS = 38
INSET_PIXELS = 2  # Shrink image inward by this many pixels on all sides
OUTPUT_DIR = 'icons'


def add_rounded_corners(img, radius, inset=0):
    """Apply rounded corners to an image with optional inset shrink

    Args:
        img: PIL Image to process
        radius: Corner radius in pixels
        inset: Pixels to shrink inward from all edges (default: 0)
    """
    # Calculate final size after inset
    final_width = img.size[0] - (inset * 2)
    final_height = img.size[1] - (inset * 2)

    # Create a mask for rounded corners at the final size
    mask = Image.new('L', (final_width, final_height), 0)
    draw = ImageDraw.Draw(mask)

    # Draw a rounded rectangle on the mask
    draw.rounded_rectangle(
        [(0, 0), (final_width, final_height)],
        radius=radius,
        fill=255
    )

    # Convert image to RGBA if not already
    img = img.convert('RGBA')

    # Crop the image by the inset amount
    if inset > 0:
        img = img.crop((inset, inset, img.size[0] - inset, img.size[1] - inset))

    # Apply the mask
    output = Image.new('RGBA', (final_width, final_height), (0, 0, 0, 0))
    output.paste(img, (0, 0))
    output.putalpha(mask)

    return output


# Read the image
img_path = os.path.join(os.path.dirname(__file__), IMAGE_NAME)
img = Image.open(img_path)

# Get image dimensions
img_width, img_height = img.size
print(f"Original image size: {img_width}x{img_height}")

# Each icon is a square with width and height equal to image height
icon_size = img_height

print(f"\nExtracting {NUM_ICONS} square icons:")
print(f"Icon size: {icon_size}x{icon_size}px")
print(f"Spacing between icons: {SPACING_BETWEEN_ICONS}px")
print(f"Border radius: {BORDER_RADIUS}px")
print(f"Inset (shrink inward): {INSET_PIXELS}px")

# Calculate and extract square icons
icons = []
current_x = 0

for i in range(NUM_ICONS):
    # Calculate icon boundaries
    x_start = current_x
    x_end = x_start + icon_size
    y_start = 0
    y_end = img_height

    icon = {
        'index': i + 1,
        'x_start': x_start,
        'y_start': y_start,
        'x_end': x_end,
        'y_end': y_end,
        'width': icon_size,
        'height': icon_size
    }

    icons.append(icon)

    print(f"Icon {i+1}: x=[{icon['x_start']}, {icon['x_end']}], y=[{icon['y_start']}, {icon['y_end']}]")

    # Move to next icon position (add icon size + spacing)
    current_x = x_end + SPACING_BETWEEN_ICONS

# Create output directory and save each icon
output_path = os.path.join(os.path.dirname(__file__), OUTPUT_DIR)
if not os.path.exists(output_path):
    os.makedirs(output_path)

print(f"\nSaving icons to: {output_path}")

for icon in icons:
    # Crop the square icon
    cropped = img.crop((
        icon['x_start'],
        icon['y_start'],
        icon['x_end'],
        icon['y_end']
    ))

    # Apply rounded corners with inset
    cropped_with_radius = add_rounded_corners(cropped, BORDER_RADIUS, INSET_PIXELS)

    # Save the cropped icon with rounded corners
    output_file = os.path.join(output_path, f'icon_{icon["index"]}.png')
    cropped_with_radius.save(output_file)
    print(f"Saved icon {icon['index']}: {output_file}")

print("\nProcessing complete!")
