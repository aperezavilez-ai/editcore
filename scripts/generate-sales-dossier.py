#!/usr/bin/env python3
"""Genera el dossier de venta de EditCore en PDF."""

from __future__ import annotations

import datetime
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "EditCore-Dossier-Venta.pdf"
FONT = Path(r"C:\Windows\Fonts\segoeui.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\segoeuib.ttf")
LOGO = ROOT / "branding" / "icons" / "editcore-logo-web.png"


class DossierPDF(FPDF):
    def __init__(self) -> None:
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_auto_page_break(auto=True, margin=18)
        self.add_font("Segoe", "", str(FONT))
        self.add_font("Segoe", "B", str(FONT_BOLD))

    def footer(self) -> None:
        self.set_y(-12)
        self.set_font("Segoe", "", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 6, f"EditCore — Dossier confidencial — {datetime.date.today().year}", align="C")

    def section_title(self, title: str) -> None:
        self.ln(4)
        self.set_font("Segoe", "B", 13)
        self.set_text_color(20, 60, 120)
        self.multi_cell(0, 8, title)
        self.set_draw_color(20, 60, 120)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(3)
        self.set_font("Segoe", "", 10)
        self.set_text_color(30, 30, 30)

    def bullet(self, text: str) -> None:
        self.set_x(14)
        self.multi_cell(0, 5.5, f"• {text}")

    def body(self, text: str) -> None:
        self.multi_cell(0, 5.5, text)
        self.ln(1)


