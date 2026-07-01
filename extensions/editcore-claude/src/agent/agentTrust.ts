/**
 * agentTrust.ts
 * -------------------------------------------------------------------------
 * Estado de "confianza" para una tarea del agente. Cuando el usuario elige
 * "Aplicar y confiar en el resto de la tarea" en la primera aprobación
 * (ya sea un cambio de archivo o un comando), el resto de las acciones de
 * ESA MISMA tarea se ejecutan sin volver a pedir confirmación.
 *
 * Se resetea automáticamente al inicio de cada tarea nueva (ver
 * agentLoop.ts / openaiAgentLoop.ts), así que nunca "confía" de forma
 * permanente ni entre tareas distintas — solo dentro de la tarea actual.
 * -------------------------------------------------------------------------
 */

let trusted = false;

export function isTaskTrusted(): boolean {
  return trusted;
}

export function setTaskTrusted(value: boolean): void {
  trusted = value;
}

export function resetTaskTrust(): void {
  trusted = false;
}
