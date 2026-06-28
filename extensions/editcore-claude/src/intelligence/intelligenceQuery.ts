import * as vscode from "vscode";

import { ApiKeyService } from "../apiKeyService";

import { runIntelligencePipeline } from "./intelligencePipeline";



/** Patrones que activan el pipeline real de SIL (sin role-play del LLM). */

const INTROSPECTION_PATTERNS: RegExp[] = [

  /autoconocimiento/i,

  /auto-?conocimiento/i,

  /self[- ]?awareness/i,

  /system intelligence/i,

  /intelligence layer/i,

  /\bsil\b/i,

  /capa\s+(de\s+)?inteligencia/i,

  /modo\s+memoria\s+interna/i,

  /auto\s*mejora/i,

  /diagn[oó]stico\s+honesto/i,

  /diagn[oó]stico\s+(interno|del\s+sistema|completo)/i,

  /genera.*diagn[oó]stico.*editcore/i,

  /editcore.*diagn[oó]stico/i,

  /arquitectura\s+interna/i,

  /introspecci[oó]n.*editcore/i,

  /editcore.*introspecci[oó]n/i,

  /snapshot\s+del\s+sistema/i,

  /mapa\s+del\s+sistema/i,

  /system\s+map/i,

  /health\s+monitor/i,

  /qu[eé]\s+m[oó]dulos\s+tiene\s+editcore/i,

  /c[oó]mo\s+funciona\s+editcore\s+internamente/i,

  /documenta.*editcore/i,

  /memoria\s+t[eé]cnica/i,

  /autonom[ií]a\s+real/i,

  /modo\s+autonom[ií]a/i,

];



/** Ejecutar tareas de la cola con el agente (después del diagnóstico). */

const EXECUTE_PATTERNS: RegExp[] = [

  /ejecuta(r)?\s+(las?\s+)?tareas?/i,

  /aplica(r)?\s+(los?\s+)?fix/i,

  /implementa(r)?\s+(las?\s+)?mejoras?/i,

  /haz(lo)?\s+real/i,

  /ejecuta(r)?\s+autonom[ií]a/i,

  /aplica(r)?\s+autonom[ií]a/i,

];



export function isAutonomyExecuteQuery(prompt: string): boolean {

  const text = prompt.trim();

  return EXECUTE_PATTERNS.some((pattern) => pattern.test(text));

}



const AUTONOMOUS_DEV_PATTERNS: RegExp[] = [

  /desarrollador\s+aut[oó]nomo/i,

  /autonomous\s+developer/i,

  /motor\s+aut[oó]nomo/i,

  /implementa(r)?\s+aut[oó]nomamente/i,

  /ade:\s*(.+)/i,

];



export function isAutonomousDeveloperQuery(prompt: string): boolean {

  return AUTONOMOUS_DEV_PATTERNS.some((pattern) => pattern.test(prompt.trim()));

}



export function extractAutonomousObjective(prompt: string): string | undefined {

  const text = prompt.trim();

  const adeMatch = text.match(/ade:\s*(.+)/i);

  if (adeMatch?.[1]) {

    return adeMatch[1].trim();

  }

  const prefixes = [

    /desarrollador\s+aut[oó]nomo[:\s]+/i,

    /implementa(r)?\s+aut[oó]nomamente[:\s]+/i,

    /motor\s+aut[oó]nomo[:\s]+/i,

  ];

  for (const p of prefixes) {

    if (p.test(text)) {

      return text.replace(p, "").trim();

    }

  }

  if (isAutonomousDeveloperQuery(text) && text.length > 40) {

    return text;

  }

  return undefined;

}



export function isSystemIntelligenceQuery(prompt: string): boolean {

  const text = prompt.trim();

  if (text.length < 12) {

    return false;

  }

  return INTROSPECTION_PATTERNS.some((pattern) => pattern.test(text));

}



export async function runRealIntelligenceReport(

  context: vscode.ExtensionContext,

  apiKeyService: ApiKeyService,

  userQuestion?: string

): Promise<string> {

  const result = await runIntelligencePipeline(context, apiKeyService, {

    userQuestion,

    saveSystemMap: true,

    runAnalysis: true,

    recordMemory: true,

  });

  return result.markdown;

}



export async function runIntelligenceSnapshotOnly(

  context: vscode.ExtensionContext,

  apiKeyService: ApiKeyService

): Promise<string> {

  const { buildSystemSnapshot, formatSystemSnapshotMarkdown } = await import("./systemReader");

  const snapshot = await buildSystemSnapshot(context, apiKeyService);

  return formatSystemSnapshotMarkdown(snapshot);

}



export async function runIntelligenceHealthOnly(

  context: vscode.ExtensionContext,

  apiKeyService: ApiKeyService

): Promise<string> {

  const { buildHealthReport, formatHealthReportMarkdown } = await import("./healthMonitor");

  const health = await buildHealthReport(context, apiKeyService);

  return formatHealthReportMarkdown(health);

}