def build() -> None:
    pdf = DossierPDF()
    pdf.add_page()

    if LOGO.exists():
        pdf.image(str(LOGO), x=10, y=10, w=22)
        pdf.set_y(36)
    else:
        pdf.set_y(15)

    pdf.set_font("Segoe", "B", 22)
    pdf.set_text_color(15, 45, 90)
    pdf.cell(0, 10, "EditCore IDE", ln=True)
    pdf.set_font("Segoe", "B", 14)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(0, 8, "Dossier de venta — Transferencia de activo tecnológico", ln=True)
    pdf.set_font("Segoe", "", 10)
    pdf.set_text_color(90, 90, 90)
    pdf.cell(
        0,
        6,
        f"Versión del producto: 1.0.3  |  Fecha: {datetime.date.today().strftime('%d/%m/%Y')}  |  Confidencial",
        ln=True,
    )
    pdf.ln(4)

    pdf.section_title("1. Resumen ejecutivo")
    pdf.body(
        "EditCore es un IDE de escritorio basado en Code-OSS (base open source de Visual Studio Code), "
        "con inteligencia artificial integrada (Claude/OpenAI), agente autónomo con herramientas, "
        "browser local, e integraciones de despliegue (GitHub, Vercel, Supabase). "
        "El producto está empaquetado, distribuible y publicado en releases oficiales."
    )
    pdf.body(
        "Se ofrece la venta del activo completo: código fuente propio, fork del editor, marca, "
        "dominio web, pipeline de build/deploy, documentación y release v1.0.3. "
        "Modelo de negocio recomendado: licencia del IDE con API del usuario (BYOK), "
        "minimizando costos operativos y maximizando margen."
    )

    pdf.section_title("2. Qué incluye la venta")
    items = [
        "Repositorio GitHub: github.com/aperezavilez-ai/editcore",
        "Extensiones propietarias: editcore-claude (~87 módulos TS) y editcore-connect (~24 módulos TS)",
        "Fork Code-OSS (editcore-src) + scripts de build, parches y deploy automatizado",
        "Build portable Windows x64 + instalador (EditCoreUserSetup)",
        "Marca EditCore: logo, iconografía, product.json, letterpress",
        "Sitio web: editcore.mx (GitHub Pages) con descarga dinámica vía releases/latest.json",
        "Release publicado v1.0.3 (portable ZIP + setup EXE)",
        "Documentación: README, DOWNLOAD, TERMS, PRIVACY",
        "Stub de licencias, actualizaciones y onboarding",
        "Transferencia de dominio y cuentas asociadas (negociable)",
        "Período de transición técnica (1–3 meses, opcional, cotizable aparte)",
    ]
    for item in items:
        pdf.bullet(item)

    pdf.section_title("3. Propuesta de valor")
    for item in [
        "IDE listo para usar sin depender del marketplace de Microsoft",
        "Agente con herramientas reales: lectura/escritura de código, terminal, git, búsqueda semántica",
        "Browser integrado para preview de apps Next.js/Vite en localhost",
        "Panel unificado Connect: GitHub, Vercel, Supabase desde el IDE",
        "Modelo BYOK: el usuario aporta su API key; el operador no paga tokens",
        "Distribución legal vía Open VSX (sin licencia propietaria de Marketplace)",
        "Enfoque LATAM: español, flujos simplificados, marca propia",
    ]:
        pdf.bullet(item)

    pdf.section_title("4. Stack tecnológico")
    pdf.body(
        "Electron / Code-OSS 1.126 · TypeScript · Extensiones VS Code API · "
        "Anthropic SDK · OpenAI API · SecretStorage · Supabase/Vercel/GitHub CLI · "
        "Python (iconos/build) · PowerShell (CI/deploy) · Inno Setup (instalador)."
    )

    pdf.section_title("5. Estado del producto (v1.0.3)")
    for item in [
        "Chat nativo con participante editcore.claude y modo Agent funcional",
        "Detección automática de workspace y contexto de proyecto",
        "Estilo de respuesta tipo Cursor (conciso, sin ruido técnico)",
        "Browser con auto-detección de puerto dev (3000/5173)",
        "Icono EC en barra lateral (monocromo)",
        "Pipeline: compile → deploy portable → zip → manifest → GitHub Release",
        "Pendiente comercial: firma EV Windows, macOS build, servidor de licencias",
    ]:
        pdf.bullet(item)

    pdf.section_title("6. Modelo de negocio sugerido")
    pdf.body("Licencia del IDE + API del usuario (BYOK). El comprador vende el producto, no el consumo de IA.")
    pdf.ln(1)
    pdf.set_font("Segoe", "B", 10)
    pdf.cell(55, 6, "Plan", border=1)
    pdf.cell(45, 6, "Precio sugerido", border=1)
    pdf.cell(80, 6, "Notas", border=1, ln=True)
    pdf.set_font("Segoe", "", 9)
    rows = [
        ("Comunidad", "Gratis", "BYOK, adopción y marketing"),
        ("Pro", "$12–19 USD/mes", "Updates + soporte; usuario trae API"),
        ("Team", "$25–35 USD/usuario/mes", "Licencias empresariales"),
        ("Pro + IA incluida", "$39–59 USD/mes", "Solo con límites de uso claros"),
    ]
    for a, b, c in rows:
        pdf.cell(55, 6, a, border=1)
        pdf.cell(45, 6, b, border=1)
        pdf.cell(80, 6, c, border=1, ln=True)
    pdf.ln(2)
    pdf.set_font("Segoe", "", 10)
    pdf.body("Punto de equilibrio operativo (BYOK): ~3–4 clientes Pro cubren costos fijos básicos (~$25–50 USD/mes).")

    pdf.section_title("7. Costos operativos estimados (post-compra)")
    for item in [
        "Infra mínima: $25–50 USD/mes (dominio, GitHub, releases)",
        "Firma código Windows (opcional): ~$200–400 USD/año",
        "Mantenimiento fork VS Code: variable (horas dev/mes)",
        "Tokens IA: $0 si modelo BYOK; $15–150 USD/usuario/mes si IA incluida",
        "Soporte: principal costo real (tiempo humano)",
    ]:
        pdf.bullet(item)

    pdf.section_title("8. Valoración de venta (activo completo)")
    pdf.body("Metodología: costo de reemplazo ajustado + comparables de mercado pre-revenue.")
    pdf.ln(1)
    pdf.set_font("Segoe", "B", 10)
    pdf.cell(70, 6, "Escenario", border=1)
    pdf.cell(50, 6, "Rango USD", border=1)
    pdf.cell(60, 6, "Perfil comprador", border=1, ln=True)
    pdf.set_font("Segoe", "", 9)
    valuation = [
        ("Venta rápida", "$8k – $15k", "Adquisición de activo, poca due diligence"),
        ("Venta justa", "$20k – $40k", "Comprador técnico + transición"),
        ("Estratégica", "$40k – $70k", "Empresa con plan comercial LATAM"),
        ("Punto medio negociación", "$25k – $35k", "Paquete completo + handoff"),
    ]
    for a, b, c in valuation:
        pdf.cell(70, 6, a, border=1)
        pdf.cell(50, 6, b, border=1)
        pdf.cell(60, 6, c, border=1, ln=True)
    pdf.ln(2)
    pdf.set_font("Segoe", "", 10)
    pdf.body(
        "Sin ingresos recurrentes ni base de usuarios pagos, el precio se fundamenta en activos "
        "tangibles y potencial comercial, no en múltiplo de ARR."
    )

    pdf.section_title("9. Fortalezas y riesgos")
    pdf.set_font("Segoe", "B", 10)
    pdf.cell(0, 6, "Fortalezas", ln=True)
    pdf.set_font("Segoe", "", 10)
    for item in [
        "Producto funcional y empaquetado (no solo prototipo)",
        "Pipeline de release automatizado",
        "Integraciones reales con ecosistema dev moderno",
        "Marca, dominio y web operativos",
        "Código propio bajo MIT (flexible para el comprador)",
    ]:
        pdf.bullet(item)
    pdf.ln(1)
    pdf.set_font("Segoe", "B", 10)
    pdf.cell(0, 6, "Riesgos / limitaciones", ln=True)
    pdf.set_font("Segoe", "", 10)
    for item in [
        "Base Code-OSS: competencia puede forkar enfoque similar",
        "Mantenimiento continuo del upstream VS Code",
        "Un solo autor principal en el historial del repo",
        "Sin firma EV ni build macOS listos para enterprise",
        "Sin MRR ni métricas de usuarios publicadas",
    ]:
        pdf.bullet(item)

    pdf.section_title("10. Licenciamiento")
    pdf.body(
        "Código propio de EditCore (extensiones, branding, scripts): licencia MIT. "
        "Code-OSS hereda licencia MIT de Microsoft. "
        "La venta transfiere derechos sobre el código propio y la marca; "
        "no implica exclusividad sobre el editor base open source."
    )

    pdf.section_title("11. Términos de transferencia sugeridos")
    for item in [
        "Pago: 50% al firmar LOI / contrato, 50% al cierre de transferencia",
        "Entregables: repo, dominio, documentación, credenciales, build reproducible",
        "Transición: 30–90 días de soporte al comprador (cotizable)",
        "No competencia: negociable (12–24 meses)",
        "Confidencialidad del dossier y due diligence",
    ]:
        pdf.bullet(item)

    pdf.section_title("12. Contacto")
    pdf.body("Repositorio: https://github.com/aperezavilez-ai/editcore")
    pdf.body("Web: https://editcore.mx/")
    pdf.body("Release actual: https://github.com/aperezavilez-ai/editcore/releases/tag/v1.0.3")
    pdf.body("Solicitud de demo, due diligence técnica o propuesta formal: contactar al titular del proyecto.")

    pdf.ln(6)
    pdf.set_font("Segoe", "", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(
        0,
        5,
        "Documento informativo. Las cifras son estimaciones orientativas y no constituyen "
        "oferta vinculante. El precio final depende de due diligence, activos incluidos "
        "y condiciones de transferencia acordadas entre las partes.",
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUT))
    print(f"OK: {OUT}")


if __name__ == "__main__":
    build()
