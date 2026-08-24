#!/usr/bin/env python3
"""Generate forum-ready promotional images from the checked-in UI snapshots."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SNAPSHOTS = ROOT / "snapshots"
OUTPUT = ROOT / "docs" / "forum-assets"
FONT_REGULAR = "/System/Library/Fonts/STHeiti Light.ttc"
FONT_BOLD = "/System/Library/Fonts/STHeiti Medium.ttc"

GREEN = "#159B6C"
INK = "#24352D"
MUTED = "#6E7E74"
PAPER = "#F5F8F1"
WHITE = "#FFFFFF"
CORAL = "#EF7B58"
GOLD = "#E9B949"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size)


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *size), radius=radius, fill=255)
    return mask


def contain(path: Path, box: tuple[int, int], radius: int = 28) -> Image.Image:
    image = Image.open(path).convert("RGB")
    image.thumbnail(box, Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", image.size, WHITE)
    frame.paste(image, (0, 0), rounded_mask(image.size, radius))
    return frame


def phone_card(canvas: Image.Image, path: Path, xy: tuple[int, int], size: tuple[int, int], radius: int = 34) -> None:
    x, y = xy
    w, h = size
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x + 8, y + 14, x + w + 8, y + h + 14), radius=radius, fill=(20, 50, 36, 45))
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    canvas.alpha_composite(shadow)

    screenshot = Image.open(path).convert("RGB")
    ratio = max(w / screenshot.width, h / screenshot.height)
    scaled = screenshot.resize((round(screenshot.width * ratio), round(screenshot.height * ratio)), Image.Resampling.LANCZOS)
    left = (scaled.width - w) // 2
    top = (scaled.height - h) // 2
    crop = scaled.crop((left, top, left + w, top + h))
    layer = Image.new("RGBA", (w, h), WHITE)
    layer.paste(crop, (0, 0), rounded_mask((w, h), radius))
    canvas.alpha_composite(layer, (x, y))


def pill(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, color: str) -> int:
    x, y = xy
    label_font = font(28, True)
    bbox = draw.textbbox((0, 0), text, font=label_font)
    width = bbox[2] - bbox[0] + 52
    draw.rounded_rectangle((x, y, x + width, y + 58), radius=29, fill=color)
    draw.text((x + 26, y + 13), text, font=label_font, fill=WHITE)
    return width


def save(canvas: Image.Image, name: str) -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(OUTPUT / name, quality=94, optimize=True)


def make_cover() -> None:
    canvas = Image.new("RGBA", (1600, 900), PAPER)
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, 1600, 16), fill=GREEN)

    icon = Image.open(ROOT / "packages/assets/icons/ICON_256.PNG").convert("RGBA").resize((124, 124), Image.Resampling.LANCZOS)
    canvas.alpha_composite(icon, (112, 94))
    draw.text((112, 266), "舒尔特训练", font=font(86, True), fill=INK)
    draw.text((116, 384), "把专注力训练装进你的 fnOS", font=font(42), fill=MUTED)
    draw.text((116, 455), "从 1 到 500 关，和家人一起挑战眼疾手快", font=font(34), fill=INK)

    x = 116
    for label, color in (("13 种布局", GREEN), ("家庭排行榜", CORAL), ("NAS 账号同步", GOLD)):
        width = pill(draw, (x, 560), label, color)
        x += width + 18

    draw.text((116, 680), "第三方开源 fnOS Native 应用", font=font(30), fill=MUTED)
    draw.text((116, 734), "v1.0.5", font=font(26, True), fill=GREEN)

    phone_card(canvas, SNAPSHOTS / "home.png", (1020, 86), (394, 700))
    phone_card(canvas, SNAPSHOTS / "game-hex.png", (825, 188), (330, 714))
    save(canvas, "01-cover.jpg")


def make_layouts() -> None:
    canvas = Image.new("RGBA", (1600, 1060), PAPER)
    draw = ImageDraw.Draw(canvas)
    draw.text((80, 62), "不止是方格：13 种布局渐进穿插", font=font(58, True), fill=INK)
    draw.text((82, 142), "同一关布局固定，可公平比成绩；也能一键换版分享新局面", font=font(30), fill=MUTED)

    cards = [
        ("方格", "game-grid.png"),
        ("蜂巢", "game-hex.png"),
        ("波浪", "game-wave.png"),
        ("花瓣", "game-petal.png"),
    ]
    for index, (label, filename) in enumerate(cards):
        x = 70 + index * 385
        phone_card(canvas, SNAPSHOTS / filename, (x, 240), (320, 694), 28)
        draw.rounded_rectangle((x + 95, 952, x + 225, 1016), radius=32, fill=WHITE, outline="#D6E1D7", width=2)
        text_box = draw.textbbox((0, 0), label, font=font(28, True))
        draw.text((x + 160 - (text_box[2] - text_box[0]) / 2, 968), label, font=font(28, True), fill=INK)
    save(canvas, "02-layouts.jpg")


def make_family() -> None:
    canvas = Image.new("RGBA", (1600, 1000), PAPER)
    draw = ImageDraw.Draw(canvas)
    draw.text((84, 58), "一台 NAS，就是全家的训练场", font=font(58, True), fill=INK)
    draw.text((86, 138), "免注册新账号，自动识别 fnOS 用户；成绩、排名和进度各自保存", font=font(30), fill=MUTED)

    cards = [
        ("关卡进度", "home.png"),
        ("家庭排行榜", "leaderboard.png"),
        ("个人档案", "profile.png"),
    ]
    for index, (label, filename) in enumerate(cards):
        x = 140 + index * 470
        phone_card(canvas, SNAPSHOTS / filename, (x, 230), (380, 674), 30)
        draw.rounded_rectangle((x + 88, 920, x + 292, 976), radius=28, fill=GREEN)
        text_box = draw.textbbox((0, 0), label, font=font(26, True))
        draw.text((x + 190 - (text_box[2] - text_box[0]) / 2, 934), label, font=font(26, True), fill=WHITE)
    save(canvas, "03-family.jpg")


if __name__ == "__main__":
    make_cover()
    make_layouts()
    make_family()
    print(f"Generated forum assets in {OUTPUT}")
