#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Image Enhancer - Extensible Image Enhancement Utility
Provides flexible interface for adding text, shapes, sub-images, etc.
"""

from pathlib import Path
from typing import Optional, Tuple, List, Union, Dict, Any
from abc import ABC, abstractmethod

from pycore.pyfoundations.third_party import cv2, numpy, PIL
import numpy as np
from PIL import Image, ImageDraw, ImageFont


class ImageEnhancement(ABC):
    """
    Abstract base class for image enhancements
    Subclasses implement specific enhancement operations
    """

    @abstractmethod
    def apply(self, img: np.ndarray) -> np.ndarray:
        """
        Apply enhancement to image

        Args:
            img: Input image (BGR format, numpy array)

        Returns:
            Enhanced image
        """
        pass


class TextEnhancement(ImageEnhancement):
    """
    Add text to image with advanced styling

    Features:
    - Custom fonts and sizes
    - Text positioning (absolute or relative)
    - Text alignment (left, center, right)
    - Text color with alpha
    - Shadow/outline effects
    - Multi-line support
    """

    def __init__(
        self,
        text: str,
        position: Union[Tuple[int, int], str] = "center",
        font_path: Optional[str] = None,
        font_size: int = 12,
        color: Tuple[int, int, int] = (255, 255, 255),  # White
        shadow_color: Optional[Tuple[int, int, int]] = None,  # e.g., (0x56, 0x34, 0x18)
        shadow_offset: Tuple[int, int] = (2, 2),
        outline_color: Optional[Tuple[int, int, int]] = None,
        outline_width: int = 1,
        alignment: str = "center",  # left, center, right
        padding: int = 5
    ):
        """
        Initialize text enhancement

        Args:
            text: Text to render
            position: Position (x, y) or "center", "top", "bottom", etc.
            font_path: Path to TTF font file (None = default)
            font_size: Font size in pixels
            color: Text color (R, G, B)
            shadow_color: Shadow color (None = no shadow)
            shadow_offset: Shadow offset (x, y)
            outline_color: Outline color (None = no outline)
            outline_width: Outline width in pixels
            alignment: Text alignment
            padding: Padding from edges when using position keywords
        """
        self.text = text
        self.position = position
        self.font_path = font_path
        self.font_size = font_size
        self.color = color
        self.shadow_color = shadow_color
        self.shadow_offset = shadow_offset
        self.outline_color = outline_color
        self.outline_width = outline_width
        self.alignment = alignment
        self.padding = padding

    def apply(self, img: np.ndarray) -> np.ndarray:
        """Apply text enhancement"""
        # Convert BGR to RGB for PIL
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(img_rgb)
        draw = ImageDraw.Draw(pil_img)

        # Load font
        try:
            if self.font_path and Path(self.font_path).exists():
                font = ImageFont.truetype(self.font_path, self.font_size)
            else:
                # Try to use default font
                font = ImageFont.load_default()
        except:
            font = ImageFont.load_default()

        # Get text bounding box
        bbox = draw.textbbox((0, 0), self.text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]

        # Calculate position
        img_h, img_w = img.shape[:2]
        if isinstance(self.position, str):
            x, y = self._calculate_position(
                img_w, img_h, text_width, text_height
            )
        else:
            x, y = self.position

        # Draw shadow
        if self.shadow_color:
            shadow_pos = (x + self.shadow_offset[0], y + self.shadow_offset[1])
            draw.text(shadow_pos, self.text, font=font, fill=self.shadow_color)

        # Draw outline
        if self.outline_color and self.outline_width > 0:
            for offset_x in range(-self.outline_width, self.outline_width + 1):
                for offset_y in range(-self.outline_width, self.outline_width + 1):
                    if offset_x != 0 or offset_y != 0:
                        outline_pos = (x + offset_x, y + offset_y)
                        draw.text(outline_pos, self.text, font=font, fill=self.outline_color)

        # Draw main text
        draw.text((x, y), self.text, font=font, fill=self.color)

        # Convert back to BGR
        img_result = np.array(pil_img)
        img_result = cv2.cvtColor(img_result, cv2.COLOR_RGB2BGR)

        return img_result

    def _calculate_position(
        self,
        img_w: int,
        img_h: int,
        text_w: int,
        text_h: int
    ) -> Tuple[int, int]:
        """Calculate text position from keyword"""
        positions = {
            "center": (img_w // 2 - text_w // 2, img_h // 2 - text_h // 2),
            "top": (img_w // 2 - text_w // 2, self.padding),
            "bottom": (img_w // 2 - text_w // 2, img_h - text_h - self.padding),
            "left": (self.padding, img_h // 2 - text_h // 2),
            "right": (img_w - text_w - self.padding, img_h // 2 - text_h // 2),
            "top-left": (self.padding, self.padding),
            "top-right": (img_w - text_w - self.padding, self.padding),
            "bottom-left": (self.padding, img_h - text_h - self.padding),
            "bottom-right": (img_w - text_w - self.padding, img_h - text_h - self.padding)
        }
        return positions.get(self.position, positions["center"])


class ShapeEnhancement(ImageEnhancement):
    """
    Add shapes (rectangles, circles, etc.) to image
    """

    def __init__(
        self,
        shape_type: str,  # "rectangle", "circle", "polygon"
        position: Tuple[int, int],
        size: Tuple[int, int],
        color: Tuple[int, int, int] = (255, 0, 0),
        thickness: int = -1,  # -1 = filled
        alpha: float = 1.0
    ):
        """
        Initialize shape enhancement

        Args:
            shape_type: Type of shape
            position: Position (x, y)
            size: Size (width, height) or radius for circle
            color: Shape color (B, G, R)
            thickness: Line thickness (-1 = filled)
            alpha: Transparency (0.0-1.0)
        """
        self.shape_type = shape_type
        self.position = position
        self.size = size
        self.color = color
        self.thickness = thickness
        self.alpha = alpha

    def apply(self, img: np.ndarray) -> np.ndarray:
        """Apply shape enhancement"""
        overlay = img.copy()

        if self.shape_type == "rectangle":
            x, y = self.position
            w, h = self.size
            cv2.rectangle(overlay, (x, y), (x + w, y + h), self.color, self.thickness)

        elif self.shape_type == "circle":
            x, y = self.position
            radius = self.size[0] if isinstance(self.size, tuple) else self.size
            cv2.circle(overlay, (x, y), radius, self.color, self.thickness)

        # Blend with alpha
        if self.alpha < 1.0:
            img = cv2.addWeighted(overlay, self.alpha, img, 1 - self.alpha, 0)
        else:
            img = overlay

        return img


class SubImageEnhancement(ImageEnhancement):
    """
    Paste smaller images onto the main image
    """

    def __init__(
        self,
        sub_image_path: Union[str, Path, np.ndarray],
        position: Union[Tuple[int, int], str] = "center",
        scale: float = 1.0,
        alpha: float = 1.0
    ):
        """
        Initialize sub-image enhancement

        Args:
            sub_image_path: Path to sub-image or image array
            position: Position to paste (x, y) or keyword
            scale: Scale factor for sub-image
            alpha: Transparency (0.0-1.0)
        """
        self.sub_image_path = sub_image_path
        self.position = position
        self.scale = scale
        self.alpha = alpha

    def apply(self, img: np.ndarray) -> np.ndarray:
        """Apply sub-image enhancement"""
        # Load sub-image
        if isinstance(self.sub_image_path, np.ndarray):
            sub_img = self.sub_image_path
        else:
            sub_img = cv2.imread(str(self.sub_image_path), cv2.IMREAD_UNCHANGED)
            if sub_img is None:
                print(f"WARNING: Failed to load sub-image: {self.sub_image_path}")
                return img

        # Scale sub-image
        if self.scale != 1.0:
            new_w = int(sub_img.shape[1] * self.scale)
            new_h = int(sub_img.shape[0] * self.scale)
            sub_img = cv2.resize(sub_img, (new_w, new_h))

        # Calculate position
        img_h, img_w = img.shape[:2]
        sub_h, sub_w = sub_img.shape[:2]

        if isinstance(self.position, str):
            if self.position == "center":
                x = img_w // 2 - sub_w // 2
                y = img_h // 2 - sub_h // 2
            else:
                x, y = 0, 0
        else:
            x, y = self.position

        # Ensure within bounds
        x = max(0, min(x, img_w - sub_w))
        y = max(0, min(y, img_h - sub_h))

        # Paste sub-image
        if sub_img.shape[2] == 4:  # Has alpha channel
            # Blend using alpha channel
            alpha_mask = sub_img[:, :, 3] / 255.0 * self.alpha
            for c in range(3):
                img[y:y+sub_h, x:x+sub_w, c] = (
                    alpha_mask * sub_img[:, :, c] +
                    (1 - alpha_mask) * img[y:y+sub_h, x:x+sub_w, c]
                )
        else:
            # Simple blend
            overlay = img.copy()
            overlay[y:y+sub_h, x:x+sub_w] = sub_img[:, :, :3]
            img = cv2.addWeighted(overlay, self.alpha, img, 1 - self.alpha, 0)

        return img


class RandomTimeTextEnhancement(TextEnhancement):
    """
    Specialized enhancement for adding random time text (xx:xx format)
    """

    def __init__(
        self,
        position: Union[Tuple[int, int], str] = "center",
        font_size: int = 12,
        **kwargs
    ):
        """
        Initialize random time text enhancement

        Args:
            position: Position for time text
            font_size: Font size
            **kwargs: Additional TextEnhancement arguments
        """
        # Generate random time
        hours = np.random.randint(0, 24)
        minutes = np.random.randint(0, 60)
        time_text = f"{hours:02d}:{minutes:02d}"

        # Default styling for time
        defaults = {
            "color": (255, 255, 255),  # White
            "shadow_color": (0x18, 0x34, 0x56),  # Dark shadow
            "shadow_offset": (1, 1),
            "alignment": "center"
        }
        defaults.update(kwargs)

        super().__init__(
            text=time_text,
            position=position,
            font_size=font_size,
            **defaults
        )


class ImageEnhancer:
    """
    Main image enhancer class that applies multiple enhancements
    """

    def __init__(self):
        """Initialize image enhancer"""
        self.enhancements: List[ImageEnhancement] = []

    def add_enhancement(self, enhancement: ImageEnhancement) -> 'ImageEnhancer':
        """
        Add an enhancement to the pipeline

        Args:
            enhancement: Enhancement to add

        Returns:
            Self for chaining
        """
        self.enhancements.append(enhancement)
        return self

    def add_text(
        self,
        text: str,
        position: Union[Tuple[int, int], str] = "center",
        **kwargs
    ) -> 'ImageEnhancer':
        """Convenience method to add text enhancement"""
        self.add_enhancement(TextEnhancement(text, position, **kwargs))
        return self

    def add_random_time(
        self,
        position: Union[Tuple[int, int], str] = "center",
        **kwargs
    ) -> 'ImageEnhancer':
        """Convenience method to add random time text"""
        self.add_enhancement(RandomTimeTextEnhancement(position, **kwargs))
        return self

    def add_shape(
        self,
        shape_type: str,
        position: Tuple[int, int],
        size: Tuple[int, int],
        **kwargs
    ) -> 'ImageEnhancer':
        """Convenience method to add shape enhancement"""
        self.add_enhancement(ShapeEnhancement(shape_type, position, size, **kwargs))
        return self

    def add_sub_image(
        self,
        sub_image_path: Union[str, Path, np.ndarray],
        position: Union[Tuple[int, int], str] = "center",
        **kwargs
    ) -> 'ImageEnhancer':
        """Convenience method to add sub-image enhancement"""
        self.add_enhancement(SubImageEnhancement(sub_image_path, position, **kwargs))
        return self

    def apply(self, img: np.ndarray) -> np.ndarray:
        """
        Apply all enhancements to image

        Args:
            img: Input image

        Returns:
            Enhanced image
        """
        result = img.copy()
        for enhancement in self.enhancements:
            result = enhancement.apply(result)
        return result

    def clear(self) -> 'ImageEnhancer':
        """Clear all enhancements"""
        self.enhancements.clear()
        return self


# Factory function for creating enhancement configs from dict
def create_enhancement_from_config(config: Dict[str, Any]) -> Optional[ImageEnhancement]:
    """
    Create enhancement from configuration dictionary

    Args:
        config: Configuration dict with 'type' key and parameters

    Returns:
        Enhancement instance or None

    Example:
        config = {
            "type": "text",
            "text": "12:34",
            "position": "center",
            "font_size": 12,
            "color": [255, 255, 255],
            "shadow_color": [0x18, 0x34, 0x56]
        }
    """
    enhancement_type = config.get("type")

    if enhancement_type == "text":
        return TextEnhancement(**{k: v for k, v in config.items() if k != "type"})

    elif enhancement_type == "random_time":
        return RandomTimeTextEnhancement(**{k: v for k, v in config.items() if k != "type"})

    elif enhancement_type == "shape":
        return ShapeEnhancement(**{k: v for k, v in config.items() if k != "type"})

    elif enhancement_type == "sub_image":
        return SubImageEnhancement(**{k: v for k, v in config.items() if k != "type"})

    return None


# Example usage
if __name__ == "__main__":
    # Load test image
    img = np.ones((100, 256, 3), dtype=np.uint8) * 50

    # Create enhancer
    enhancer = ImageEnhancer()

    # Add enhancements
    enhancer.add_random_time(
        position="center",
        font_size=12,
        color=(255, 255, 255),
        shadow_color=(0x18, 0x34, 0x56)
    )

    # Apply
    result = enhancer.apply(img)

    # Save
    cv2.imwrite("enhanced_test.png", result)
    print("Test image created: enhanced_test.png")
