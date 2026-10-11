import os
from PIL import Image, ImageDraw, ImageFont

os.makedirs('icons', exist_ok=True)

def create_app_icon(size, output_path):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Rounded rectangle background with modern gradient-like color
    corner_radius = int(size * 0.22)
    bg_color = (79, 70, 229, 255) # Indigo-600
    
    draw.rounded_rectangle([(0, 0), (size, size)], radius=corner_radius, fill=bg_color)
    
    # Inner subtle glow/border
    border_color = (129, 140, 248, 120)
    draw.rounded_rectangle([(int(size*0.04), int(size*0.04)), (int(size*0.96), int(size*0.96))], 
                           radius=int(corner_radius*0.85), outline=border_color, width=max(2, int(size*0.02)))
    
    # Draw checkmark & spark icon motif
    # Center circle
    center = size // 2
    r = int(size * 0.28)
    draw.ellipse([(center - r, center - r), (center + r, center + r)], fill=(99, 102, 241, 255))
    
    # Checkmark lines
    stroke_w = max(4, int(size * 0.07))
    p1 = (int(size * 0.36), int(size * 0.51))
    p2 = (int(size * 0.46), int(size * 0.62))
    p3 = (int(size * 0.66), int(size * 0.38))
    
    draw.line([p1, p2], fill=(255, 255, 255, 255), width=stroke_w, joint="curve")
    draw.line([p2, p3], fill=(255, 255, 255, 255), width=stroke_w, joint="curve")
    
    # Little spark on top right
    spark_c = (int(size * 0.72), int(size * 0.26))
    spark_r = max(3, int(size * 0.05))
    draw.ellipse([(spark_c[0]-spark_r, spark_c[1]-spark_r), (spark_c[0]+spark_r, spark_c[1]+spark_r)], fill=(244, 208, 63, 255))

    img.save(output_path, 'PNG')
    print(f"Generated {output_path} ({size}x{size})")

create_app_icon(192, 'icons/icon-192.png')
create_app_icon(512, 'icons/icon-512.png')
create_app_icon(180, 'icons/apple-touch-icon.png')
