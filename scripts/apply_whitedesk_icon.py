from PIL import Image
import os

src_path = 'assets/WhiteDEsk.png'
if not os.path.exists(src_path):
    src_path = 'assets/whitedesk.png'

img = Image.open(src_path).convert('RGBA')

# 1. assets/icon.png ve assets/adaptive-icon.png olarak güncelle
img.save('assets/icon.png', 'PNG')
img.save('assets/adaptive-icon.png', 'PNG')

# 2. Android Adaptive Foreground:
# 1024x1024 şeffaf canvas oluştur, WhiteDEsk logosunu %70 ölçekle ortala (Android kesiminde tam sığsın)
canvas_size = 1024
fg_canvas = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))

# Bounding box bul
bbox = img.getbbox()
cropped = img.crop(bbox) if bbox else img

target_size = int(canvas_size * 0.72)
w_w, w_h = cropped.size
ratio = min(target_size / w_w, target_size / w_h)
new_size = (int(w_w * ratio), int(w_h * ratio))
resized = cropped.resize(new_size, Image.Resampling.LANCZOS)

offset_x = (canvas_size - new_size[0]) // 2
offset_y = (canvas_size - new_size[1]) // 2
fg_canvas.paste(resized, (offset_x, offset_y), resized)

# 3. Android res klasörlerine yaz
densities = {
    'mipmap-mdpi': 108,
    'mipmap-hdpi': 162,
    'mipmap-xhdpi': 216,
    'mipmap-xxhdpi': 324,
    'mipmap-xxxhdpi': 432
}

base_res = 'android/app/src/main/res'
for folder, size in densities.items():
    folder_path = os.path.join(base_res, folder)
    if os.path.exists(folder_path):
        # Foreground
        target_fg = os.path.join(folder_path, 'ic_launcher_foreground.webp')
        resized_fg = fg_canvas.resize((size, size), Image.Resampling.LANCZOS)
        resized_fg.save(target_fg, 'WEBP')

        # Normal ic_launcher ve round (legacy destek için)
        target_icon = os.path.join(folder_path, 'ic_launcher.webp')
        target_round = os.path.join(folder_path, 'ic_launcher_round.webp')
        resized_fg.save(target_icon, 'WEBP')
        resized_fg.save(target_round, 'WEBP')
        print(f"Updated {folder} icons -> {size}x{size}")

print("All Android launcher icons successfully updated with assets/WhiteDEsk.png!")
