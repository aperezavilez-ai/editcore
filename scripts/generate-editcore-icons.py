#!/usr/bin/env python3
"""Generate EditCore logo assets (SVG, ICO, PNG) from branding/icons/editcore-logo.png."""

from __future__ import annotations

import base64
import io
import os
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "branding" / "icons"
PNG_PATH = ICON_DIR / "editcore-logo.png"
SOURCE_PATH = ICON_DIR / "editcore-logo-source.png"
WEB_PATH = ICON_DIR / "editcore-logo-web.png"

DARWIN_SIZES = {
    "icon_16x16.png": 16,
    "icon_16x16@2x.png": 32,
    "icon_32x32.png": 32,
    "icon_32x32@2x.png": 64,
    "icon_128x128.png": 128,
    "icon_128x128@2x.png": 256,
    "icon_256x256.png": 256,
    "icon_256x256@2x.png": 512,
    "icon_512x512.png": 512,
    "icon_512x512@2x.png": 1024,
}


def png_b64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def svg_embedded(viewbox: str, b64: str) -> str:
    parts = viewbox.split()
    w, h = parts[-2], parts[-1]
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="{viewbox}">\n'
        f'  <image xlink:href="data:image/png;base64,{b64}" '
        f'width="{w}" height="{h}" preserveAspectRatio="xMidYMid meet"/>\n'
        f"</svg>\n"
    )


def _flood_outer_background(arr: np.ndarray) -> np.ndarray:
    """Quita solo el padding blanco exterior; conserva letras blancas del cubo EC."""
    h, w = arr.shape[:2]
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    light = (
        (r > 200)
        & (g > 200)
        & (b > 200)
        & (np.abs(r.astype(int) - g.astype(int)) < 25)
        & (np.abs(g.astype(int) - b.astype(int)) < 25)
    )
    outer = np.zeros((h, w), dtype=bool)
    stack: list[tuple[int, int]] = []
    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        if light[y, x]:
            stack.append((x, y))
    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h or outer[y, x] or not light[y, x]:
            continue
        outer[y, x] = True
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    arr = arr.copy()
    arr[outer] = [0, 0, 0, 255]
    return arr


def apply_rounded_corners(img: Image.Image, radius_ratio: float = 0.22) -> Image.Image:
    """Recorta a esquinas redondeadas; fuera del radio queda transparente."""
    w, h = img.size
    radius = max(2, int(min(w, h) * radius_ratio))
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, w - 1, h - 1), radius=radius, fill=255)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(img, mask=mask)
    return out


def apply_circular_mask(img: Image.Image, feather: float = 1.0) -> Image.Image:
    """Recorta a circulo perfecto; elimina halo cuadrado fuera del disco."""
    square = crop_square(img.convert("RGBA"))
    w, h = square.size
    cx, cy = (w - 1) / 2.0, (h - 1) / 2.0
    radius = min(cx, cy)
    arr = np.array(square, dtype=np.float32)
    ys, xs = np.ogrid[:h, :w]
    dist = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
    if feather > 0:
        alpha_scale = np.clip((radius - dist) / feather, 0.0, 1.0)
    else:
        alpha_scale = (dist <= radius).astype(np.float32)
    arr[:, :, 3] *= alpha_scale
    arr[arr[:, :, 3] < 1, :3] = 0
    return Image.fromarray(arr.astype(np.uint8))


def normalize_logo(img: Image.Image) -> Image.Image:
    arr = _flood_outer_background(np.array(img.convert("RGBA")))
    return Image.fromarray(arr)


def crop_square(logo: Image.Image) -> Image.Image:
    w, h = logo.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    return logo.crop((left, top, left + side, top + side))


def flatten_on_black(img: Image.Image, size: int) -> Image.Image:
    """ICO/tiles Windows: negro opaco detras del logo (sin alpha exterior)."""
    thumb = img.resize((size, size), Image.Resampling.LANCZOS)
    if thumb.mode != "RGBA":
        thumb = thumb.convert("RGBA")
    bg = Image.new("RGB", (size, size), (0, 0, 0))
    bg.paste(thumb, mask=thumb.split()[3])
    return bg


