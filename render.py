"""Self-contained Fairydust renderer: Python 3.10+, Pillow, resvg-py, FFmpeg.
Run python3 render.py [--format both|landscape|portrait].
"""
from pathlib import Path
import argparse
import io
import math
import random
import subprocess
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont
import resvg_py

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'build'
ASSETS = ROOT / 'assets'
FPS, SECONDS = 30, 4
BACKGROUND, CREAM = '#9198bd', '#e1ecd1'
COLORS = ['#ea6f82', '#f88a30', '#ffbc40', '#75b44b', '#9fa4e8', '#c892d6']


def raster(svg, width):
    return Image.open(io.BytesIO(resvg_py.svg_to_bytes(svg_string=svg, width=width))).convert('RGBA')


def rocket_svg():
    ns = 'http://www.w3.org/2000/svg'
    ET.register_namespace('', ns)
    root = ET.parse(ASSETS / 'Fairydust.svg').getroot()
    content = root.find(f'{{{ns}}}g')
    group = content.find(f'{{{ns}}}g')
    group.remove(group.find(f'{{{ns}}}ellipse'))
    paths = group.find(f'{{{ns}}}g')
    paths.remove(paths.find(f'{{{ns}}}path[@class="cls-1"]'))
    root.set('fill', CREAM)
    root.set('viewBox', '-16 -16 130 130')
    content.set('transform', 'rotate(48 48.26 50.3)')
    return ET.tostring(root, encoding='unicode')


