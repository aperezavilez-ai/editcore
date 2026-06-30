# EditCore — Prototype Lab

## Estado actual

El Prototype Lab permite registrar, rastrear y documentar prototipos y experimentos sin afectar el entorno de produccion. El registro y seguimiento es real; la ejecucion automatica de builds no existe aun.

## Tipos de prototipo

| Tipo | Descripcion |
|------|-------------|
| mvp | Producto minimo viable |
| poc | Prueba de concepto |
| demo | Demostracion para stakeholders |
| experiment | Experimento tecnico aislado |
| wireframe | Diseno de interfaz |

## Sistema de experimentos

El `Experiment Management System` (lab_experiments) registra el ciclo cientifico completo:
1. **Hipotesis**: "Si hacemos X, esperamos Y porque Z"
2. **Metodo**: Como se prueba
3. **Criterio de exito**: Que resultado confirma la hipotesis
4. **Resultados**: Que ocurrio realmente
5. **Aprendizajes**: Que nos lleva a saber este resultado

### Estados de experimento
`planned -> running -> completed / failed / cancelled`

Al cambiar a `running` se registra `started_at` automaticamente.
Al cambiar a `completed/failed/cancelled` se registra `completed_at`.

## Innovation Memory

La tabla `lab_innovation_memory` actua como sistema de aprendizaje acumulativo:
- Tipos: learning, pattern, decision, success, failure, insight
- Impacto: low, medium, high, critical
- Vinculable a experimento, prototipo, idea o startup via source_type/source_id

## Lo que NO existe aun

- Entorno sandbox automatico para builds de prototipos
- CI/CD separado para el lab
- Comparacion A/B automatica entre prototipos
- Metricas de performance de experimentos en tiempo real
