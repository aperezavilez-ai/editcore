# EditCore Solution Design

Estado: **proceso real guiado por agente, sin automatización de salida**.
Este documento describe el proceso de diseño de soluciones empresariales
dentro de EditCore y los templates de output que producen los agentes.

## 1. Proceso de diseño (cómo funciona de verdad)

El agente `@enterprise-architect` sigue este proceso cuando un usuario describe un problema de negocio:

1. **Análisis de necesidades** (Fase 1): preguntas directas sobre objetivos, usuarios, restricciones y escala. Sin supuestos implícitos.
2. **Diseño de solución** (Fase 2): arquitectura por capas con tecnologías concretas y justificadas.
3. **Roadmap de implementación** (Fase 5): fases de 2-4 semanas con entregables medibles.
4. **Diseño del equipo IA** (Fase 10): agentes específicos con responsabilidades delimitadas.
5. **Validación** (Fase 13): checklist interno de escalabilidad, seguridad, costos y dependencias.

## 2. Templates de documentos que el agente genera

### BUSINESS_REQUIREMENTS_DOCUMENT.md
```
# Business Requirements Document — [Nombre del proyecto]
## Contexto
## Problema principal
## Usuarios y actores
## Objetivos medibles
## Restricciones
## Escalabilidad requerida
## Supuestos y riesgos de negocio
```

### SOLUTION_ARCHITECTURE.md
```
# Solution Architecture — [Nombre del proyecto]
## Resumen ejecutivo
## Stack tecnológico (con justificación por capa)
## Diagrama de componentes (ASCII o Mermaid)
## Flujo de datos principal
## APIs e integraciones
## Seguridad (auth, datos en tránsito, datos en reposo)
## Infraestructura y despliegue
## Consideraciones de escalabilidad
## Decisiones técnicas y alternativas descartadas
```

### IMPLEMENTATION_ROADMAP.md
```
# Implementation Roadmap — [Nombre del proyecto]
## Fase 1: [Nombre] (semanas 1-2) — Entregable: [X]
## Fase 2: [Nombre] (semanas 3-4) — Entregable: [X]
...
## Dependencias entre fases
## Riesgos por fase
## Recursos estimados
```

## 3. Lo que NO existe todavía

- Los documentos se generan como salida de chat del IDE, no se guardan automáticamente en un archivo del workspace — el usuario debe copiarlos manualmente o pedirle al agente que los escriba en un archivo específico.
- No hay un generador de diagramas Mermaid automático integrado (aunque el agente puede producir código Mermaid si se le pide).
