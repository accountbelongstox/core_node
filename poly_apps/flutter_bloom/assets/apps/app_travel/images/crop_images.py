from PIL import Image
import os

def crop_images_to_smallest():
    """
    Crops a set of hotel recommendation images to the smallest dimension found among them.
    """
    try:
        base_path = r"D:\programing\core_node\poly_apps\flutter_bloom\assets\apps\app_travel\images"
        image_names = ["hotel_recommend_1.png", "hotel_recommend_2.png", "hotel_recommend_3.png"]
        image_paths = [os.path.join(base_path, name) for name in image_names]

        images = [Image.open(p) for p in image_paths]
        sizes = [img.size for img in images]

        min_width = min(s[0] for s in sizes)
        min_height = min(s[1] for s in sizes)

        for i, img in enumerate(images):
            width, height = img.size
            left = (width - min_width) / 2
            top = (height - min_height) / 2
            right = (width + min_width) / 2
            bottom = (height + min_height) / 2

            cropped_img = img.crop((left, top, right, bottom))
            cropped_img.save(image_paths[i])
            print(f"Cropped and saved {image_paths[i]}")

    except FileNotFoundError as e:
        print(f"Error: {e}. Please check the file paths.")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    crop_images_to_smallest()
