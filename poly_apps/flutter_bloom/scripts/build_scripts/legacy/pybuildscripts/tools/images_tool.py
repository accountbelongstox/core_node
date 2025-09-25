# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

from PIL import Image
import os
from os import makedirs, path as ospath
from tools.pyprint import Print
from provider import build_provider

def get_image_size(path):
    """Return (width, height) of the image at path."""
    with Image.open(path) as img:
        return img.size

def is_image_fully_transparent(path):
    """Return True if all pixels are fully transparent (for PNG with alpha)."""
    with Image.open(path) as img:
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        alpha = img.getchannel('A')
        return all(pixel == 0 for pixel in alpha.getdata())

def is_image_at_least_size(path, min_width, min_height):
    """Return True if image is at least min_width x min_height."""
    w, h = get_image_size(path)
    return w >= min_width and h >= min_height

def resize_image_to_min_size(path, min_width, min_height, out_path=None):
    """Resize image proportionally to meet at least min_width and min_height. Save to out_path or overwrite."""
    with Image.open(path) as img:
        w, h = img.size
        # Check if both dimensions meet requirements
        if w >= min_width and h >= min_height:
            # Already meets min size
            if out_path and out_path != path:
                makedirs(ospath.dirname(out_path), exist_ok=True)
                img.save(out_path)
                Print.success(f"No resizing needed for '{path}': already {w}x{h} >= min {min_width}x{min_height}. Saved copy to '{out_path}'.")
            elif out_path == path or out_path is None:
                Print.success(f"No resizing needed for '{path}': already {w}x{h} >= min {min_width}x{min_height}. No action taken.")
            else:
                Print.info(f"No resizing needed for '{path}': already {w}x{h} >= min {min_width}x{min_height}. Output path: '{out_path}'.")
            return
        # Print info about which dimension(s) need to be increased
        scale_w = min_width / w if w < min_width else 1.0
        scale_h = min_height / h if h < min_height else 1.0
        scale = max(scale_w, scale_h)
        new_w = int(w * scale)
        new_h = int(h * scale)
        msg = f"Resizing '{path}': "
        if w < min_width:
            msg += f"width {w} -> {new_w} (min {min_width}); "
        if h < min_height:
            msg += f"height {h} -> {new_h} (min {min_height}); "
        Print.info(msg.strip())
        resized = img.resize((new_w, new_h), Image.LANCZOS)
        if out_path:
            makedirs(ospath.dirname(out_path), exist_ok=True)
            resized.save(out_path)
            Print.success(f"Resized and saved '{out_path}' with new size {new_w}x{new_h}.")
        else:
            resized.save(path)
            Print.success(f"Resized and overwritten '{path}' with new size {new_w}x{new_h}.")

def resize_image_to_max_size(path, max_width, max_height, out_path=None):
    """Proportionally shrink image to fit within max_width and max_height. Save to out_path or overwrite."""
    with Image.open(path) as img:
        w, h = img.size
        # Check if both dimensions are within limits
        if w <= max_width and h <= max_height:
            if out_path and out_path != path:
                makedirs(ospath.dirname(out_path), exist_ok=True)
                img.save(out_path)
                Print.success(f"No shrinking needed for '{path}': already {w}x{h} <= max {max_width}x{max_height}. Saved copy to '{out_path}'.")
            elif out_path == path or out_path is None:
                Print.success(f"No shrinking needed for '{path}': already {w}x{h} <= max {max_width}x{max_height}. No action taken.")
            else:
                Print.info(f"No shrinking needed for '{path}': already {w}x{h} <= max {max_width}x{max_height}. Output path: '{out_path}'.")
            return
        # Print info about which dimension(s) need to be reduced
        scale_w = max_width / w if w > max_width else 1.0
        scale_h = max_height / h if h > max_height else 1.0
        scale = min(scale_w, scale_h)
        new_w = int(w * scale)
        new_h = int(h * scale)
        msg = f"Shrinking '{path}': "
        if w > max_width:
            msg += f"width {w} -> {new_w} (max {max_width}); "
        if h > max_height:
            msg += f"height {h} -> {new_h} (max {max_height}); "
        Print.info(msg.strip())
        resized = img.resize((new_w, new_h), Image.LANCZOS)
        if out_path:
            makedirs(ospath.dirname(out_path), exist_ok=True)
            resized.save(out_path)
            Print.success(f"Shrunk and saved '{out_path}' with new size {new_w}x{new_h}.")
        else:
            resized.save(path)
            Print.success(f"Shrunk and overwritten '{path}' with new size {new_w}x{new_h}.")

