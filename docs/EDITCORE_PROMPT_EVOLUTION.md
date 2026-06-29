# EditCore Prompt Evolution

Estado: **proceso manual real, sin agente automático**. El Prompt 12 pide
un "Prompt Evolution Agent" que revise y mejore los prompts del sistema
por sí mismo. Eso no existe. Lo que existe son los prompts reales del
producto y un proceso documentado (humano) para revisarlos.

## 1. Lo que sí existe (real, en el código de EditCore hoy)

- Prompts de sistema reales por rol/vertical en `extensions/editcore-claude/src/agents/roles.ts` y `extensions/editcore-claude/src/verticals/verticalCommands.ts` — son los que de verdad se envían al modelo en producción.
- Cambios a estos prompts ya pasan por el flujo normal de desarrollo: commit, revisión, merge a `main` — es decir, cada cambio de prompt queda documentado en el historial de git con su mensaje de commit, lo cual ya es una forma real (aunque manual) de "documentar cambios" (uno de los requisitos del Prompt 12).

## 2. Lo que NO existe todavía (honesto, no inventado)

- **Revisión automática de prompts**: no hay ningún proceso que lea los prompts actuales y detecte "instrucciones débiles" por sí mismo.
- **Generación automática de nuevas versiones**: los prompts se editan a mano, no hay un agente que proponga una reescritura.
- **Versionado dedicado de prompts**: no hay una tabla tipo `prompt_versions` — el único historial es el de git sobre los archivos `.ts` que los contienen. (Distinto del versionado de `agent_definitions`/`agent_versions` del Prompt 11, que es para agentes publicados por usuarios, no para los prompts internos del producto.)

## 3. Próximos pasos honestos

1. Si se decide automatizar esto, el camino más realista es: un script que tome el contenido actual de `roles.ts`/`verticalCommands.ts`, se lo pase a un modelo de IA pidiendo una crítica estructurada, y guarde el resultado como una `evolution_proposals` de nivel 2 (no que reescriba el archivo solo) — consistente con la regla de que ningún cambio se aplica sin revisión humana (ver `EDITCORE_EVOLUTION_WORKFLOW.md`).
2. Si el volumen de prompts crece, sí valdría la pena una tabla `prompt_versions` dedicada, separada del versionado de agentes de usuario.

Hasta entonces, mejorar un prompt en EditCore significa: una persona lo
edita, lo prueba, y lo sube a través de un commit normal — como cualquier
otro cambio de código.
