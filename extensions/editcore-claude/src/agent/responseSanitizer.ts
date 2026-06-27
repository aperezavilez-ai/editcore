/** Quita XML/ruido de herramientas que el modelo escribe en texto plano (modo Ask sin tools). */
export function sanitizeAssistantText(text: string): string {
  let out = text
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/<tool_call>[\s\S]*$/gi, "")
    .replace(/<\/tool_call>/gi, "")
    .replace(/```tool[\s\S]*?```/gi, "")
    .trim();

  out = out.replace(/\n{3,}/g, "\n\n");
  return out;
}

export function isSubstantiveAssistantText(text: string): boolean {
  return sanitizeAssistantText(text).length > 0;
}
