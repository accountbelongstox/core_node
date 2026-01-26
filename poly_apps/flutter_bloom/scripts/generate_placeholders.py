from PIL import Image, ImageDraw, ImageFont
import os

def create_placeholder(name, width, height, text=None, bg_color='#E8F4F8', number=None):
    try:
        image = Image.new('RGB', (width, height), color=bg_color)
        draw = ImageDraw.Draw(image)
        
        if number is not None:
            try:
                font_size = min(width, height) // 4
                font = ImageFont.truetype("arial.ttf", font_size)
            except:
                font = ImageFont.load_default()
            
            number_text = str(number)
            bbox = draw.textbbox((0, 0), number_text, font=font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
            x = (width - text_width) / 2
            y = (height - text_height) / 2
            draw.text((x, y), number_text, font=font, fill='#333333')
        elif text:
            try:
                font = ImageFont.truetype("arial.ttf", min(width, height) // 6)
            except:
                font = ImageFont.load_default()
            
            bbox = draw.textbbox((0, 0), text, font=font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
            x = (width - text_width) / 2
            y = (height - text_height) / 2
            draw.text((x, y), text, font=font, fill='#333333')
        
        return image
    except Exception as e:
        print(f"Error creating {name}: {e}")
        return None

if __name__ == "__main__":
    base_path = os.path.join(os.path.dirname(__file__), '..', 'assets', 'apps', 'app_bank', 'images')
    os.makedirs(base_path, exist_ok=True)
    
    images = [
        # Offer Section Images
        ('offer_world_icon', 800, 400, None, '#F0F8FF', 1),
        ('offer_snow_icon', 300, 200, None, '#E0FFFF', 2),
        ('offer_car_card_icon', 300, 200, None, '#F5F5DC', 3),
        ('offer_main_background', 1000, 500, None, '#E8F4F8', 4),
        
        # Installment Benefits Section (分期优享)
        ('installment_pass', 120, 120, None, '#ADD8E6', 5),
        ('renovation_installment', 120, 120, None, '#FFDAB9', 6),
        ('cash_installment', 120, 120, None, '#98FB98', 7),
        ('bill_installment', 120, 120, None, '#DDA0DD', 8),
        
        # Installment Shopping Section (分期购物)
        ('apple_installment', 150, 150, None, '#E0E0E0', 9),
        ('vipshop_installment', 150, 150, None, '#FFC0CB', 10),
        ('taobao_installment', 150, 150, None, '#FF6347', 11),
        ('ctrip_installment', 150, 150, None, '#87CEEB', 12),
        ('xiaomi_installment', 150, 150, None, '#FF8C00', 13),
        ('jd_installment', 150, 150, None, '#00008B', 14),
        
        # Value-added Benefits Section (增值礼遇)
        ('concierge_car_banner', 800, 240, None, '#6A82FB', 15),
        ('coffee_benefits', 200, 200, None, '#F0F8FF', 16),
        ('special_merchandise', 200, 200, None, '#FFF0F5', 17),
        ('monthly_welfare', 200, 200, None, '#F5FFFA', 18),
        
        # Featured Recommendations Section (特色推荐)
        ('jianxin_fudai', 200, 200, None, '#E8F4F8', 19),
        ('newbie_banner', 160, 120, None, '#FFECD2', 20),
    ]
    
    for name, width, height, text, bg_color, number in images:
        img = create_placeholder(name, width, height, text, bg_color, number)
        if img:
            path = os.path.join(base_path, f'{name}.png')
            img.save(path)
            print(f"Created: {path} (Number: {number})")
    
    print("All placeholder images generated!")
