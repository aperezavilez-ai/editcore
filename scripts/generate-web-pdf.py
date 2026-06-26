#!/usr/bin/env python3
"""Genera PDF de guia/instalacion para la web oficial de EditCore."""

from __future__ import annotations

from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "assets" / "guia-instalacion.pdf"


def main() -> None:
    pdf = FPDF()
    pdf.set_margins(20, 20, 20)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 10, "EditCore IDE - Guia de instalacion", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", size=11)
    body = (
        "Requisitos: Windows 10 u 11 (64 bits), conexion a internet.\n"
        "Necesitas API key de Anthropic u OpenAI para el chat.\n\n"
        "1. Descarga EditCore desde editcore.com o GitHub Releases.\n"
        "2. Ejecuta EditCore-x.x.x-win32-x64-setup.exe (aprox. 192 MB).\n"
        "3. Si Windows advierte publicador desconocido:\n"
        "   Mas informacion, luego Ejecutar de todas formas.\n"
        "4. Abre EditCore IDE desde el menu Inicio.\n\n"
        "Primer arranque:\n"
        "- Configura API Keys (Ctrl+Alt+K o panel Cuenta).\n"
        "- Conecta Vercel, Supabase y GitHub desde EditCore Connect.\n\n"
        "Verificar integridad en PowerShell:\n"
        "Get-FileHash .\\EditCore-setup.exe -Algorithm SHA256\n"
        "Compara con SHA256SUMS.txt del release.\n\n"
        "Soporte: github.com/aperezavilez-ai/editcore/issues"
    )
    pdf.multi_cell(0, 6, body)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUT))
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
