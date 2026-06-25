import * as vscode from "vscode";

const CLAUDE_EXT = "editcore.editcore-claude";

async function ensureClaudeExtension(): Promise<vscode.Extension<void>> {
  let ext = vscode.extensions.getExtension(CLAUDE_EXT);
  if (ext) {
    if (!ext.isActive) {
      await ext.activate();
    }
    return ext;
  }

  // Intentar habilitar extensiones desactivadas (VS Code desactiva el chat builtin al inicio).
  try {
    await vscode.commands.executeCommand("workbench.extensions.action.enableAll");
    await new Promise((r) => setTimeout(r, 600));
    ext = vscode.extensions.getExtension(CLAUDE_EXT);
    if (ext) {
      if (!ext.isActive) {
        await ext.activate();
      }
      return ext;
    }
  } catch {
    // seguir con guía manual
  }

  const choice = await vscode.window.showWarningMessage(
    "EditCore Claude está desactivada. Sin ella no aparece el panel para pegar la API.",
    { modal: true },
    "Abrir extensión",
    "Recargar ventana"
  );

  if (choice === "Abrir extensión") {
    await vscode.commands.executeCommand("workbench.view.extensions");
    await vscode.commands.executeCommand("_extensions.manage", CLAUDE_EXT);
    vscode.window.showInformationMessage(
      "Pulsa «Habilitar» en EditCore — Claude Assistant, luego Ctrl+Alt+R."
    );
  } else if (choice === "Recargar ventana") {
    await vscode.commands.executeCommand("workbench.action.reloadWindow");
  }

  throw new Error(
    "1) Extensiones → «EditCore — Claude Assistant» → Habilitar  2) Recargar (Ctrl+Alt+R)  3) Barra izquierda → icono EditCore → Cuenta & API"
  );
}

export async function openEditCoreApis(): Promise<void> {
  await ensureClaudeExtension();

  const commands = [
    "editcore.openAccountPanel",
    "editcore.setApiKey",
    "editcore.accountView.focus",
  ];

  for (const cmd of commands) {
    try {
      await vscode.commands.executeCommand(cmd);
      return;
    } catch {
      // probar siguiente
    }
  }

  await vscode.commands.executeCommand("workbench.view.extension.editcore-sidebar");
  await vscode.commands.executeCommand("editcore.accountView.focus");
}

export async function reloadEditCore(): Promise<void> {
  const choice = await vscode.window.showWarningMessage(
    "¿Recargar EditCore para aplicar los cambios?",
    { modal: true },
    "Recargar",
    "Cancelar"
  );
  if (choice !== "Recargar") {
    return;
  }
  await vscode.commands.executeCommand("workbench.action.reloadWindow");
}
