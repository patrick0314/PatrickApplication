import os
from PIL import Image, ImageDraw, ImageFont

os.makedirs('icons', exist_ok=True)

def create_app_icon(size, output_path):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    corner_radius = int(size * 0.22)
    
    # 1. Background gradient (Deep Tech Indigo to Vibrant Violet)
    # We draw subtle horizontal gradient slices
    for y in range(size):
        ratio = y / size
        # From #312E81 (49, 46, 129) to #4F46E5 (79, 70, 229) to #6366F1 (99, 102, 241)
        if ratio < 0.5:
            local_ratio = ratio * 2
            r = int(49 + (79 - 49) * local_ratio)
            g = int(46 + (70 - 46) * local_ratio)
            b = int(129 + (229 - 129) * local_ratio)
        else:
            local_ratio = (ratio - 0.5) * 2
            r = int(79 + (99 - 79) * local_ratio)
            g = int(70 + (102 - 70) * local_ratio)
            b = int(229 + (241 - 229) * local_ratio)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))
    
    # Create mask for rounded corners
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([(0, 0), (size, size)], radius=corner_radius, fill=255)
    img.putalpha(mask)

    draw = ImageDraw.Draw(img)

    # 2. Inner subtle glow border
    glow_color = (255, 255, 255, 60)
    draw.rounded_rectangle(
        [(int(size * 0.035), int(size * 0.035)), (int(size * 0.965), int(size * 0.965))],
        radius=int(corner_radius * 0.85),
        outline=glow_color,
        width=max(2, int(size * 0.018))
    )

    # 3. Modern Tech Emblem: Geometric Stylized "P"
    # Stem: vertical rounded rectangle
    stem_left = int(size * 0.28)
    stem_right = int(size * 0.44)
    stem_top = int(size * 0.22)
    stem_bottom = int(size * 0.78)
    stem_radius = int(size * 0.06)

    # White base for stem
    draw.rounded_rectangle(
        [(stem_left, stem_top), (stem_right, stem_bottom)],
        radius=stem_radius,
        fill=(255, 255, 255, 255)
    )

    # Loop of "P": top outer circle/rounded rectangle
    loop_left = stem_left
    loop_right = int(size * 0.76)
    loop_top = stem_top
    loop_bottom = int(size * 0.54)
    loop_radius = int((loop_bottom - loop_top) / 2)

    draw.rounded_rectangle(
        [(loop_left, loop_top), (loop_right, loop_bottom)],
        radius=loop_radius,
        fill=(255, 255, 255, 255)
    )

    # Cut out inner hole of the "P" loop (transparent or gradient-colored)
    hole_left = stem_right
    hole_right = int(size * 0.62)
    hole_top = int(size * 0.32)
    hole_bottom = int(size * 0.44)
    hole_radius = int((hole_bottom - hole_top) / 2)

    draw.rounded_rectangle(
        [(hole_left, hole_top), (hole_right, hole_bottom)],
        radius=hole_radius,
        fill=(67, 56, 202, 255) # matches background indigo
    )

    # 4. Subtle accent star/spark in bottom right
    spark_c = (int(size * 0.70), int(size * 0.72))
    spark_r = max(4, int(size * 0.045))
    draw.ellipse(
        [(spark_c[0] - spark_r, spark_c[1] - spark_r), (spark_c[0] + spark_r, spark_c[1] + spark_r)],
        fill=(238, 242, 255, 220)
    )

    img.save(output_path, 'PNG')
    print(f"Generated {output_path} ({size}x{size})")

create_app_icon(192, 'icons/icon-192.png')
create_app_icon(512, 'icons/icon-512.png')
create_app_icon(180, 'icons/apple-touch-icon.png')
