"""Génère les icônes PNG de la PWA à partir de src/app/brand.ts (lettre et couleurs du logo).

Usage : python3 scripts/brand-png.py   (nécessite Pillow ; à relancer si le logo change)
Les icônes SVG, elles, sont régénérées automatiquement à chaque build (scripts/brand-icons.ts).
"""
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent.parent
src = (root / 'src/app/brand.ts').read_text(encoding='utf-8')
monogram = re.search(r"monogram:\s*'([^']+)'", src).group(1)
colors = dict(re.findall(r"(background|mark|markText):\s*'(#[0-9A-Fa-f]{6})'", src))

FONTS = ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf']
font_path = next((f for f in FONTS if Path(f).exists()), None)


def icon(size: int, maskable: bool) -> Image.Image:
    img = Image.new('RGB', (size, size), colors['mark'] if maskable else colors['background'])
    d = ImageDraw.Draw(img)
    inset = 0 if maskable else round(size * 10 / 64)
    d.rectangle([inset, inset, size - inset - 1, size - inset - 1], fill=colors['mark'])
    fs = round(size * (0.40 if maskable else 0.5))
    font = ImageFont.truetype(font_path, fs) if font_path else ImageFont.load_default()
    d.text((size / 2, size / 2), monogram, fill=colors['markText'], font=font, anchor='mm')
    return img


out = root / 'public/icons'
for size in (192, 512):
    icon(size, False).save(out / f'icon-{size}.png', optimize=True)
icon(512, True).save(out / 'icon-maskable-512.png', optimize=True)
icon(180, False).save(out / 'apple-touch-icon.png', optimize=True)
print('Icônes PNG régénérées dans public/icons/')