class Scene:
    def __init__(self, portrait=False):
        self.portrait = portrait
        self.w, self.h = (720, 1280) if portrait else (1280, 720)
        self.size = (1080, 1920) if portrait else (1920, 1080)
        self.name = '40c3-fairydust-9x16' if portrait else '40c3-fairydust-16x9'
        self.cx, self.cy = (360, 360) if portrait else (520, 370)
        width = 520 if portrait else 500
        self.stripe = 20 if portrait else 19
        image = raster(rocket_svg(), 2080)
        image = image.crop(image.getbbox())
        self.ship = image.resize((width, round(width * image.height / image.width)), Image.Resampling.LANCZOS)
        if portrait:
            self.ship = self.ship.transpose(Image.Transpose.ROTATE_90)
        svg = (ASSETS / '40C3_Logo_0.svg').read_text().replace('#75b44b', CREAM)
        self.logo = raster(svg, 112)
        self.title = ImageFont.truetype(str(ASSETS / 'jersey-10-latin-400-normal.ttf'), 86 if portrait else 88)
        self.nick = ImageFont.truetype(str(ASSETS / 'Hack-Regular.ttf'), 32 if portrait else 30)
        rng = random.Random(40)
        self.stars = [(rng.randrange(12, self.w - 12), rng.randrange(12, self.h - 8),
                       rng.choice([2, 3]), rng.randrange(12), rng.choice([2, 3])) for _ in range(62 if portrait else 54)]

    def render(self, n):
        n %= FPS * SECONDS
        im = Image.new('RGB', (self.w, self.h), BACKGROUND)
        d = ImageDraw.Draw(im)
        # Six discrete sparkle stages: dot, cross, expanding cross, four points,
        # widely spaced points, blank. No slow fades; inspired by Nyan Cat.
        for sx, sy, pixel, offset, speed in self.stars:
            if self.portrait:
                x = sx
                y = round((sy + self.h * speed * n / (FPS * SECONDS)) % self.h) % self.h
            else:
                x = round((sx - self.w * speed * n / (FPS * SECONDS)) % self.w) % self.w
                y = sy
            if y < (300 if self.portrait else 190):
                continue
            # Reserve only the nickname's actual area, rather than a bottom band.
            if self.portrait and x > self.w - 270 and self.h - 120 < y < self.h - 50:
                continue
            if not self.portrait and x > self.w - 290 and self.h - 95 < y < self.h - 35:
                continue
            stage = ((n // 2 + offset) % 12) // 2
            def block(dx, dy):
                d.rectangle((x + dx * pixel, y + dy * pixel,
                             x + (dx + 1) * pixel - 1, y + (dy + 1) * pixel - 1), fill=CREAM)
            if stage == 0:
                block(0, 0)
            elif stage in (1, 2):
                block(0, 0)
                for r in range(1, 2 if stage == 1 else 4):
                    for dx, dy in [(r, 0), (-r, 0), (0, r), (0, -r)]:
                        block(dx, dy)
            elif stage in (3, 4):
                r = 3 if stage == 3 else 5
                for dx, dy in [(r, 0), (-r, 0), (0, r), (0, -r)]:
                    block(dx, dy)

        # Smooth periodic flight; stars and the pixel trail retain their energy.
        bob = round(math.sin(math.tau * 3 * n / (FPS * SECONDS)) * 8)
        if self.portrait:
            cx = self.cx + bob
            start = self.cy + round(self.ship.height * .44)
            for y in range(start, self.h + 16, 16):
                wave = round(math.sin((y - start) / 100 - math.tau * (n // 3) / 10) * 8 / 4) * 4
                left = cx - self.stripe * 3 + wave
                for k, color in enumerate(COLORS):
                    d.rectangle((left + k * self.stripe, y, left + (k + 1) * self.stripe - 1, y + 15), fill=color)
            im.paste(self.ship, (cx - self.ship.width // 2, self.cy), self.ship)
        else:
            cy = self.cy + bob
            end = self.cx + round(self.ship.width * .56)
            for x in range(-16, end, 16):
                wave = round(math.sin((x - self.cx) / 100 + math.tau * (n // 3) / 10) * 8 / 4) * 4
                top = cy - self.stripe * 3 + wave
                for k, color in enumerate(COLORS):
                    d.rectangle((x, top + k * self.stripe, min(x + 15, end), top + (k + 1) * self.stripe - 1), fill=color)
            im.paste(self.ship, (self.cx, cy - self.ship.height // 2), self.ship)
        if self.portrait:
            d.text((48, 100), 'Model\nCitizens', font=self.title, fill=CREAM, spacing=-7)
            im.paste(self.logo, (self.w - 160, 102), self.logo)
            d.text((self.w - 48, self.h - 74), 'benlooning', font=self.nick, fill=CREAM, anchor='rs')
        else:
            d.text((64, 51), 'Model Citizens', font=self.title, fill=CREAM)
            im.paste(self.logo, (self.w - 172, 48), self.logo)
            d.text((self.w - 64, self.h - 52), 'benlooning', font=self.nick, fill=CREAM, anchor='rs')
        return im.resize(self.size, Image.Resampling.LANCZOS)


def encode(scene):
    path = OUT / f'{scene.name}.mp4'
    w, h = scene.size
    video = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo',
        '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', str(FPS), '-i', '-', '-an',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart', str(path)], stdin=subprocess.PIPE)
    gif_frames = []
    for n in range(FPS * SECONDS):
        frame = scene.render(n)
        video.stdin.write(frame.tobytes())
        if n == 0:
            frame.save(OUT / f'{scene.name}-preview.png')
        gif_frames.append(frame.resize((360, 640) if scene.portrait else (640, 360), Image.Resampling.LANCZOS))
    video.stdin.close()
    if video.wait() != 0:
        raise RuntimeError(f'FFmpeg failed: {path}')
    palette = gif_frames[0].quantize(colors=128)
    frames = [f.quantize(palette=palette, dither=Image.Dither.NONE) for f in gif_frames]
    durations = [30, 30, 40] * (len(frames) // 3)
    frames[0].save(OUT / f'{scene.name}.gif', save_all=True, append_images=frames[1:], duration=durations, loop=0, disposal=1)
    print(f'Created {path.name}: {w}x{h}, {FPS}fps, {SECONDS}s', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--format', choices=['both', 'landscape', 'portrait'], default='both')
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'fairydust-flight.svg').write_text(rocket_svg())
    for portrait in [False, True]:
        if args.format == 'both' or args.format == ('portrait' if portrait else 'landscape'):
            encode(Scene(portrait))


if __name__ == '__main__':
    main()
