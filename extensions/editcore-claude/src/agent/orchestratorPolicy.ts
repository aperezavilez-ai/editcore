/** Tareas de solo lectura / diagnóstico: ir directo al agente, sin plan ni aprobación. */
export function shouldSkipOrchestratorPlan(prompt: string): boolean {
  const p = prompt.trim().toLowerCase();
  if (!p) {
    return false;
  }
  return (
    /^(dime|cuéntame|cuentame|qué|que|como|cómo|describe|explica|analiza|revisa|diagnostica|diagnóstica|estado|status|en qué|en que|where|what|how|tell me|explain)/i.test(
      p
    ) ||
    /\b(en qué proceso|que proceso|qué es este|que es este|estructura del proyecto|estado del proyecto)\b/i.test(
      p
    )
  );
}
