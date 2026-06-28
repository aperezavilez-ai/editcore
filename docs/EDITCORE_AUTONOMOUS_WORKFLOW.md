# EDITCORE Autonomous Workflow

## Modo Copiloto

- Sugiere y explica
- Genera plan
- Espera aprobación antes de escribir código

## Modo Autónomo

- Planifica e implementa
- Prueba y corrige (Self Debug Loop)
- Genera reportes

## Ciclo completo (ejemplo: "Agrega auth con Google")

1. PROJECT_UNDERSTANDING — framework, deps, APIs
2. AUTONOMOUS_PLAN — pasos, archivos, pruebas
3. Git branch + restore point
4. AOS pipeline (Architect → Developer → Review → QA → Security)
5. Self Debug Loop si fallan tests
6. TASK_COMPLETION_REPORT
7. NEXT_IMPROVEMENT_PLAN

## Integración

- AOS (Prompt 3): pipeline multiagente
- Autonomy (Prompt 1–2): niveles y cola
- Evolution: reportes y roadmap

