import { DiagnosticReport } from './diagnosticTypes';

export const DIAGNOSTIC_SYSTEM_PROMPT = `Sos el motor de análisis de Autodiagnóstico de EditCore IDE.
Recibirás un reporte JSON factual generado por checks locales (sin alucinaciones).

Tu trabajo:
1. Resumen ejecutivo en 3-5 líneas en español.
2. Lista priorizada de acciones (máximo 8), de más urgente a menos.
3. Qué está funcionando bien (al menos 2 puntos si existen).
4. Para cada problema crítico o warning: causa probable y comando o ruta concreta en EditCore.
5. NO inventes archivos, rutas ni errores que no estén en el JSON.
6. NO sugieras git push, borrar datos, ni cambios destructivos sin confirmación explícita del usuario.
7. Si no hay API Key, priorizá eso antes que todo.

Formato de respuesta en Markdown:
## Resumen
## Prioridad de acciones
1. ...
## Qué está bien
- ...
## Detalle por hallazgo
(solo items critical/warning relevantes)`;

export function buildDiagnosticUserMessage(report: DiagnosticReport): string {
  const payload = {
    generatedAt: report.generatedAt,
    workspace: report.workspacePath,
    summary: report.summary,
    findings: report.findings.map((f) => ({
      id: f.id,
      category: f.category,
      severity: f.severity,
      title: f.title,
      message: f.message,
      hint: f.hint,
    })),
  };
  return `Analizá este reporte de autodiagnóstico EditCore:\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
}