def center_on_canvas(img: Image.Image, size: int) -> Image.Image:
    thumb = apply_circular_mask(img)
    pad = min(48, max(2, size // 8))
    inner = max(1, size - pad)
    thumb.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(thumb, ((size - thumb.width) // 2, (size - thumb.height) // 2), thumb)
    return canvas


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    print(f"wrote {path}")


def save_ico(path: Path, logo: Image.Image) -> None:
    """Delega a generate-win32-ico.py (ICO BMP puro para Windows)."""
    gen = ROOT / "scripts" / "generate-win32-ico.py"
    if gen.exists():
        subprocess.run([sys.executable, str(gen)], check=True, cwd=ROOT)
        if path.resolve() != (ICON_DIR / "win32" / "code.ico").resolve():
            shutil.copy2(ICON_DIR / "win32" / "code.ico", path)
        return
    sizes = [256, 128, 64, 48, 32, 16]
    images = [flatten_on_black(logo, s) for s in sizes]
    path.parent.mkdir(parents=True, exist_ok=True)
    images[0].save(path, format="ICO", sizes=[(s, s) for s in sizes])
    print(f"wrote {path} ({path.stat().st_size} bytes)")


def has_rounded_alpha(img: Image.Image) -> bool:
    """True si el PNG ya trae esquinas transparentes (squircle)."""
    rgba = img.convert("RGBA")
    w, h = rgba.size
    corners = (
        rgba.getpixel((0, 0))[3],
        rgba.getpixel((w - 1, 0))[3],
        rgba.getpixel((0, h - 1))[3],
        rgba.getpixel((w - 1, h - 1))[3],
    )
    return all(a < 128 for a in corners)


def prepare_logo(img: Image.Image) -> Image.Image:
    """Normaliza el maestro a circulo (mismo aspecto que editcore.mx)."""
    return apply_circular_mask(img)


def load_master_logo() -> Image.Image:
    src = SOURCE_PATH if SOURCE_PATH.exists() else PNG_PATH
    if not src.exists():
        raise SystemExit(f"Missing master logo: {PNG_PATH}")
    logo = prepare_logo(Image.open(src))
    PNG_PATH.parent.mkdir(parents=True, exist_ok=True)
    logo.save(PNG_PATH)
    print(f"wrote {PNG_PATH} (native alpha: {has_rounded_alpha(logo)})")
    return logo


def load_circular_logo() -> Image.Image:
    """Logo circular para watermark del editor y favicon web (editcore-logo-web.png)."""
    src = WEB_PATH if WEB_PATH.exists() else SOURCE_PATH if SOURCE_PATH.exists() else PNG_PATH
    if not src.exists():
        raise SystemExit(f"Missing circular logo: {WEB_PATH}")
    logo = apply_circular_mask(Image.open(src))
    WEB_PATH.parent.mkdir(parents=True, exist_ok=True)
    logo.save(WEB_PATH)
    web_assets = ROOT / "web" / "assets"
    if web_assets.parent.exists():
        web_assets.mkdir(parents=True, exist_ok=True)
        logo.save(web_assets / "editcore-logo-web.png")
        print(f"wrote {web_assets / 'editcore-logo-web.png'}")
    print(f"wrote {WEB_PATH}")
    return logo


def write_web_favicons(circular: Image.Image) -> None:
    assets = ROOT / "web" / "assets"
    if not assets.parent.exists():
        return
    assets.mkdir(parents=True, exist_ok=True)
    sizes = {
        "favicon-16.png": 16,
        "favicon-32.png": 32,
        "apple-touch-icon.png": 180,
    }
    ico_images = []
    for name, size in sizes.items():
        img = circular.resize((size, size), Image.Resampling.LANCZOS)
        path = assets / name
        img.save(path)
        print(f"wrote {path}")
        if size in (16, 32):
            ico_images.append(img.convert("RGBA"))
    ico_path = assets / "favicon.ico"
    ico_images[1].save(
        ico_path,
        format="ICO",
        sizes=[(16, 16), (32, 32)],
        append_images=[ico_images[0]],
    )
    print(f"wrote {ico_path}")


def svg_letterpress(logo: Image.Image, opacity: str) -> str:
    img = logo.resize((260, 260), Image.Resampling.LANCZOS)
    b64 = png_b64(img)
    return (
        f'<svg width="260" height="260" viewBox="0 0 260 260" opacity="{opacity}" '
        f'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">\n'
        f'  <image xlink:href="data:image/png;base64,{b64}" width="260" height="260" '
        f'preserveAspectRatio="xMidYMid meet"/>\n'
        f"</svg>\n"
    )


def strip_authenticode(exe: Path) -> None:
    kits = Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")) / "Windows Kits" / "10" / "bin"
    if not kits.exists():
        return
    signtools = sorted(kits.glob("**/signtool.exe"), reverse=True)
    for tool in signtools:
        if "x64" in str(tool):
            r = subprocess.run([str(tool), "remove", "/s", str(exe)], capture_output=True)
            if r.returncode == 0:
                print(f"stripped signature: {tool.name}")
            return


def cleanup_legacy_icons() -> None:
    """Elimina ICO/PNG de prueba que ya no forman parte del branding."""
    legacy = [
        ICON_DIR / "win32" / "code-test2.ico",
        ICON_DIR / "win32" / "test-P.ico",
        ICON_DIR / "win32" / "test-RGB.ico",
        ICON_DIR / "win32" / "_ico-tmp",
    ]
    for path in legacy:
        if not path.exists():
            continue
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()
        print(f"removed legacy {path.relative_to(ROOT)}")


def main() -> None:
    cleanup_legacy_icons()
    logo = load_master_logo()
    circular = load_circular_logo()
    write_web_favicons(circular)
    brand_letterpress = ICON_DIR / "letterpress"
    brand_letterpress.mkdir(parents=True, exist_ok=True)
    canvas512 = center_on_canvas(circular, 512)
    canvas512.save(ICON_DIR / "editcore-logo-512.png")
    print(f"wrote {ICON_DIR / 'editcore-logo-512.png'}")

    svg24 = svg_embedded("0 0 24 24", png_b64(circular.resize((24, 24), Image.Resampling.LANCZOS)))
    svg512 = svg_embedded("0 0 512 512", png_b64(center_on_canvas(circular, 512)))
    svg1024 = svg_embedded("0 0 1024 1024", png_b64(center_on_canvas(circular, 1024)))

    for rel in (
        "branding/icons/editcore-icon.svg",
        "extensions/editcore-claude/media/editcore-icon.svg",
        "extensions/editcore-connect/media/activity-connect.svg",
        "editcore-src/extensions/editcore-claude/media/editcore-icon.svg",
        "editcore-src/extensions/editcore-connect/media/activity-connect.svg",
        "VSCode-win32-x64/resources/app/extensions/editcore-claude/media/editcore-icon.svg",
        "VSCode-win32-x64/resources/app/extensions/editcore-connect/media/connect-icon.svg",
    ):
        write_text(ROOT / rel, svg24)

    activity_png = apply_circular_mask(circular).resize((28, 28), Image.Resampling.LANCZOS)
    for rel in (
        "extensions/editcore-claude/media/editcore-activity.png",
        "editcore-src/extensions/editcore-claude/media/editcore-activity.png",
        "VSCode-win32-x64/resources/app/extensions/editcore-claude/media/editcore-activity.png",
    ):
        path = ROOT / rel
        if path.parent.exists() or "extensions" in rel:
            path.parent.mkdir(parents=True, exist_ok=True)
            activity_png.save(path)
            print(f"wrote {path}")

    write_text(ICON_DIR / "app-icon-source.svg", svg512)

    workbench_svg = ROOT / "editcore-src/src/vs/workbench/browser/media/code-icon.svg"
    if workbench_svg.parent.exists():
        write_text(workbench_svg, svg1024)

    sessions_svg = ROOT / "editcore-src/src/vs/sessions/browser/media/vscode-icon.svg"
    if sessions_svg.parent.exists():
        write_text(
            sessions_svg,
            svg_embedded("0 0 96 96", png_b64(circular.resize((96, 96), Image.Resampling.LANCZOS))),
        )

    sessions_logo_svg = svg_embedded(
        "0 0 128 128", png_b64(circular.resize((128, 128), Image.Resampling.LANCZOS))
    )
    sessions_logo_dirs = [
        ROOT / "editcore-src/src/vs/sessions/browser/media",
        ROOT / "editcore-src/out/media",
        ROOT / "VSCode-win32-x64/resources/app/out/media",
    ]
    for d in sessions_logo_dirs:
        if d.parent.exists() or "editcore-src/src" in str(d):
            write_text(d / "sessions-logo-light.svg", sessions_logo_svg)
            write_text(d / "sessions-logo-dark.svg", sessions_logo_svg)

    gh_auth_svg = ROOT / "editcore-src/extensions/github-authentication/media/code-icon.svg"
    if gh_auth_svg.parent.exists():
        write_text(gh_auth_svg, svg1024)

    letterpress_files = {
        "letterpress-light.svg": "0.15",
        "letterpress-dark.svg": "0.3",
        "letterpress-hcLight.svg": "0.2",
        "letterpress-hcDark.svg": "0.3",
    }
    letterpress_dirs = [
        ROOT / "editcore-src/src/vs/workbench/browser/parts/editor/media",
        ROOT / "editcore-src/out/vs/workbench/browser/parts/editor/media",
        ROOT / "editcore-src/out/vs/media",
        ROOT / "VSCode-win32-x64/resources/app/out/vs/workbench/browser/parts/editor/media",
        ROOT / "VSCode-win32-x64/resources/app/out/media",
    ]
    for name, opacity in letterpress_files.items():
        content = svg_letterpress(circular, opacity)
        write_text(brand_letterpress / name, content)
        for d in letterpress_dirs:
            if d.parent.exists() or "editcore-src/src" in str(d):
                write_text(d / name, content)

    sessions_letterpress = {
        "letterpress-sessions-light.svg": "0.15",
        "letterpress-sessions-dark.svg": "0.3",
    }
    for name, opacity in sessions_letterpress.items():
        content = svg_letterpress(circular, opacity)
        d = ROOT / "editcore-src/src/vs/sessions/contrib/chat/browser/media"
        if d.exists():
            write_text(d / name, content)

    workbench_out_dirs = [
        ROOT / "editcore-src/out/vs/workbench/browser/media",
        ROOT / "editcore-src/out/media",
        ROOT / "VSCode-win32-x64/resources/app/out/vs/workbench/browser/media",
        ROOT / "VSCode-win32-x64/resources/app/out/media",
    ]
    for d in workbench_out_dirs:
        if d.parent.exists():
            write_text(d / "code-icon.svg", svg1024)

    png_targets = {
        70: ROOT / "editcore-src/resources/win32/code_70x70.png",
        150: ROOT / "editcore-src/resources/win32/code_150x150.png",
        192: ROOT / "editcore-src/resources/server/code-192.png",
        512: ROOT / "editcore-src/resources/server/code-512.png",
    }
    for size, path in png_targets.items():
        if path.parent.exists() or "editcore-src" in str(path):
            path.parent.mkdir(parents=True, exist_ok=True)
            if size in (70, 150):
                apply_circular_mask(logo).resize((size, size), Image.Resampling.LANCZOS).save(path)
            else:
                flatten_on_black(logo, size).save(path)
            print(f"wrote {path}")

    ico_targets = [
        ICON_DIR / "win32" / "code.ico",
        ROOT / "editcore-src/resources/win32/code.ico",
        ROOT / "VSCode-win32-x64/resources/app/resources/win32/code.ico",
        ROOT / "VSCode-win32-x64/EditCore.exe",
    ]
    for ico_path in ico_targets:
        if ico_path.name == "EditCore.exe":
            continue
        if ico_path.parent.exists() or "editcore-src" in str(ico_path):
            save_ico(ico_path, circular)

    darwin_dir = ICON_DIR / "darwin" / "code.iconset"
    for name, size in DARWIN_SIZES.items():
        out = darwin_dir / name
        out.parent.mkdir(parents=True, exist_ok=True)
        center_on_canvas(logo, size).save(out)
        print(f"wrote {out}")

    linux_png = ICON_DIR / "linux" / "code.png"
    linux_png.parent.mkdir(parents=True, exist_ok=True)
    center_on_canvas(logo, 256).save(linux_png)
    print(f"wrote {linux_png}")

    portable_pngs = [
        ROOT / "VSCode-win32-x64/resources/app/resources/win32/code_70x70.png",
        ROOT / "VSCode-win32-x64/resources/app/resources/win32/code_150x150.png",
    ]
    for src, dst in [
        (ROOT / "editcore-src/resources/win32/code_70x70.png", portable_pngs[0]),
        (ROOT / "editcore-src/resources/win32/code_150x150.png", portable_pngs[1]),
        (ROOT / "editcore-src/resources/win32/code.ico", portable_pngs[0].parent / "code.ico"),
    ]:
        if src.exists() and dst.parent.exists():
            shutil.copy2(src, dst)
            print(f"copied {dst}")

    manifest = ROOT / "VSCode-win32-x64/EditCore.VisualElementsManifest.xml"
    if manifest.exists():
        text = manifest.read_text(encoding="utf-8")
        text = text.replace("ShortDisplayName=\"Code - OSS\"", 'ShortDisplayName="EditCore"')
        manifest.write_text(text, encoding="utf-8")
        print(f"updated {manifest}")

    portable_exe = ROOT / "VSCode-win32-x64/EditCore.exe"
    apply_icon = ROOT / "scripts/apply-exe-icon.js"
    checksum_script = ROOT / "scripts/update-product-checksums.js"
    if portable_exe.parent.exists() and checksum_script.exists():
        subprocess.run(["node", str(checksum_script), str(ROOT)], check=False)
    if portable_exe.exists() and apply_icon.exists():
        subprocess.run(["node", str(apply_icon)], check=False, cwd=ROOT)


if __name__ == "__main__":
    main()
