#!/usr/bin/env python3
"""Verifica que el logo circular este en todos los puntos de branding."""

from __future__ import annotations

import base64
import io
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

PNG_CHECKS = [
    "branding/icons/editcore-logo-web.png",
    "branding/icons/editcore-logo.png",
    "branding/icons/editcore-logo-512.png",
    "branding/icons/linux/code.png",
    "web/assets/editcore-logo-web.png",
    "web/assets/favicon-16.png",
    "web/assets/favicon-32.png",
    "web/assets/apple-touch-icon.png",
]

OPTIONAL_PNG = [
    "VSCode-win32-x64/resources/app/resources/win32/code_70x70.png",
    "VSCode-win32-x64/resources/app/resources/win32/code_150x150.png",
]

SVG_CHECKS = [
    "branding/icons/letterpress/letterpress-dark.svg",
    "extensions/editcore-claude/media/editcore-icon.svg",
    "extensions/editcore-claude/media/editcore-activity.svg",
]

HTML_CHECKS = [
    ("web/index.html", ["favicon.ico", "favicon-32.png", "editcore-logo-web.png"]),
]


def is_circular_png(path: Path) -> tuple[bool, str]:
    img = Image.open(path).convert("RGBA")
    arr = np.array(img)
    h, w = arr.shape[:2]
    corners = (arr[0, 0], arr[0, w - 1], arr[h - 1, 0], arr[h - 1, w - 1])
    if not all(c[3] < 25 for c in corners):
        return False, f"esquinas no transparentes: {corners[0]}"
    ys, xs = np.where(arr[:, :, 3] > 20)
    if len(xs) == 0:
        return False, "sin contenido visible"
    bw, bh = xs.max() - xs.min(), ys.max() - ys.min()
    if abs(bw - bh) > max(3, min(w, h) * 0.03):
        return False, f"bbox no cuadrado: {bw}x{bh}"
    return True, f"ok {w}x{h}"


def is_circular_svg(path: Path) -> tuple[bool, str]:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"base64,([A-Za-z0-9+/=]+)", text)
    if not match:
        return False, "sin imagen embebida"
    img = Image.open(io.BytesIO(base64.b64decode(match.group(1)))).convert("RGBA")
    tmp = path.parent / (path.stem + ".__verify.png")
    img.save(tmp)
    ok, info = is_circular_png(tmp)
    tmp.unlink(missing_ok=True)
    return ok, info


def main() -> int:
    failed = 0
    print("=== Verificacion logo circular EditCore ===\n")

    for rel in PNG_CHECKS:
        path = ROOT / rel
        if not path.exists():
            print(f"FAIL  FALTA     {rel}")
            failed += 1
            continue
        ok, info = is_circular_png(path)
        print(f"{'OK' if ok else 'FAIL'}  {'CIRCULAR' if ok else 'NO_CIRC'}  {rel}  ({info})")
        if not ok:
            failed += 1

    for rel in OPTIONAL_PNG:
        path = ROOT / rel
        if not path.exists():
            print(f"SKIP  (no portable)  {rel}")
            continue
        ok, info = is_circular_png(path)
        print(f"{'OK' if ok else 'FAIL'}  {'CIRCULAR' if ok else 'NO_CIRC'}  {rel}  ({info})")
        if not ok:
            failed += 1

    for rel in SVG_CHECKS:
        path = ROOT / rel
        if not path.exists():
            print(f"FAIL  FALTA     {rel}")
            failed += 1
            continue
        ok, info = is_circular_svg(path)
        print(f"{'OK' if ok else 'FAIL'}  {'CIRCULAR' if ok else 'NO_CIRC'}  {rel}  ({info})")
        if not ok:
            failed += 1

    ico = ROOT / "branding/icons/win32/code.ico"
    if ico.exists():
        print(f"OK    ICO       branding/icons/win32/code.ico  ({ico.stat().st_size} bytes)")
    else:
        print("FAIL  FALTA     branding/icons/win32/code.ico")
        failed += 1

    for html_rel, needles in HTML_CHECKS:
        html = (ROOT / html_rel).read_text(encoding="utf-8")
        missing = [n for n in needles if n not in html]
        if missing:
            print(f"FAIL  HTML      {html_rel}  falta: {', '.join(missing)}")
            failed += 1
        else:
            print(f"OK    HTML      {html_rel}  favicon + logo web referenciados")

    print()
    if failed:
        print(f"RESULTADO: {failed} problema(s). Ejecuta: python scripts/generate-editcore-icons.py")
        return 1
    print("RESULTADO: todo correcto — logo circular en todos los puntos verificados.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
