# EditCore Autonomous Build System

Estado: **asistido por IA, no totalmente autónomo**. Este documento
es honesto sobre el alcance real de la "autonomía" en EditCore hoy.

## 1. Qué significa "autónomo" en EditCore

En EditCore, "autónomo" significa que los agentes IA hacen el trabajo
pesado intelectual (analizar, diseñar, generar código, detectar errores)
pero un humano aprueba y ejecuta los cambios que afectan producción.
Esto es intencional, no una limitación temporal — modificar código en
producción sin revisión humana es el tipo de riesgo que los propios
principios del Prompt 14 prohíben: "No construir sin arquitectura",
"No desplegar sin pruebas", "Registrar todos los cambios".

## 2. Nivel de autonomía real por etapa

| Etapa | Nivel real |
|---|---|
| Análisis de requerimientos | **Alto**: el agente conduce la conversación y produce documentos estructurados |
| Diseño de arquitectura | **Alto**: propone stack, capas, trade-offs con justificación |
| Generación de código | **Alto**: genera código completo y funcional en el IDE |
| Ejecución de tests | **Bajo**: genera los tests, pero ejecutarlos requiere que el humano los corra |
| Commit y merge | **Nulo**: siempre un humano hace el commit y aprueba el merge |
| Deploy | **Medio**: Vercel deploya automáticamente desde `main`, pero el push a `main` requiere humano |
| Monitoreo | **Medio**: el agente analiza logs que el humano le muestra; no accede a logs en tiempo real |

## 3. Qué faltaría para más autonomía (sin fabricarlo como si existiera)

Para que EditCore pueda hacer commits, abrir PRs o desplegar solo necesitaría:
1. Una GitHub App instalada en el repo con permisos de escritura (no configurada).
2. Un runner (servidor o GitHub Action) que ejecute las instrucciones del agente.
3. Un mecanismo de aprobación (webhook + UI) para que el humano apruebe cambios críticos antes de ejecutarse.
4. Sandboxing seguro para ejecutar código generado sin riesgo de afectar producción.

Ninguno de estos cuatro existe hoy. Construirlos requeriría varios sprints de trabajo
y decisiones de seguridad importantes que no se deben tomar ligeramente.
