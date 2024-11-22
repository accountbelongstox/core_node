from PIL import Image
import os
from datetime import datetime

def process_images(input_folder, output_folder, target_width, target_height, border_size):
    # 创建输出目录
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    output_folder = os.path.join(output_folder, f"output_{timestamp}")
    os.makedirs(output_folder, exist_ok=True)

    # 获取输入目录中的所有图片文件
    image_files = [f for f in os.listdir(input_folder) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif'))]

    for image_file in image_files:
        input_path = os.path.join(input_folder, image_file)
        output_path = os.path.join(output_folder, image_file)

        # 打开图像文件
        with Image.open(input_path) as img:
            # 缩小图像
            resized_img = img.resize((target_width, target_height))

            # 创建一个新的图像，增加外围
            new_width = target_width + 2 * border_size
            new_height = target_height + 2 * border_size
            bordered_img = Image.new("RGBA", (new_width, new_height), (0, 0, 0, 0))
            bordered_img.paste(resized_img, (border_size, border_size))

            # 保存图像
            bordered_img.save(output_path)

if __name__ == "__main__":
    # 输入文件夹路径
    input_folder_path = "../public/images/menu_raw"
    
    # 输出文件夹路径
    output_folder_path = "../public/images/menu_out"
    
    # 目标宽度和高度
    target_width = 20
    target_height = 20
    
    # 外围增加的宽度和高度
    border_size = 5

    process_images(input_folder_path, output_folder_path, target_width, target_height, border_size)
