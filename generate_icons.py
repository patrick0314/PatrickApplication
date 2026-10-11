import os
from PIL import Image, ImageDraw

os.makedirs('icons', exist_ok=True)

def create_app_icon(size, output_path):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    corner_radius = int(size * 0.22)
    
    # 1. Background gradient (Deep Tech Indigo to Vibrant Violet)
    for y in range(size):
        ratio = y / size
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
    
    # Rounded corners mask
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([(0, 0), (size, size)], radius=corner_radius, fill=255)
    img.putalpha(mask)

    draw = ImageDraw.Draw(img)

    # 2. Subtle inner glow border
    glow_color = (255, 255, 255, 60)
    draw.rounded_rectangle(
        [(int(size * 0.035), int(size * 0.035)), (int(size * 0.965), int(size * 0.965))],
        radius=int(corner_radius * 0.85),
        outline=glow_color,
        width=max(2, int(size * 0.018))
    )

    # 3. Modern Stylized "M" for "My App"
    # Using clean bold strokes
    stroke_w = max(4, int(size * 0.09))
    
    # Left stem
    p1 = (int(size * 0.24), int(size * 0.74))
    p2 = (int(size * 0.24), int(size * 0.28))
    
    # Center vertex
    p3 = (int(size * 0.50), int(size * 0.56))
    
    # Right stem top and bottom
    p4 = (int(size * 0.76), int(size * 0.28))
    p5 = (int(size * 0.76), int(size * 0.74))

    # Draw connected "M"
    draw.line([p1, p2, p3, p4, p5], fill=(255, 255, 255, 255), width=stroke_w, joint="round")
    
    # Smooth rounded endcaps
    r_cap = stroke_w // 2
    for pt in [p1, p2, p4, p5]:
        draw.ellipse([(pt[0] - r_cap, pt[1] - r_cap), (pt[0] + r_cap, pt[1] + r_cap)], fill=(255, 255, 255, 255))

    # 4. Subtle glowing spark accent above center
    spark_c = (int(size * 0.50), int(size * 0.25))
    spark_r = max(3, int(size * 0.035))
    draw.ellipse(
        [(spark_c[0] - spark_r, spark_c[1] - spark_r), (spark_c[0] + spark_r, spark_c[1] + spark_r)],
        fill=(238, 242, 255, 230)
    )

    img.save(output_path, 'PNG')
    print(f"Generated {output_path} ({size}x{size})")

create_app_icon(192, 'icons/icon-192.png')
create_app_icon(512, 'icons/icon-512.png')
create_app_icon(180, 'icons/apple-touch-icon.png')
