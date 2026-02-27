from PIL import Image
import os

img_path = r'c:\Users\bipla\Desktop\test AI\Fotografia\sfondo.jpg'
if os.path.exists(img_path):
    img = Image.open(img_path)
    # Convert to RGB if necessary
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    # Compress
    img.save(img_path, "JPEG", quality=60, optimize=True)
    print(f"Compressed {img_path}")
else:
    print("File not found")
