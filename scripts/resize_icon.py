from PIL import Image
import os

# Kaynak icon.png dosyasından W harfini çekelim
img = Image.open('assets/icon.png').convert('RGBA')

# Lacivert zemin rengi: (10, 26, 60) civarı.
# Sadece beyaz/açık gri pikselleri (W harfini) tut, lacivert zemini tamamen şeffaf yap!
datas = img.getdata()
new_data = []
for item in datas:
    r, g, b, a = item
    # Eğer piksel koyu lacivert/mavi zemin ise -> tamamen şeffaf yap
    if r < 80 and g < 100 and b < 140:
        new_data.append((0, 0, 0, 0))
    else:
        # W harfi piksellerini koru
        new_data.append((r, g, b, a))

w_only = Image.new('RGBA', img.size)
w_only.putdata(new_data)

bbox = w_only.getbbox()
if bbox:
    cropped_w = w_only.crop(bbox)
else:
    cropped_w = w_only

# 1024x1024 şeffaf foreground tuvali
canvas_size = 1024
fg = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))

# W harfini %42 ölçeğe küçült (yaklaşık 430px) - bacaklar asla kesilmez
target_size = int(canvas_size * 0.42)
w_w, w_h = cropped_w.size
ratio = min(target_size / w_w, target_size / w_h)
new_size = (int(w_w * ratio), int(w_h * ratio))
resized_w = cropped_w.resize(new_size, Image.Resampling.LANCZOS)

# Merkeze yapıştır
offset_x = (canvas_size - new_size[0]) // 2
offset_y = (canvas_size - new_size[1]) // 2
fg.paste(resized_w, (offset_x, offset_y), resized_w)

# Kaydet
fg.save('assets/adaptive-icon.png', 'PNG')
print("assets/adaptive-icon.png: W isolated on transparent canvas.")

# Mipmap klasörlerine foreground olarak yaz
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
        target_file = os.path.join(folder_path, 'ic_launcher_foreground.webp')
        resized_fg = fg.resize((size, size), Image.Resampling.LANCZOS)
        resized_fg.save(target_file, 'WEBP')
        print(f"Updated foreground {target_file} -> {size}x{size}")
