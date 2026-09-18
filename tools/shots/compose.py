#!/usr/bin/env python3
"""Turns raw screenshots (tools/shots/raw) into README assets in docs/:
   screens/*.png, hero.png (three phones), drag.gif, social-preview.png"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAW = os.path.join(os.path.dirname(__file__), "raw")
DOCS = os.path.join(os.path.dirname(__file__), "..", "..", "docs")
os.makedirs(os.path.join(DOCS, "screens"), exist_ok=True)
BG = (242, 242, 247); GREEN = (23, 160, 94); INK = (11, 11, 12); MUTED = (108, 108, 112)

def raw(name): return Image.open(os.path.join(RAW, name + ".png")).convert("RGBA")

def phone(im, radius=72, shadow=True):
    """Round the corners and add a soft shadow. Input is a 780×1688 (2x) screenshot."""
    w, h = im.size
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=255)
    out = im.copy(); out.putalpha(mask)
    if not shadow: return out
    pad = 90
    canvas = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    sh = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([pad, pad + 24, pad + w, pad + h + 24], radius=radius, fill=(0, 0, 0, 70))
    sh = sh.filter(ImageFilter.GaussianBlur(40))
    canvas.alpha_composite(sh); canvas.alpha_composite(out, (pad, pad))
    return canvas

# 1. individual screens (2x, rounded, no shadow) — used in the features list
for n in ["timeline", "tasks", "dark", "notes"]:
    phone(raw(n), shadow=False).save(os.path.join(DOCS, "screens", n + ".png"), optimize=True)

# 2. hero: three phones on the app background
shots = [phone(raw(n)) for n in ["timeline", "tasks", "dark"]]
gap = -60
W = sum(s.width for s in shots) + gap * 2 + 120
H = shots[0].height + 80
hero = Image.new("RGBA", (W, H), BG + (255,))
x = 60
for s in shots:
    hero.alpha_composite(s, (x, 40)); x += s.width + gap
hero = hero.resize((W // 2, H // 2), Image.LANCZOS)
hero.convert("RGB").save(os.path.join(DOCS, "hero.png"), optimize=True)

# 3. drag GIF: crop to header + timeline area, 1x, short loop with a hold on the last frame
frames = []
for n in ["drag0", "drag1", "drag2", "drag3", "drag4", "dragdone"]:
    im = raw(n).convert("RGB").crop((0, 0, 780, 1240)).resize((390, 620), Image.LANCZOS)
    frames.append(im.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
durations = [900, 220, 220, 220, 260, 1800]
frames[0].save(os.path.join(DOCS, "drag.gif"), save_all=True, append_images=frames[1:],
               duration=durations, loop=0, optimize=True)

# 4. social preview 1280×640
sp = Image.new("RGBA", (2560, 1280), BG + (255,))
d = ImageDraw.Draw(sp)
try:
    fBig = ImageFont.truetype("/System/Library/Fonts/SFNS.ttf", 168)
    fMid = ImageFont.truetype("/System/Library/Fonts/SFNS.ttf", 58)
    fSm = ImageFont.truetype("/System/Library/Fonts/SFNS.ttf", 46)
except Exception:
    fBig = fMid = fSm = ImageFont.load_default()
# logo mark: green rounded square with the timeline glyph from the app icon
icon = Image.open(os.path.join(DOCS, "..", "icons", "icon-512.png")).convert("RGBA").resize((200, 200), Image.LANCZOS)
sp.alpha_composite(icon, (160, 190))
d.text((400, 170), "Planly", font=fBig, fill=INK)
d.text((170, 470), "A minimalist day planner that lives in your browser.", font=fMid, fill=INK)
lines = ["Timeline · repeats · calendar · tasks in folders · notes",
         "Offline-first, no accounts, one HTML file",
         "Optional sync between devices with a single code"]
y = 600
for ln in lines:
    d.ellipse([172, y + 18, 190, y + 36], fill=GREEN)
    d.text((220, y), ln, font=fSm, fill=MUTED); y += 78
# two phones on the right, slightly overlapping, cropped by the canvas edge
p1 = phone(raw("timeline")); p2 = phone(raw("dark"))
scale = 0.62
p1 = p1.resize((int(p1.width * scale), int(p1.height * scale)), Image.LANCZOS)
p2 = p2.resize((int(p2.width * scale), int(p2.height * scale)), Image.LANCZOS)
sp.alpha_composite(p2, (1900, 220)); sp.alpha_composite(p1, (1560, 120))
sp = sp.resize((1280, 640), Image.LANCZOS)
sp.convert("RGB").save(os.path.join(DOCS, "social-preview.png"), optimize=True)

for f in ["hero.png", "drag.gif", "social-preview.png", "screens/timeline.png"]:
    print(f, os.path.getsize(os.path.join(DOCS, f)) // 1024, "KB")
