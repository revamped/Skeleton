"""Draw the app icons (the gold "20" diamond on the header color). Run: python3 tools/make-icons.py"""
import os
from PIL import Image, ImageDraw, ImageFont

BG, GOLD, INK = (24, 32, 43), (224, 172, 75), (229, 233, 239)
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
OUT = os.path.join(os.path.dirname(__file__), '..', 'icons')


def icon(size, scale, rounded):
    s = size * 4  # draw large, then downsample for smooth edges
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=BG)
    else:
        d.rectangle([0, 0, s, s], fill=BG)
    c, r = s / 2, s * scale / 2
    d.polygon([(c, c - r), (c + r, c), (c, c + r), (c - r, c)], outline=GOLD, width=max(2, int(s * 0.035)))
    f = ImageFont.truetype(FONT, int(r * 0.78))
    d.text((c, c + r * 0.04), '20', font=f, fill=INK, anchor='mm')
    return img.resize((size, size), Image.LANCZOS)


os.makedirs(OUT, exist_ok=True)
icon(192, 0.78, False).save(os.path.join(OUT, 'icon-192.png'))
icon(512, 0.78, False).save(os.path.join(OUT, 'icon-512.png'))
icon(512, 0.6, False).save(os.path.join(OUT, 'icon-maskable-512.png'))  # stays inside the maskable safe zone
icon(180, 0.74, False).save(os.path.join(OUT, 'apple-touch-icon.png'))
icon(64, 0.84, True).save(os.path.join(OUT, 'favicon.png'))
