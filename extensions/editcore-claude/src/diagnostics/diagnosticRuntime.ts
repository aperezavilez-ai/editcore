import * as vscode from 'vscode';
import { ApiKeyService } from '../apiKeyService';

let extensionContext: vscode.ExtensionContext | undefined;
let apiKeyService: ApiKeyService | undefined;

export function setDiagnosticRuntime(
  context: vscode.ExtensionContext,
  service: ApiKeyService
): void {
  extensionContext = context;
  apiKeyService = service;
}

export function getDiagnosticRuntime():
  | { context: vscode.ExtensionContext; apiKeyService: ApiKeyService }
  | undefined {
  if (!extensionContext || !apiKeyService) {
    return undefined;
  }
  return { context: extensionContext, apiKeyService };
}
