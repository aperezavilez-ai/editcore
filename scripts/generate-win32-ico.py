#!/usr/bin/env python3
"""Genera code.ico BMP (sin PNG) para Windows Explorer y rcedit."""

from __future__ import annotations

import struct
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "branding" / "icons" / "editcore-logo-web.png"
FALLBACK = ROOT / "branding" / "icons" / "editcore-logo.png"
OUT = ROOT / "branding" / "icons" / "win32" / "code.ico"
SIZES = [16, 32, 48, 64, 128, 256]


def round_logo(img: Image.Image, radius_ratio: float = 0.22) -> Image.Image:
    w, h = img.size
    r = max(2, int(min(w, h) * radius_ratio))
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), radius=r, fill=255)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(img, mask=mask)
    return out


def has_rounded_alpha(img: Image.Image) -> bool:
    rgba = img.convert("RGBA")
    w, h = rgba.size
    corners = (
        rgba.getpixel((0, 0))[3],
        rgba.getpixel((w - 1, 0))[3],
        rgba.getpixel((0, h - 1))[3],
        rgba.getpixel((w - 1, h - 1))[3],
    )
    return all(a < 128 for a in corners)


def load_logo() -> Image.Image:
    src = SOURCE if SOURCE.exists() else FALLBACK
    if not src.exists():
        raise SystemExit(f"Falta logo: {src}")
    rgba = Image.open(src).convert("RGBA")
    w, h = rgba.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    square = rgba.crop((left, top, left + side, top + side))
    mask = Image.new("L", (side, side), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, side - 1, side - 1), fill=255)
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    out.paste(square, mask=mask)
    return out


def rgba_icon(size: int, logo: Image.Image) -> Image.Image:
    """Solo el logo: esquinas exteriores transparentes, sin caja negra extra."""
    return logo.resize((size, size), Image.Resampling.LANCZOS)


def bmp_dib_32(img: Image.Image) -> bytes:
    w, h = img.size
    rgba = img.convert("RGBA")
    header = struct.pack(
        "<IIIHHIIIIII",
        40,
        w,
        h * 2,
        1,
        32,
        0,
        w * h * 4,
        0,
        0,
        0,
        0,
    )
    and_row_bytes = ((w + 31) // 32) * 4
    xor = bytearray()
    and_mask = bytearray()
    for y in range(h - 1, -1, -1):
        and_bits: list[int] = []
        for x in range(w):
            r, g, b, a = rgba.getpixel((x, y))
            xor.extend((b, g, r, a))
            and_bits.append(1 if a < 128 else 0)
        while len(and_bits) < and_row_bytes * 8:
            and_bits.append(0)
        for byte_i in range(and_row_bytes):
            byte = 0
            for bit in range(8):
                if and_bits[byte_i * 8 + bit]:
                    byte |= 1 << (7 - bit)
            and_mask.append(byte)
    return header + bytes(xor) + bytes(and_mask)


def write_bmp_ico(path: Path, images: list[Image.Image]) -> None:
    count = len(images)
    header = struct.pack("<HHH", 0, 1, count)
    entries = bytearray()
    blobs = bytearray()
    offset = 6 + 16 * count
    for img in images:
        w, h = img.size
        dib = bmp_dib_32(img)
        entries.extend(
            struct.pack(
                "<BBBBHHII",
                w if w < 256 else 0,
                h if h < 256 else 0,
                0,
                0,
                1,
                32,
                len(dib),
                offset,
            )
        )
        blobs.extend(dib)
        offset += len(dib)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(header + bytes(entries) + bytes(blobs))


def verify_ico(path: Path) -> None:
    data = path.read_bytes()
    if data[:4] != b"\x00\x00\x01\x00":
        raise SystemExit("ICO invalido")
    count = struct.unpack_from("<H", data, 4)[0]
    for i in range(count):
        off = 6 + i * 16
        pos = struct.unpack_from("<I", data, off + 12)[0]
        if data[pos : pos + 8] == b"\x89PNG\r\n\x1a\n":
            raise SystemExit(f"ICO contiene PNG comprimido (frame {i}) - Explorer fallara")


def main() -> None:
    logo = load_logo()
    logo.save(ROOT / "branding" / "icons" / "editcore-logo.png")
    images = [rgba_icon(s, logo) for s in SIZES]
    write_bmp_ico(OUT, images)
    verify_ico(OUT)
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes, BMP x{len(SIZES)})")

    targets = [
        ROOT / "editcore-src/resources/win32/code.ico",
        ROOT / "VSCode-win32-x64/resources/app/resources/win32/code.ico",
    ]
    for dst in targets:
        if dst.parent.exists() or "editcore-src" in str(dst):
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(OUT.read_bytes())
            print(f"copied {dst}")

    png_targets = [
        (70, ROOT / "editcore-src/resources/win32/code_70x70.png"),
        (150, ROOT / "editcore-src/resources/win32/code_150x150.png"),
        (70, ROOT / "VSCode-win32-x64/resources/app/resources/win32/code_70x70.png"),
        (150, ROOT / "VSCode-win32-x64/resources/app/resources/win32/code_150x150.png"),
    ]
    for size, dst in png_targets:
        if dst.parent.exists() or "editcore-src" in str(dst):
            dst.parent.mkdir(parents=True, exist_ok=True)
            rgba_icon(size, logo).save(dst)
            print(f"wrote {dst}")

    apply = ROOT / "scripts/apply-exe-icon.js"
    if apply.exists() and (ROOT / "VSCode-win32-x64/EditCore.exe").exists():
        subprocess.run(["node", str(apply)], cwd=ROOT, check=False)


if __name__ == "__main__":
    main()
