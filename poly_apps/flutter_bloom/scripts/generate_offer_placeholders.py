#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate placeholder images for credit card offers section
"""

from pathlib import Path
try:
    from PIL import Image, ImageDraw, ImageFont
    HAS_PIL = True
except ImportError:
    HAS_PIL = False
    print("PIL not available, creating simple placeholder files")

def create_placeholder_image(output_path: Path, width: int, height: int, 
                            bg_color: str, text: str, text_color: str = '#333333'):
    """Create a placeholder image with text"""
    if not HAS_PIL:
        # Create a simple text file as placeholder
        output_path.write_text(f"Placeholder: {text} ({width}x{height})")
        return
    
    img = Image.new('RGB', (width, height), color=bg_color)
    draw = ImageDraw.Draw(img)
    
    # Try to use a font, fallback to default if not available
    try:
        font = ImageFont.truetype("arial.ttf", 40)
    except:
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 40)
        except:
            font = ImageFont.load_default()
    
    # Calculate text position (center)
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (width - text_width) // 2
    y = (height - text_height) // 2
    
    # Draw text
    draw.text((x, y), text, fill=text_color, font=font)
    
    # Save image
    img.save(output_path)
    print(f"Created: {output_path}")

def main():
    # Output directory
    output_dir = Path(__file__).parent.parent / "assets" / "apps" / "app_bank" / "images"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Create placeholder images
    # 1. Main background for "Play Around the World" card
    create_placeholder_image(
        output_dir / "offer_world_bg.png",
        width=800,
        height=400,
        bg_color="#E8F4F8",
        text="玩转世界\nPlay Around the World"
    )
    
    # 2. Background for "Enjoy Fun Snow Season" card
    create_placeholder_image(
        output_dir / "offer_snow_bg.png",
        width=300,
        height=200,
        bg_color="#F0F8FF",
        text="享趣 冰雪季"
    )
    
    # 3. Background for "UnionPay Platinum Car Card" card
    create_placeholder_image(
        output_dir / "offer_car_card_bg.png",
        width=300,
        height=200,
        bg_color="#FFF8DC",
        text="运通白金汽车卡"
    )
    
    print("All placeholder images generated!")

if __name__ == "__main__":
    main()