def crop_image_center(path, crop_width, crop_height, out_path=None):
    """Crop the center region of the image to crop_width x crop_height. Save to out_path or overwrite."""
    with Image.open(path) as img:
        w, h = img.size
        left = max((w - crop_width) // 2, 0)
        top = max((h - crop_height) // 2, 0)
        right = left + crop_width
        bottom = top + crop_height
        cropped = img.crop((left, top, right, bottom))
        if out_path:
            makedirs(ospath.dirname(out_path), exist_ok=True)
            cropped.save(out_path)
        else:
            cropped.save(path)

def convert_image_format(path, out_path):
    """Convert image to format based on out_path extension."""
    with Image.open(path) as img:
        ext = ospath.splitext(out_path)[1].lower()
        if ext == '.jpg' or ext == '.jpeg':
            fmt = 'JPEG'
        elif ext == '.png':
            fmt = 'PNG'
        elif ext == '.webp':
            fmt = 'WEBP'
        elif ext == '.bmp':
            fmt = 'BMP'
        elif ext == '.gif':
            fmt = 'GIF'
        else:
            fmt = None
        if fmt:
            makedirs(ospath.dirname(out_path), exist_ok=True)
            img.save(out_path, format=fmt)
        else:
            makedirs(ospath.dirname(out_path), exist_ok=True)
            img.save(out_path)

def crop_image_center_to_size(path, crop_width, crop_height, out_path=None):
    """
    Crop the center region of the image to crop_width x crop_height. If the image is too small, just copy/save as is and print info.
    :param path: Source image path
    :param crop_width: Desired crop width
    :param crop_height: Desired crop height
    :param out_path: Output path (optional)
    """
    with Image.open(path) as img:
        w, h = img.size
        if w < crop_width or h < crop_height:
            msg = f"Image '{path}' is too small for center crop: "
            if w < crop_width:
                msg += f"width {w} < {crop_width}; "
            if h < crop_height:
                msg += f"height {h} < {crop_height}; "
            Print.info(msg.strip() + " Copying original image instead.")
            if out_path and out_path != path:
                makedirs(ospath.dirname(out_path), exist_ok=True)
                img.save(out_path)
                Print.success(f"Copied original image to '{out_path}'.")
            elif out_path == path or out_path is None:
                Print.success(f"No action taken for '{path}'.")
            else:
                Print.info(f"No action for '{path}', output path: '{out_path}'.")
            return
        # Crop center
        left = max((w - crop_width) // 2, 0)
        top = max((h - crop_height) // 2, 0)
        right = left + crop_width
        bottom = top + crop_height
        cropped = img.crop((left, top, right, bottom))
        if out_path:
            show_path = path
            if "cache" in path:
                show_path = get_path_relative_by_cache_dir(path)
            makedirs(ospath.dirname(out_path), exist_ok=True)
            cropped.save(out_path)
            Print.success(f"Cropped center {crop_width}x{crop_height} from '{show_path}' to '{out_path}'.")
        else:
            cropped.save(path)
            Print.success(f"Cropped center {crop_width}x{crop_height} and overwritten '{path}'.")

def normalize_path(path: str) -> str:
    normalized_path = os.path.normpath(path)
    linux_path = normalized_path.replace('\\', '/')
    return linux_path

def get_path_relative_by_cache_dir(full_path: str) -> str:

    normalized_full_path = normalize_path(full_path)
    normalized_root = normalize_path(build_provider.EXTERNAL_CACHE_DIR)

    if not normalized_root.endswith('/'):
        normalized_root += '/'

    if normalized_full_path.startswith(normalized_root):
        relative_path = normalized_full_path[len(normalized_root):]
        return relative_path
    else:
        return normalized_full_path
    